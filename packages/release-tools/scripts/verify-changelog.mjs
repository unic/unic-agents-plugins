#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gitCmd } from './lib/platform.mjs'

const root = process.cwd()

/** Paths that trigger enforcement when changed */
const GUARDED = [
	/^scripts\/.+\.mjs$/,
	/^commands\/.+\.md$/,
	/^\.claude-plugin\/plugin\.json$/,
	/^\.claude-plugin\/marketplace\.json$/,
	/^CLAUDE\.md$/,
	/^README\.md$/,
]

/**
 * @param {string[]} args
 * @returns {{ stdout: string, status: number }}
 */
function git(...args) {
	const [cmd, ...spawnArgs] = gitCmd(args)
	const result = spawnSync(cmd, spawnArgs, { encoding: 'utf8', cwd: root })
	return { stdout: result.stdout ?? '', status: result.status ?? 1 }
}

/** @returns {never} */
function fail(/** @type {string} */ msg) {
	console.error(`verify:changelog: ${msg}`)
	process.exit(1)
}

// ── Layer 1: structural checks (run unconditionally) ──────────────────────────
{
	const changelogPath = path.join(root, 'CHANGELOG.md')
	let changelog
	try {
		changelog = readFileSync(changelogPath, 'utf8')
	} catch {
		fail('cannot read CHANGELOG.md')
	}

	const structuralErrors = []

	// 1a. [Unreleased] section must exist
	if (!changelog.includes('## [Unreleased]')) {
		structuralErrors.push('Missing ## [Unreleased] section')
	} else {
		// 1b. Required subsections must be present inside [Unreleased]
		const unreleasedIdx = changelog.indexOf('## [Unreleased]')
		const nextSectionIdx = changelog.indexOf('\n## [', unreleasedIdx + 1)
		const unreleasedBlock =
			nextSectionIdx === -1 ? changelog.slice(unreleasedIdx) : changelog.slice(unreleasedIdx, nextSectionIdx)
		for (const sub of ['### Breaking', '### Added', '### Fixed']) {
			if (!unreleasedBlock.includes(sub)) {
				structuralErrors.push(`[Unreleased] is missing subsection: ${sub}`)
			}
		}
	}

	// 1c. Every versioned release header must carry an em-dash date suffix
	const releaseHeaderRe = /^## \[(\d+\.\d+\.\d+)\].*/gm
	for (const m of changelog.matchAll(releaseHeaderRe)) {
		const lineEnd = changelog.indexOf('\n', m.index)
		const line = changelog.slice(m.index, lineEnd === -1 ? undefined : lineEnd)
		if (!/ — \d{4}-\d{2}-\d{2}/.test(line)) {
			structuralErrors.push(`Release section missing em-dash date (— YYYY-MM-DD): ${line.trim()}`)
		}
	}

	if (structuralErrors.length > 0) {
		console.error('verify:changelog: structural errors found:')
		for (const e of structuralErrors) console.error(`  - ${e}`)
		process.exit(1)
	}
}
console.log('verify:changelog: ok (structural checks passed)')
// ── Layer 2: diff-based version-bump gate ────────────────────────────────────
// Determine diff base
const isCI = process.env.CI === 'true'
let base
if (isCI) {
	const targetBranch = process.env.GITHUB_BASE_REF ?? 'main'
	base = `origin/${targetBranch}`
} else {
	const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
	base = upstream.status === 0 ? upstream.stdout.trim() : 'HEAD~1'
}

// List changed files
const diff = git('diff', '--name-only', `${base}...HEAD`)
if (diff.status !== 0) {
	if (isCI) {
		fail('git diff unavailable — add fetch-depth: 0 to the checkout step in ci.yml')
	}
	console.log('verify:changelog: skipped (git diff unavailable)')
	process.exit(0)
}

const changedFiles = diff.stdout.trim().split('\n').filter(Boolean)
const triggered = changedFiles.some((f) => GUARDED.some((re) => re.test(f)))
if (!triggered) {
	console.log('verify:changelog: ok (structural checks passed; no guarded paths changed)')
	process.exit(0)
}

// Read HEAD version
const pluginPath = path.join(root, '.claude-plugin/plugin.json')
/** @type {{ version: string }} */
let headPlugin
try {
	headPlugin = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, 'utf8')))
} catch {
	fail(`cannot read ${pluginPath}`)
	process.exit(1) // unreachable — satisfies TS
}
const headVersion = headPlugin.version

// Read base version
const basePluginRaw = git('show', `${base}:.claude-plugin/plugin.json`)
let baseVersion = ''
if (basePluginRaw.status === 0) {
	try {
		baseVersion = /** @type {{ version: string }} */ (JSON.parse(basePluginRaw.stdout)).version
	} catch {
		// base doesn't have plugin.json yet — treat as empty
	}
}

if (headVersion === baseVersion) {
	fail(
		`version in plugin.json was not bumped\n  current: ${headVersion} (same as base)\n  Run: pnpm bump <patch|minor|major>`
	)
}

// Check CHANGELOG has a section for headVersion with at least one real bullet
let changelog
try {
	changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
} catch {
	fail('cannot read CHANGELOG.md')
	process.exit(1)
}

const sectionMatch = changelog.match(
	new RegExp(`## \\[${headVersion.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|\\s*$)`)
)
if (!sectionMatch) {
	fail(`CHANGELOG.md has no entry for version ${headVersion}\n  Add bullets under [Unreleased] then run: pnpm bump`)
}

const sectionBody = sectionMatch[1]
const hasRealEntry = sectionBody
	.split('\n')
	.filter((l) => l.startsWith('- '))
	.some((l) => l !== '- (none)')
if (!hasRealEntry) {
	fail(
		`CHANGELOG.md section [${headVersion}] has no entries — only "(none)" placeholders found\n  Add bullets under [Unreleased] then re-run: pnpm bump`
	)
}

console.log(`verify:changelog: ok — version ${baseVersion} → ${headVersion}`)
