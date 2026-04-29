#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

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

// Mirror optional metadata fields from plugin.json into marketplace entry.
const MIRRORED_FIELDS = /** @type {const} */ (['license', 'homepage', 'keywords'])
for (const field of MIRRORED_FIELDS) {
	if (field in pluginJson) {
		marketplace.plugins[0][field] = pluginJson[field]
	}
}

writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, 'utf8')

if (prev === version) {
	console.log(`sync-version: marketplace.json already at version ${version} (no change)`)
} else {
	console.log(`sync-version: marketplace.json updated ${prev} → ${version}`)
}

// Mirror version into package.json if it exists
const pkgPath = path.join(root, 'package.json')
if (existsSync(pkgPath)) {
	/** @type {{ version?: string, [key: string]: unknown }} */
	let pkgJson
	try {
		pkgJson = /** @type {any} */ (JSON.parse(readFileSync(pkgPath, 'utf8')))
	} catch (err) {
		console.error(`sync-version: cannot read ${pkgPath}: ${/** @type {Error} */ (err).message}`)
		process.exit(1)
	}
	const pkgPrev = pkgJson.version
	pkgJson.version = version
	writeFileSync(pkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`, 'utf8')
	if (pkgPrev === version) {
		console.log(`sync-version: package.json already at version ${version} (no change)`)
	} else {
		console.log(`sync-version: package.json updated ${pkgPrev} → ${version}`)
	}
}
