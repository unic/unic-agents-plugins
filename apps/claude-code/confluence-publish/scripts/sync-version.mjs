#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Read the single source of truth
const pluginPath = path.join(root, '.claude-plugin/plugin.json')
/** @type {{ version: string, [key: string]: unknown }} */
let pluginJson
try {
	pluginJson = /** @type {{ version: string, [key: string]: unknown }} */ (JSON.parse(readFileSync(pluginPath, 'utf8')))
} catch (err) {
	console.error(`sync-version: cannot read ${pluginPath}: ${/** @type {Error} */ (err).message}`)
	process.exit(1)
}

const version = pluginJson.version
if (!version || typeof version !== 'string') {
	console.error(`sync-version: .version is missing or not a string in ${pluginPath}`)
	process.exit(1)
}

// Write derived version into marketplace.json
const marketplacePath = path.join(root, '.claude-plugin/marketplace.json')
/** @type {{ plugins: Array<{ version: string, [key: string]: unknown }> }} */
let marketplace
try {
	marketplace = /** @type {{ plugins: Array<{ version: string, [key: string]: unknown }> }} */ (
		JSON.parse(readFileSync(marketplacePath, 'utf8'))
	)
} catch (err) {
	console.error(`sync-version: cannot read ${marketplacePath}: ${/** @type {Error} */ (err).message}`)
	process.exit(1)
}

if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
	console.error('sync-version: marketplace.json has no plugins[] array')
	process.exit(1)
}

const prev = marketplace.plugins[0].version
marketplace.plugins[0].version = version
writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, '\t')}\n`, 'utf8')

if (prev === version) {
	console.log(`sync-version: marketplace.json already at version ${version} (no change)`)
} else {
	console.log(`sync-version: marketplace.json updated ${prev} → ${version}`)
}
