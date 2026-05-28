#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * doctor.mjs — preflight checks for unic-pr-review prerequisites.
 *
 * Six checks run sequentially:
 *   1. az CLI on PATH
 *   2. azure-devops extension installed
 *   3. az devops session valid (project list)
 *   4. az devops user show --user me resolves (identity caching — ADR-0006)
 *   5. Confluence reachable
 *   6. Jira reachable (silent when jiraUrl is unset — US 35)
 *
 * Each predicate accepts an injectable executor (for az) or fetcher (for HTTP)
 * so unit tests can stub them without mocking node:child_process or globalThis.
 */

import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { loadAtlassianCreds } from './lib/credentials.mjs'

/** @import { AtlassianCreds } from './lib/credentials.mjs' */

/**
 * @typedef {Object} ExecResult
 * @property {boolean} ok
 * @property {string} stdout
 * @property {string} stderr
 */

/**
 * @typedef {(cmd: string, args: string[]) => ExecResult} Exec
 */

/**
 * @typedef {Object} PingResult
 * @property {boolean} ok
 * @property {number} status
 * @property {string} [error] - set when the request threw synchronously (e.g. invalid URL or wrong scheme)
 */

/**
 * @typedef {(url: string, headers: Record<string, string>) => Promise<PingResult>} Ping
 */

/**
 * @typedef {Object} CheckResult
 * @property {boolean} ok
 * @property {string} detail
 * @property {boolean} [skipped]
 */

const AZ = process.platform === 'win32' ? 'az.cmd' : 'az'

/**
 * Predicate: `az` CLI is on PATH and runs.
 * @param {Exec} exec
 * @returns {CheckResult}
 */
export function checkAzCli(exec) {
	const r = exec(AZ, ['--version'])
	if (!r.ok) {
		return { ok: false, detail: 'az CLI not found on PATH' }
	}
	const firstLine = (r.stdout.split(/\r?\n/, 1)[0] || '').trim()
	return { ok: true, detail: firstLine || 'az CLI available' }
}

/**
 * Predicate: the `azure-devops` extension is installed.
 * @param {Exec} exec
 * @returns {CheckResult}
 */
export function checkAzExtension(exec) {
	const r = exec(AZ, ['extension', 'list', '--output', 'json'])
	if (!r.ok) {
		return { ok: false, detail: 'unable to list az extensions' }
	}
	let parsed
	try {
		parsed = JSON.parse(r.stdout || '[]')
	} catch (err) {
		return {
			ok: false,
			detail: `az extension list returned invalid JSON (${err instanceof Error ? err.message : String(err)})`,
		}
	}
	if (!Array.isArray(parsed)) {
		return { ok: false, detail: 'az extension list did not return an array' }
	}
	const ext = parsed.find((x) => x && x.name === 'azure-devops')
	if (!ext) {
		return { ok: false, detail: 'azure-devops extension is not installed (run: az extension add --name azure-devops)' }
	}
	return { ok: true, detail: `azure-devops extension installed${ext.version ? ` (${ext.version})` : ''}` }
}

/**
 * Predicate: an `az devops` login is valid (project list succeeds).
 * @param {Exec} exec
 * @returns {CheckResult}
 */
export function checkAzLogin(exec) {
	const r = exec(AZ, ['devops', 'project', 'list', '--detect', '--output', 'json'])
	if (!r.ok) {
		return { ok: false, detail: 'az devops session is not valid (run: az devops login --org <your-org-url>)' }
	}
	return { ok: true, detail: 'az devops session valid' }
}

/**
 * Predicate: `az devops user show --user me` resolves with a user id.
 * ADR-0006 requires the caller's identity to be resolvable before
 * iteration data can be cached against it.
 * @param {Exec} exec
 * @returns {CheckResult}
 */
export function checkAzIdentity(exec) {
	const r = exec(AZ, ['devops', 'user', 'show', '--user', 'me', '--output', 'json'])
	if (!r.ok) {
		return { ok: false, detail: 'az devops user show --user me failed (identity caching will not work)' }
	}
	let parsed
	try {
		parsed = JSON.parse(r.stdout || '{}')
	} catch (err) {
		return {
			ok: false,
			detail: `az devops user show returned invalid JSON (${err instanceof Error ? err.message : String(err)})`,
		}
	}
	if (!parsed || typeof parsed.id !== 'string' || parsed.id.length === 0) {
		return { ok: false, detail: 'az devops user show resolved but no user id field is present' }
	}
	const label = parsed.emailAddress || parsed.principalName || parsed.id
	return { ok: true, detail: `identity resolves (${label})` }
}

/**
 * Predicate: Confluence is reachable with the configured credentials.
 * @param {AtlassianCreds} creds
 * @param {Ping} ping
 * @returns {Promise<CheckResult>}
 */
export async function checkConfluence(creds, ping) {
	const host = safeHost(creds.url)
	const url = `${stripTrailingSlash(creds.url)}/wiki/rest/api/space?limit=1`
	const headers = { Authorization: basicAuth(creds.username, creds.token), Accept: 'application/json' }
	const r = await ping(url, headers)
	if (!r.ok) {
		const detail = r.error
			? `Confluence ${host} request failed: ${r.error}`
			: `Confluence ${host} returned HTTP ${r.status}`
		return { ok: false, detail }
	}
	return { ok: true, detail: `Confluence reachable (${host})` }
}

/**
 * Predicate: Jira is reachable. Returns ok:true with skipped:true when no
 * `jiraUrl` is configured — US 35 requires doctor to stay silent in that case.
 * @param {AtlassianCreds} creds
 * @param {Ping} ping
 * @returns {Promise<CheckResult>}
 */
export async function checkJira(creds, ping) {
	if (!creds.jiraUrl) {
		return { ok: true, detail: 'Jira not configured — skipped', skipped: true }
	}
	const host = safeHost(creds.jiraUrl)
	const url = `${stripTrailingSlash(creds.jiraUrl)}/rest/api/3/myself`
	const headers = { Authorization: basicAuth(creds.username, creds.token), Accept: 'application/json' }
	const r = await ping(url, headers)
	if (!r.ok) {
		const detail = r.error ? `Jira ${host} request failed: ${r.error}` : `Jira ${host} returned HTTP ${r.status}`
		return { ok: false, detail }
	}
	return { ok: true, detail: `Jira reachable (${host})` }
}

/**
 * @param {string} u
 */
function stripTrailingSlash(u) {
	return u.endsWith('/') ? u.slice(0, -1) : u
}

/**
 * @param {string} u
 */
function safeHost(u) {
	try {
		return new URL(u).host
	} catch {
		return u
	}
}

/**
 * @param {string} user
 * @param {string} token
 */
function basicAuth(user, token) {
	return `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`
}

/**
 * Default executor: wraps spawnSync.
 * @type {Exec}
 */
function realExec(cmd, args) {
	const r = spawnSync(cmd, args, { encoding: 'utf8' })
	return { ok: r.status === 0 && r.error == null, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

/**
 * Default fetcher: GET via global fetch with a 10 s timeout (ADR-0005).
 * Handles both https:// and http:// URLs; surfaces synchronous errors in the
 * optional `error` field so callers can show an actionable message.
 *
 * Exported for unit testing of synchronous error paths (e.g. malformed URL).
 * @internal
 * @type {Ping}
 */
export function realPing(url, headers) {
	return fetch(url, {
		method: 'GET',
		headers,
		signal: AbortSignal.timeout(10_000),
	})
		.then((res) => ({ ok: res.status >= 200 && res.status < 300, status: res.status }))
		.catch((err) => ({ ok: false, status: 0, error: err instanceof Error ? err.message : String(err) }))
}

/**
 * @param {CheckResult} result
 * @param {string} label
 * @returns {string}
 */
function formatLine(result, label) {
	let glyph = '✗'
	if (result.skipped) glyph = '○'
	else if (result.ok) glyph = '✓'
	return `${glyph} ${label} — ${result.detail}`
}

/**
 * @typedef {Object} RunDoctorDeps
 * @property {Exec} [exec]
 * @property {Ping} [ping]
 * @property {() => (AtlassianCreds|null)} [loadCreds]
 */

/**
 * Execute all preflight checks and return the rendered output + overall status.
 * Exported so unit tests can drive main() with stubbed dependencies.
 * @internal
 * @param {RunDoctorDeps} [deps]
 * @returns {Promise<{ok: boolean, output: string }>}
 */
export async function runDoctor(deps = {}) {
	const exec = deps.exec ?? realExec
	const ping = deps.ping ?? realPing
	const loadCreds = deps.loadCreds ?? (() => loadAtlassianCreds())

	const lines = []
	lines.push('unic-pr-review doctor')
	lines.push('─────────────────────────────────')

	let allOk = true

	const az = checkAzCli(exec)
	lines.push(formatLine(az, 'az CLI'))
	if (!az.ok) allOk = false

	if (az.ok) {
		const ext = checkAzExtension(exec)
		lines.push(formatLine(ext, 'azure-devops extension'))
		if (!ext.ok) allOk = false

		if (ext.ok) {
			const login = checkAzLogin(exec)
			lines.push(formatLine(login, 'az devops session'))
			if (!login.ok) allOk = false

			if (login.ok) {
				const ident = checkAzIdentity(exec)
				lines.push(formatLine(ident, 'az devops identity'))
				if (!ident.ok) allOk = false
			}
		}
	}

	let creds = null
	let credsLoadError = null
	try {
		creds = loadCreds()
	} catch (err) {
		credsLoadError = err instanceof Error ? err.message : String(err)
	}

	if (credsLoadError) {
		lines.push(`✗ Atlassian credentials — credential file unreadable: ${credsLoadError}`)
		allOk = false
	} else if (!creds) {
		lines.push('✗ Atlassian credentials — neither env vars nor ~/.unic-confluence.json found')
		allOk = false
	} else {
		const conf = await checkConfluence(creds, ping)
		lines.push(formatLine(conf, 'Confluence'))
		if (!conf.ok) allOk = false

		if (creds.jiraUrl) {
			const jira = await checkJira(creds, ping)
			lines.push(formatLine(jira, 'Jira'))
			if (!jira.ok) allOk = false
		}
	}

	lines.push('─────────────────────────────────')
	lines.push(allOk ? 'All checks passed.' : 'One or more checks failed — see lines marked ✗ above.')

	return { ok: allOk, output: `${lines.join('\n')}\n` }
}

async function main() {
	const { ok, output } = await runDoctor()
	process.stdout.write(output)
	process.exit(ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`doctor: unexpected error: ${err?.stack ?? err?.message ?? err}\n`)
		process.exit(1)
	})
}
