#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * setup-azure.mjs — write ~/.unic-azure.json with the user's Azure DevOps
 * credentials. Pure file-writer: values arrive as CLI args; the conversational
 * prompting happens in commands/setup-azure.md.
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
 * Write ~/.unic-azure.json with the given credentials.
 *
 * @param {string} orgUrl
 * @param {string} pat
 * @param {WriteDeps} [deps]
 * @returns {{ path: string }}
 */
export function writeAzureCreds(orgUrl, pat, deps = {}) {
	const home = deps.homedir ?? os.homedir()
	const platform = deps.platform ?? process.platform
	const write = deps.writeFile ?? realWriteFile
	const chmod = deps.chmod ?? realChmod
	const warn = deps.warn ?? ((m) => process.stderr.write(`${m}\n`))

	const path = join(home, '.unic-azure.json')
	const data = JSON.stringify({ orgUrl, pat }, null, 2)
	write(path, data, 'utf8')
	if (platform === 'win32') {
		warn(`Windows detected — skipping chmod 600 on ${path}. Restrict file access manually via NTFS permissions.`)
	} else {
		chmod(path, 0o600)
	}
	return { path }
}

/**
 * True when AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PAT are both set.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isAzureEnvConfigured(env) {
	return Boolean(env.AZURE_DEVOPS_ORG_URL && env.AZURE_DEVOPS_PAT)
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
	const { orgUrl, pat } = args
	if (!orgUrl || !pat) {
		process.stderr.write('setup-azure: --orgUrl and --pat are both required\n')
		process.exit(1)
	}
	const { path } = writeAzureCreds(orgUrl, pat)
	process.stdout.write(`Written: ${path}\n`)
}

if (Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`setup-azure: unexpected error: ${err?.stack ?? err?.message ?? err}\n`)
		process.exit(1)
	})
}
