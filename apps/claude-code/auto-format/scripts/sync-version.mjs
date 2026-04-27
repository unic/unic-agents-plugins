#!/usr/bin/env node
/**
 * pnpm sync-version
 * Reads the version from .claude-plugin/plugin.json (single source of truth)
 * and propagates it to .claude-plugin/marketplace.json and package.json.
 * Idempotent — safe to run multiple times.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

const pluginPath = resolve(ROOT, '.claude-plugin/plugin.json')
let pluginJson
try {
	pluginJson = JSON.parse(readFileSync(pluginPath, 'utf8'))
} catch (err) {
	process.stderr.write(`sync-version: cannot read ${pluginPath}: ${err.message}\n`)
	process.exit(1)
}

const version = pluginJson.version
if (!version || typeof version !== 'string') {
	process.stderr.write(`sync-version: .version is missing or not a string in ${pluginPath}\n`)
	process.exit(1)
}

/**
 * Update version in a JSON file. Logs the transition (or no-op).
 * @param {string} filePath  Absolute path to the JSON file.
 */
function syncFile(filePath) {
	let obj
	try {
		obj = JSON.parse(readFileSync(filePath, 'utf8'))
	} catch (err) {
		process.stderr.write(`sync-version: cannot read ${filePath}: ${err.message}\n`)
		process.exit(1)
	}
	const rel = filePath.slice(ROOT.length + 1)
	const prev = obj.version
	if (prev === version) {
		process.stdout.write(`sync-version: ${rel} already at ${version} (no change)\n`)
		return
	}
	obj.version = version
	writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8')
	process.stdout.write(`sync-version: ${rel} updated ${prev} → ${version}\n`)
}

syncFile(resolve(ROOT, '.claude-plugin/marketplace.json'))
syncFile(resolve(ROOT, 'package.json'))
