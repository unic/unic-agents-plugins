#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * setup-confluence.mjs — write ~/.unic-confluence.json with the user's
 * Confluence credentials. Pure file-writer: values arrive as CLI args; the
 * conversational prompting happens in commands/setup-confluence.md.
 */

import { chmodSync as realChmod, writeFileSync as realWriteFile } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * @typedef {Object} WriteDeps
 * @property {string} [homedir]
 * @property {string} [platform]
 * @property {(path: string, data: string, encoding: BufferEncoding) => void} [writeFile]
 * @property {(path: string, mode: number) => void} [chmod]
 * @property {(message: string) => void} [warn]
 */

/**
 * Write ~/.unic-confluence.json with the given credentials.
 *
 * @param {string} url
 * @param {string} username
 * @param {string} token
 * @param {WriteDeps} [deps]
 * @returns {{ path: string }}
 */
export function writeConfluenceCreds(url, username, token, deps = {}) {
	const home = deps.homedir ?? os.homedir()
	const platform = deps.platform ?? process.platform
	const write = deps.writeFile ?? realWriteFile
	const chmod = deps.chmod ?? realChmod
	const warn = deps.warn ?? ((m) => process.stderr.write(`${m}\n`))

	const path = join(home, '.unic-confluence.json')
	const data = JSON.stringify({ url, username, token }, null, 2)
	write(path, data, 'utf8')
	if (platform === 'win32') {
		warn(`Windows detected — skipping chmod 600 on ${path}. Restrict file access manually via NTFS permissions.`)
	} else {
		chmod(path, 0o600)
	}
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

/**
 * @param {string[]} args
 * @returns {Record<string, string>}
 */
function parseArgs(args) {
	/** @type {Record<string, string>} */
	const result = {}
	for (let i = 0; i < args.length; i++) {
		const m = args[i].match(/^--([^=]+)=(.*)$/)
		if (m) {
			result[m[1]] = m[2]
		} else if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
			result[args[i].slice(2)] = args[++i]
		}
	}
	return result
}

async function main() {
	const args = parseArgs(process.argv.slice(2))
	const { url, username, token } = args
	if (!url || !username || !token) {
		process.stderr.write('setup-confluence: --url, --username and --token are all required\n')
		process.exit(1)
	}
	const { path } = writeConfluenceCreds(url, username, token)
	process.stdout.write(`Written: ${path}\n`)
}

if (Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`setup-confluence: unexpected error: ${err?.stack ?? err?.message ?? err}\n`)
		process.exit(1)
	})
}
