#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * setup-confluence.mjs — write ~/.unic-confluence.json with the user's
 * Confluence credentials. Pure file-writer: values arrive as CLI args; the
 * conversational prompting happens in commands/setup-confluence.md.
 */

import {
	chmodSync as realChmod,
	existsSync as realExistsSync,
	readFileSync as realReadFile,
	renameSync as realRename,
	writeFileSync as realWriteFile,
} from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from './lib/args.mjs'

/**
 * @typedef {Object} WriteDeps
 * @property {string} [homedir]
 * @property {string} [platform]
 * @property {(path: string) => boolean} [exists]
 * @property {(path: string, encoding: BufferEncoding) => string} [readFile]
 * @property {(path: string, data: string, encoding: BufferEncoding) => void} [writeFile]
 * @property {(oldPath: string, newPath: string) => void} [rename]
 * @property {(path: string, mode: number) => void} [chmod]
 * @property {(message: string) => void} [warn]
 */

/**
 * Write ~/.unic-confluence.json with the given credentials. Preserves any
 * existing fields (e.g. `jiraUrl` from :setup-jira) so re-running to rotate
 * a token does not silently drop data. If the existing file is unparseable
 * the writer warns and overwrites; non-syntax read errors (EACCES, etc.)
 * propagate so callers can surface them rather than silently losing data.
 *
 * @param {string} url
 * @param {string} username
 * @param {string} token
 * @param {WriteDeps} [deps]
 * @returns {{ path: string }}
 */
export function writeConfluenceCreds(url, username, token, deps = {}) {
	const home = deps.homedir ?? os.homedir()
	if (!home) throw new Error('could not determine home directory (HOME / USERPROFILE unset)')
	const platform = deps.platform ?? process.platform
	const exists = deps.exists ?? realExistsSync
	const read = deps.readFile ?? realReadFile
	const write = deps.writeFile ?? realWriteFile
	const rename = deps.rename ?? realRename
	const chmod = deps.chmod ?? realChmod
	const warn = deps.warn ?? ((m) => process.stderr.write(`${m}\n`))

	const path = join(home, '.unic-confluence.json')
	let preserved = {}
	if (exists(path)) {
		const raw = read(path, 'utf8')
		try {
			const existing = JSON.parse(raw)
			if (existing && typeof existing === 'object') preserved = existing
		} catch (err) {
			if (!(err instanceof SyntaxError)) throw err
			warn(`${path} contains invalid JSON — overwriting (any prior jiraUrl will be lost).`)
		}
	}
	const payload = { ...preserved, url, username, token }
	const tmp = `${path}.tmp`
	write(tmp, JSON.stringify(payload, null, 2), 'utf8')
	if (platform === 'win32') {
		warn(
			`Windows detected — skipping chmod 600 on ${path}. Restrict file access manually, e.g.:\n  icacls "${path}" /inheritance:r /grant:r "%USERNAME%:F"`
		)
	} else {
		chmod(tmp, 0o600)
	}
	rename(tmp, path)
	return { path }
}

/**
 * True when CONFLUENCE_URL, CONFLUENCE_USER and CONFLUENCE_TOKEN are all set.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isEnvConfigured(env) {
	return Boolean(env.CONFLUENCE_URL && env.CONFLUENCE_USER && env.CONFLUENCE_TOKEN)
}

async function main() {
	let args
	try {
		args = parseArgs(process.argv.slice(2))
	} catch (err) {
		process.stderr.write(`setup-confluence: ${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	}
	const { url, username, token } = args
	if (!url || !username || !token) {
		process.stderr.write('setup-confluence: --url, --username and --token are all required\n')
		process.exit(1)
	}
	const { path } = writeConfluenceCreds(url, username, token)
	process.stdout.write(`Written: ${path}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`setup-confluence: unexpected error: ${err?.stack ?? err?.message ?? String(err)}\n`)
		process.exit(1)
	})
}
