#!/usr/bin/env node
/**
 * pnpm bump <patch|minor|major>
 * Atomically bumps version in package.json, plugin.json, marketplace.json
 * and promotes [Unreleased] in CHANGELOG.md.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'))
}

function writeJson(rel, obj) {
	writeFileSync(resolve(ROOT, rel), JSON.stringify(obj, null, '\t') + '\n', 'utf8')
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

const pkg = readJson('package.json')
const newVersion = bumpVersion(pkg.version, bumpType)

// Bump package.json
pkg.version = newVersion
writeJson('package.json', pkg)

// Bump .claude-plugin/plugin.json
const pluginJson = readJson('.claude-plugin/plugin.json')
pluginJson.version = newVersion
writeJson('.claude-plugin/plugin.json', pluginJson)

// Bump .claude-plugin/marketplace.json
const marketJson = readJson('.claude-plugin/marketplace.json')
marketJson.version = newVersion
writeJson('.claude-plugin/marketplace.json', marketJson)

// Promote CHANGELOG
const newUnreleased = `## [Unreleased]\n\n### Breaking\n- (none)\n\n### Added\n- (none)\n\n### Fixed\n- (none)\n\n`
const newRelease = `## [${newVersion}] - ${today()}${unreleasedBody}`
changelog = changelog.replace(/## \[Unreleased\][\s\S]*?(?=## \[|$)/, newUnreleased + newRelease)

writeFileSync(changelogPath, changelog, 'utf8')

process.stdout.write(`Bumped to v${newVersion}\n`)
