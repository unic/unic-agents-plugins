#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * spec-doctor.mjs — Confluence credential + connectivity preflight for
 * unic-spec-review.
 *
 * This script covers only the parts of the preflight that can run inside a
 * Node.js subprocess: that Atlassian credentials load, and that Confluence is
 * reachable via Basic auth. The Figma Dev Mode MCP and Playwright MCP checks
 * cannot be observed from a subprocess and are performed by the command
 * orchestrator (commands/spec-doctor.md).
 *
 * The Confluence predicate accepts an injectable fetcher (Ping) so unit tests
 * can stub it without mocking global fetch.
 */

import { Buffer } from 'node:buffer'
import { pathToFileURL } from 'node:url'
import { loadAtlassianCreds } from './lib/credentials.mjs'

/** @import { AtlassianCreds } from './lib/credentials.mjs' */

/**
 * Discriminated by `kind`:
 *   - 'http' — fetch resolved; `status` is the HTTP response code.
 *   - 'transport-error' — fetch rejected (invalid URL, wrong scheme, timeout,
 *     network error); `error` carries the failure message.
 *
 * @typedef {{ kind: 'http', status: number } | { kind: 'transport-error', error: string }} PingResult
 */

/**
 * @typedef {(url: string, headers: Record<string, string>) => Promise<PingResult>} Ping
 */

/**
 * @param {PingResult} r
 * @returns {boolean}
 */
function isPingOk(r) {
	return r.kind === 'http' && r.status >= 200 && r.status < 300
}

/**
 * @typedef {Object} CheckResult
 * @property {boolean} ok
 * @property {string} detail
 * @property {boolean} [skipped]
 */

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
	if (r.kind === 'transport-error') {
		return { ok: false, detail: `Confluence ${host} unreachable: ${r.error}` }
	}
	if (!isPingOk(r)) {
		return { ok: false, detail: `Confluence ${host} returned HTTP ${r.status}` }
	}
	return { ok: true, detail: `Confluence reachable (${host})` }
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

export const PING_TIMEOUT_MS = 10_000

/**
 * Map a fetch rejection to a human-readable error message. Recognises
 * `AbortSignal.timeout`'s `TimeoutError` and emits a friendly fixed message
 * so spec-doctor output stays consistent across Node versions.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function mapPingError(err) {
	if (err instanceof Error && err.name === 'TimeoutError') {
		return `Request timed out after ${PING_TIMEOUT_MS / 1000}s`
	}
	return err instanceof Error ? err.message : String(err)
}

/**
 * Default fetcher: GET via global fetch with a 10 s timeout. Handles both
 * https:// and http:// URLs. Returns the discriminated PingResult — an HTTP
 * result on resolution, a transport-error on any rejection (invalid URL,
 * wrong scheme, timeout, network error).
 *
 * Exported for unit testing of error paths (e.g. malformed URL, timeout).
 * @type {Ping}
 */
export function realPing(url, headers) {
	return fetch(url, {
		method: 'GET',
		headers,
		signal: AbortSignal.timeout(PING_TIMEOUT_MS),
	})
		.then((res) => /** @type {PingResult} */ ({ kind: 'http', status: res.status }))
		.catch((err) => /** @type {PingResult} */ ({ kind: 'transport-error', error: mapPingError(err) }))
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
 * @typedef {Object} RunSpecDoctorCredsDeps
 * @property {Ping} [ping]
 * @property {() => (AtlassianCreds|null)} [loadCreds]
 */

/**
 * Run the Confluence credential + connectivity checks and return the rendered
 * output + overall status. Exported so unit tests can inject stubs without
 * patching the module system.
 * @internal
 * @param {RunSpecDoctorCredsDeps} [deps]
 * @returns {Promise<{ok: boolean, output: string }>}
 */
export async function runSpecDoctorCredentials(deps = {}) {
	const ping = deps.ping ?? realPing
	const loadCreds = deps.loadCreds ?? loadAtlassianCreds

	const lines = []
	let allOk = true

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
	}

	if (creds) {
		const conf = await checkConfluence(creds, ping)
		lines.push(formatLine(conf, 'Confluence'))
		if (!conf.ok) allOk = false
	}

	return { ok: allOk, output: `${lines.join('\n')}\n` }
}

async function main() {
	const { ok, output } = await runSpecDoctorCredentials()
	process.stdout.write(output)
	process.exit(ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`spec-doctor: unexpected error: ${err?.stack ?? err?.message ?? String(err)}\n`)
		process.exit(1)
	})
}
