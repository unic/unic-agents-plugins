#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CliError } from './lib/errors.mjs'
import { isWindows } from './lib/platform.mjs'

try {
	const root = process.cwd()
	const pluginPath = path.join(root, '.claude-plugin/plugin.json')

	/** @type {{ name: string, version: string }} */
	const pluginJson = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, 'utf8')))
	const version = pluginJson.version
	if (!version || typeof version !== 'string') {
		throw new CliError(`tag: .version missing in ${pluginPath}`)
	}
	const name = pluginJson.name
	if (!name || typeof name !== 'string') {
		throw new CliError(`tag: .name missing in ${pluginPath}`)
	}

	// Safety sync before tagging (idempotent). Assert success — a failed sync
	// means plugin.json and marketplace.json are out of sync; do not tag.
	const syncScript = fileURLToPath(new URL('./sync-version.mjs', import.meta.url))
	const syncResult = spawnSync('node', [syncScript], { stdio: 'inherit' })
	if (syncResult.status !== 0) {
		throw new CliError(`tag: sync-version failed (exit ${syncResult.status ?? 'unknown'}) — fix before tagging`)
	}

	const sign = Boolean(process.env.UNIC_SIGN_TAGS)
	const tagName = `${name}@${version}`
	const tagArgs = sign ? ['tag', '-s', tagName, '-m', `Release ${tagName}`] : ['tag', tagName]
	const tagResult = spawnSync('git', tagArgs, { stdio: 'inherit', shell: isWindows })
	if (tagResult.status !== 0) {
		throw new CliError(
			`tag: git tag failed — ${tagName} may already exist, or GPG key not configured (UNIC_SIGN_TAGS=${sign})`
		)
	}

	console.log(`Tagged ${tagName}. Run: git push --follow-tags`)
} catch (err) {
	if (err instanceof CliError) {
		console.error(err.message)
		process.exit(/** @type {CliError} */ (err).exitCode)
	}
	throw err
}
