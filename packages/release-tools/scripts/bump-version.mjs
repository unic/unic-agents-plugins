#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CliError } from './lib/errors.mjs'
import { isWindows, pnpmBin } from './lib/platform.mjs'

const TYPES = /** @type {const} */ (['patch', 'minor', 'major'])
const type = process.argv[2]

try {
	if (!TYPES.includes(/** @type {any} */ (type))) {
		throw new CliError('Usage: pnpm bump <patch|minor|major>')
	}

	const statusResult = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
	if (statusResult.status !== 0) {
		throw new CliError(`bump: could not run git status (exit ${statusResult.status ?? 'unknown'})`)
	}
	if (statusResult.stdout && statusResult.stdout.trim().length > 0) {
		throw new CliError('bump: working tree is dirty — commit or stash changes before bumping')
	}

	const root = process.cwd()
	const pluginPath = path.join(root, '.claude-plugin/plugin.json')
	const changelogPath = path.join(root, 'CHANGELOG.md')

	/** @type {{ version: string, [key: string]: unknown }} */
	let pluginJson
	try {
		pluginJson = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, 'utf8')))
	} catch (err) {
		throw new CliError(`bump: cannot read ${pluginPath}: ${/** @type {Error} */ (err).message}`)
	}

	const version = pluginJson.version
	if (!version || typeof version !== 'string') {
		throw new CliError(`bump: .version is missing or not a string in ${pluginPath}`)
	}

	const parts = version.split('.')
	if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
		throw new CliError(`bump: cannot parse version "${version}" — expected X.Y.Z`)
	}
	let [major, minor, patch] = parts.map(Number)
	if (type === 'major') {
		major++
		minor = 0
		patch = 0
	} else if (type === 'minor') {
		minor++
		patch = 0
	} else {
		patch++
	}
	const nextVersion = `${major}.${minor}.${patch}`

	let changelog
	try {
		changelog = readFileSync(changelogPath, 'utf8')
	} catch (err) {
		throw new CliError(`bump: cannot read ${changelogPath}: ${/** @type {Error} */ (err).message}`)
	}

	const unreleasedMatch = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[)/)
	if (!unreleasedMatch) {
		throw new CliError('bump: no ## [Unreleased] section found in CHANGELOG.md')
	}

	const unreleasedBody = unreleasedMatch[1]
	const hasRealEntry = unreleasedBody
		.split('\n')
		.filter((l) => l.startsWith('- '))
		.some((l) => l !== '- (none)')
	if (!hasRealEntry) {
		throw new CliError('bump: [Unreleased] has no entries — add a CHANGELOG entry before bumping')
	}

	pluginJson.version = nextVersion
	writeFileSync(pluginPath, `${JSON.stringify(pluginJson, null, 2)}\n`, 'utf8')

	const today = new Date().toISOString().slice(0, 10)
	const emptyUnreleased = '## [Unreleased]\n\n### Breaking\n- (none)\n\n### Added\n- (none)\n\n### Fixed\n- (none)'
	const newChangelog = changelog.replace(
		/## \[Unreleased\]([\s\S]*?)(?=\n## \[)/,
		`${emptyUnreleased}\n\n## [${nextVersion}] — ${today}$1`
	)
	writeFileSync(changelogPath, newChangelog, 'utf8')

	const syncScript = fileURLToPath(new URL('./sync-version.mjs', import.meta.url))
	const syncResult = spawnSync('node', [syncScript], { stdio: 'inherit' })
	if (syncResult.status !== 0) {
		throw new CliError(`bump: sync-version failed (exit ${syncResult.status ?? 'unknown'})`)
	}

	const biomeResult = spawnSync(
		pnpmBin(),
		['biome', 'format', '--write', pluginPath, path.join(root, '.claude-plugin/marketplace.json')],
		{ stdio: 'inherit', cwd: root, shell: isWindows }
	)
	if (biomeResult.status !== 0) {
		throw new CliError(`bump: biome format failed (exit ${biomeResult.status ?? 'unknown'})`)
	}

	console.log(`bump: ${version} → ${nextVersion}`)
} catch (err) {
	if (err instanceof CliError) {
		console.error(err.message)
		process.exit(err.exitCode)
	}
	throw err
}
