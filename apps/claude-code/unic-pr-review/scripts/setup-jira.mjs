#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * setup-jira.mjs — add or update the `jiraUrl` field in the existing
 * ~/.unic-confluence.json. ADR-0001 stores Jira and Confluence credentials
 * together because they share an Atlassian API token.
 *
 * The Confluence credential file MUST already exist; the slash command
 * (commands/setup-jira.md) prompts the user to run :setup-confluence first
 * when it is missing. The script throws a descriptive error in that case.
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
 * Add or update the `jiraUrl` field in ~/.unic-confluence.json, preserving all
 * other fields. Idempotent: returns `noOp: true` when the value is unchanged.
 *
 * @param {string} jiraUrl
 * @param {WriteDeps} [deps]
 * @returns {{ path: string, noOp: boolean }}
 */
export function writeJiraUrl(jiraUrl, deps = {}) {
	const home = deps.homedir ?? os.homedir()
	const platform = deps.platform ?? process.platform
	const exists = deps.exists ?? realExistsSync
	const read = deps.readFile ?? realReadFile
	const write = deps.writeFile ?? realWriteFile
	const rename = deps.rename ?? realRename
	const chmod = deps.chmod ?? realChmod
	const warn = deps.warn ?? ((m) => process.stderr.write(`${m}\n`))

	const path = join(home, '.unic-confluence.json')
	if (!exists(path)) {
		throw new Error(`${path} not found. Run /unic-pr-review:setup-confluence first.`)
	}
	const raw = read(path, 'utf8')
	let existing
	try {
		existing = JSON.parse(raw)
	} catch (err) {
		throw new Error(`${path} contains invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
	}
	if (existing?.jiraUrl === jiraUrl) {
		return { path, noOp: true }
	}
	const updated = { ...existing, jiraUrl }
	const tmp = `${path}.tmp`
	write(tmp, JSON.stringify(updated, null, 2), 'utf8')
	if (platform === 'win32') {
		warn(`Windows detected — skipping chmod 600 on ${path}. Restrict file access manually via NTFS permissions.`)
	} else {
		chmod(tmp, 0o600)
	}
	rename(tmp, path)
	return { path, noOp: false }
}

/**
 * True when JIRA_URL is set.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isJiraEnvConfigured(env) {
	return Boolean(env.JIRA_URL)
}

async function main() {
	let args
	try {
		args = parseArgs(process.argv.slice(2))
	} catch (err) {
		process.stderr.write(`setup-jira: ${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	}
	const { jiraUrl } = args
	if (!jiraUrl) {
		process.stderr.write('setup-jira: --jiraUrl is required\n')
		process.exit(1)
	}
	const { path, noOp } = writeJiraUrl(jiraUrl)
	process.stdout.write(noOp ? `Unchanged: ${path}\n` : `Updated: ${path}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`setup-jira: unexpected error: ${err?.stack ?? err?.message ?? err}\n`)
		process.exit(1)
	})
}
