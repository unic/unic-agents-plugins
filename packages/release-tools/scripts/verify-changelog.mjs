#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { evaluateBumpGate, GUARDED, isBumpRequired } from './lib/changelog-gate.mjs'
import { gitCmd } from './lib/platform.mjs'

const root = process.cwd()

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
	} catch (e) {
		fail(`cannot read CHANGELOG.md: ${/** @type {Error} */ (e).message}`)
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

// Resolve plugin prefix (e.g. "apps/claude-code/unic-pr-review/") for path normalisation.
// With real git, --relative below already strips this; the strip is the fallback for the
// test shim, which does not honor --relative and emits repo-root-relative paths.
const showPrefix = git('rev-parse', '--show-prefix')
if (showPrefix.status !== 0) {
	// Not fatal: real git's --relative still scopes paths. Surfaced so a genuine git
	// failure (which would also disable the prefix-strip fallback) is traceable in CI logs.
	console.error('verify:changelog: warn — could not resolve plugin prefix; relying on git --relative for scoping')
}
const pluginPrefix = showPrefix.status === 0 ? showPrefix.stdout.trim().replace(/\\/g, '/') : ''

// List changed files. --relative makes real git emit paths relative to cwd (the plugin dir here).
const diff = git('diff', '--name-only', '--relative', `${base}...HEAD`)
if (diff.status !== 0) {
	if (isCI) {
		fail('git diff unavailable — add fetch-depth: 0 to the checkout step in ci.yml')
	}
	console.log('verify:changelog: skipped (git diff unavailable)')
	process.exit(0)
}

const changedFiles = diff.stdout
	.trim()
	.split('\n')
	.filter(Boolean)
	.map((f) => {
		// Normalise separators and strip the plugin prefix when present.
		// This handles the test shim, which emits root-relative paths regardless of --relative.
		const normalised = f.replace(/\\/g, '/')
		if (pluginPrefix && normalised.startsWith(pluginPrefix)) return normalised.slice(pluginPrefix.length)
		return normalised
	})

if (!isBumpRequired(changedFiles, GUARDED)) {
	console.log('verify:changelog: ok (structural checks passed; no guarded paths changed)')
	process.exit(0)
}

// Read HEAD version
const pluginPath = path.join(root, '.claude-plugin/plugin.json')
/** @type {{ version: string }} */
let headPlugin
try {
	headPlugin = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, 'utf8')))
} catch (e) {
	fail(`cannot read ${pluginPath}: ${/** @type {Error} */ (e).message}`)
	process.exit(1) // unreachable — satisfies TS
}
const headVersion = headPlugin.version
if (typeof headVersion !== 'string' || headVersion === '') {
	fail(`${pluginPath} has no valid "version" field`)
}

// Read base version
const basePluginRaw = git('show', `${base}:.claude-plugin/plugin.json`)
let baseVersion = ''
if (basePluginRaw.status === 0) {
	try {
		baseVersion = /** @type {{ version: string }} */ (JSON.parse(basePluginRaw.stdout)).version
	} catch (e) {
		console.error(`verify:changelog: warn — could not parse base plugin.json: ${/** @type {Error} */ (e).message}`)
		// intentional fallback: treat base as new plugin with no prior version
	}
}

// Read CHANGELOG
let changelog
try {
	changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
} catch (e) {
	fail(`cannot read CHANGELOG.md: ${/** @type {Error} */ (e).message}`)
	process.exit(1) // unreachable — satisfies TS
}

const verdict = evaluateBumpGate({ changedFiles, guardedPatterns: GUARDED, headVersion, baseVersion, changelog })

if (!verdict.ok) {
	fail(verdict.message)
}

console.log(`verify:changelog: ok — ${verdict.message}`)
