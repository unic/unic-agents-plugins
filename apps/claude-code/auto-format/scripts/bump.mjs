#!/usr/bin/env node
/**
 * pnpm bump <patch|minor|major>
 * Bumps version in plugin.json (single source of truth), syncs to
 * marketplace.json + package.json via sync-version.mjs, and promotes
 * [Unreleased] in CHANGELOG.md.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'))
}

function writeJson(rel, obj) {
	writeFileSync(resolve(ROOT, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function bumpVersion(version, type) {
	const [major, minor, patch] = version.split('.').map(Number)
	if (type === 'major') return `${major + 1}.0.0`
	if (type === 'minor') return `${major}.${minor + 1}.0`
	if (type === 'patch') return `${major}.${minor}.${patch + 1}`
	throw new Error(`Invalid bump type: ${type}`)
}

function today() {
	return new Date().toISOString().slice(0, 10)
}

const bumpType = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bumpType)) {
	process.stderr.write(`Usage: pnpm bump <patch|minor|major>\n`)
	process.exit(1)
}

// Validate CHANGELOG before touching any files
const changelogPath = resolve(ROOT, 'CHANGELOG.md')
let changelog = readFileSync(changelogPath, 'utf8')

const unreleasedMatch = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=## \[|$)/)
if (!unreleasedMatch) {
	process.stderr.write('CHANGELOG.md does not have an [Unreleased] section.\n')
	process.exit(1)
}

const unreleasedBody = unreleasedMatch[1]
const hasEntries = unreleasedBody.split('\n').some((line) => {
	const trimmed = line.trim()
	return trimmed.startsWith('-') && !trimmed.includes('(none)')
})

if (!hasEntries) {
	process.stderr.write(`[Unreleased] has no entries. Add CHANGELOG entries before bumping.\n`)
	process.exit(1)
}

// Bump plugin.json (single source of truth)
const pluginJson = readJson('.claude-plugin/plugin.json')
const newVersion = bumpVersion(pluginJson.version, bumpType)
pluginJson.version = newVersion
writeJson('.claude-plugin/plugin.json', pluginJson)

// Propagate to marketplace.json and package.json via sync-version
const syncResult = spawnSync('node', [resolve(ROOT, 'scripts/sync-version.mjs')], {
	stdio: 'inherit',
})
if (syncResult.status !== 0) {
	process.stderr.write(`bump: sync-version failed (exit ${syncResult.status ?? 'unknown'})\n`)
	process.exit(1)
}

// Promote CHANGELOG
const newUnreleased = `## [Unreleased]\n\n### Breaking\n- (none)\n\n### Added\n- (none)\n\n### Fixed\n- (none)\n\n`
const newRelease = `## [${newVersion}] - ${today()}${unreleasedBody}`
changelog = changelog.replace(/## \[Unreleased\][\s\S]*?(?=## \[|$)/, newUnreleased + newRelease)
writeFileSync(changelogPath, changelog, 'utf8')

process.stdout.write(`Bumped to v${newVersion}\n`)
