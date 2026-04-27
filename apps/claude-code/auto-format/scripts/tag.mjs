#!/usr/bin/env node
/**
 * pnpm tag
 * Tags the current commit with v<version> from .claude-plugin/plugin.json.
 * Runs sync-version first (idempotent safety check).
 * Does not push — run: git push --follow-tags
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

const pluginPath = resolve(ROOT, '.claude-plugin/plugin.json')
let pluginJson
try {
	pluginJson = JSON.parse(readFileSync(pluginPath, 'utf8'))
} catch (err) {
	process.stderr.write(`tag: cannot read ${pluginPath}: ${err.message}\n`)
	process.exit(1)
}

const version = pluginJson.version
if (!version || typeof version !== 'string') {
	process.stderr.write(`tag: .version is missing or not a string in ${pluginPath}\n`)
	process.exit(1)
}

// Safety sync before tagging (idempotent)
spawnSync('node', [resolve(ROOT, 'scripts/sync-version.mjs')], { stdio: 'inherit' })

const tagResult = spawnSync('git', ['tag', `v${version}`], { stdio: 'inherit' })
if (tagResult.status !== 0) {
	process.stderr.write(`tag: git tag failed — v${version} may already exist\n`)
	process.exit(1)
}

process.stdout.write(`Tagged v${version}. Run: git push --follow-tags\n`)
