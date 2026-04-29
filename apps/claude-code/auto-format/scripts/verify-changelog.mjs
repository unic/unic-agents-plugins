#!/usr/bin/env node

/**
 * pnpm verify:changelog
 * Layer 1: structural checks (Unreleased section, subsections, dated releases).
 * Layer 2: diff-based gate — when guarded paths change, version must be bumped
 *           and CHANGELOG must have a real entry for the new version.
 */
// @ts-check

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

/** Paths that trigger version-bump enforcement when changed */
const GUARDED = [
	/^scripts\/.+\.mjs$/,
	/^tests\/.+\.mjs$/,
	/^\.claude-plugin\/(plugin|marketplace)\.json$/,
	/^CLAUDE\.md$/,
	/^README\.md$/,
	/^docs\/plans\/.+\.md$/,
]

// Layer 1: structural checks

const changelogPath = resolve(ROOT, 'CHANGELOG.md')

let changelog
try {
	changelog = readFileSync(changelogPath, 'utf8')
} catch {
	process.stderr.write('verify:changelog: CHANGELOG.md not found.\n')
	process.exit(1)
}

const errors = []

if (!changelog.includes('## [Unreleased]')) {
	errors.push('Missing ## [Unreleased] section.')
}

const unreleasedIdx = changelog.indexOf('## [Unreleased]')
if (unreleasedIdx !== -1) {
	const nextReleaseIdx = changelog.indexOf('\n## [', unreleasedIdx + 1)
	const unreleasedBlock =
		nextReleaseIdx === -1 ? changelog.slice(unreleasedIdx) : changelog.slice(unreleasedIdx, nextReleaseIdx)
	for (const sub of ['### Breaking', '### Added', '### Fixed']) {
		if (!unreleasedBlock.includes(sub)) {
			errors.push(`[Unreleased] is missing subsection: ${sub}`)
		}
	}
}

const releasePattern = /^## \[(\d+\.\d+\.\d+)\]/gm
for (const match of changelog.matchAll(releasePattern)) {
	const end = changelog.indexOf('\n', match.index ?? 0)
	const line = changelog.slice(match.index, end === -1 ? undefined : end)
	if (!/ - \d{4}-\d{2}-\d{2}/.test(line)) {
		errors.push(`Release section missing date: ${line.trim()}`)
	}
}

if (errors.length > 0) {
	process.stderr.write('verify:changelog failed:\n')
	for (const e of errors) {
		process.stderr.write(`  - ${e}\n`)
	}
	process.exit(1)
}

// Layer 2: diff-based version-bump gate

/**
 * @param {string[]} args
 * @returns {{ stdout: string, status: number }}
 */
function git(...args) {
	const result = spawnSync('git', args, { encoding: 'utf8', cwd: ROOT })
	return { stdout: result.stdout ?? '', status: result.status ?? 1 }
}

const isCI = process.env.CI === 'true'
let base = 'origin/main'
if (!isCI) {
	const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
	base = upstream.status === 0 ? upstream.stdout.trim() : 'HEAD~1'
}

const diff = git('diff', '--name-only', `${base}...HEAD`)
if (diff.status !== 0) {
	process.stdout.write('verify:changelog: skipped (git diff unavailable)\n')
	process.exit(0)
}

const changedFiles = diff.stdout.trim().split('\n').filter(Boolean)
const triggered = changedFiles.some((f) => GUARDED.some((re) => re.test(f)))
if (!triggered) {
	process.stdout.write('verify:changelog: ok (no guarded paths changed)\n')
	process.exit(0)
}

const pluginPath = resolve(ROOT, '.claude-plugin/plugin.json')
/** @type {Record<string, unknown>} */
let headPlugin
try {
	headPlugin = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(pluginPath, 'utf8')))
} catch {
	process.stderr.write(`verify:changelog: cannot read ${pluginPath}\n`)
	process.exit(1)
}
const headVersion = /** @type {string} */ (headPlugin.version)

const basePluginRaw = git('show', `${base}:.claude-plugin/plugin.json`)
let baseVersion = ''
if (basePluginRaw.status === 0) {
	try {
		const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(basePluginRaw.stdout))
		baseVersion = typeof parsed.version === 'string' ? parsed.version : ''
	} catch {
		// base does not have plugin.json yet — treat as empty
	}
}

if (headVersion === baseVersion) {
	process.stderr.write(
		`verify:changelog: version in plugin.json was not bumped\n` +
			`  current: ${headVersion} (same as ${base})\n` +
			`  Run: pnpm bump <patch|minor|major>\n`
	)
	process.exit(1)
}

const sectionMatch = changelog.match(
	new RegExp(`## \\[${headVersion.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|$)`)
)
if (!sectionMatch) {
	process.stderr.write(
		`verify:changelog: CHANGELOG.md has no entry for version ${headVersion}\n` +
			`  Add bullets under [Unreleased] then run: pnpm bump\n`
	)
	process.exit(1)
}

const sectionBody = sectionMatch[1]
const hasRealEntry = sectionBody
	.split('\n')
	.filter((l) => l.startsWith('- '))
	.some((l) => l !== '- (none)')
if (!hasRealEntry) {
	process.stderr.write(
		`verify:changelog: CHANGELOG.md section [${headVersion}] has no real entries\n` +
			`  Add bullets under [Unreleased] then re-run: pnpm bump\n`
	)
	process.exit(1)
}

process.stdout.write(`verify:changelog: ok — version ${baseVersion} → ${headVersion}\n`)
