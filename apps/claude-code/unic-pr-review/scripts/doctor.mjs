#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check

import { spawnSync } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { loadAllCredentials } from './lib/credentials.mjs'

/**
 * @typedef {{ status: number | null, error?: Error }} SpawnResult
 * @typedef {(cmd: string, args: string[]) => SpawnResult} SpawnFn
 * @typedef {(url: string) => Promise<{ ok: boolean, status?: number }>} PingFn
 * @typedef {{ spawn?: SpawnFn, ping?: PingFn, loadCreds?: () => import('./lib/credentials.mjs').AllCredentials }} DoctorDeps
 */

/** @type {SpawnFn} */
function defaultSpawn(cmd, args) {
	const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 10_000 })
	return { status: result.status, error: result.error }
}

/** @type {PingFn} */
function defaultPing(url) {
	return new Promise((resolve) => {
		let parsed
		try {
			parsed = new URL(url)
		} catch {
			resolve({ ok: false })
			return
		}
		const mod = parsed.protocol === 'https:' ? https : http
		const req = mod.request(
			{
				method: 'HEAD',
				hostname: parsed.hostname,
				path: parsed.pathname || '/',
				port: parsed.port || undefined,
			},
			(res) => {
				res.resume()
				resolve({ ok: true, status: res.statusCode })
			}
		)
		req.on('error', () => resolve({ ok: false }))
		req.setTimeout(8_000, () => {
			req.destroy()
			resolve({ ok: false })
		})
		req.end()
	})
}

// ── Individual check predicates ────────────────────────────────────────────────

/**
 * @param {SpawnFn} spawn
 * @returns {boolean}
 */
export function checkAzCli(spawn) {
	const r = spawn('az', ['--version'])
	if (r.status !== 0 || r.error) {
		process.stderr.write(
			'✗ az CLI not found on PATH. Install from https://learn.microsoft.com/cli/azure/install-azure-cli\n'
		)
		return false
	}
	process.stdout.write('✓ az CLI found\n')
	return true
}

/**
 * @param {SpawnFn} spawn
 * @returns {boolean}
 */
export function checkAzureDevopsExtension(spawn) {
	const r = spawn('az', ['extension', 'show', '--name', 'azure-devops'])
	if (r.status !== 0 || r.error) {
		process.stderr.write('✗ azure-devops extension not installed. Run: az extension add --name azure-devops\n')
		return false
	}
	process.stdout.write('✓ azure-devops extension installed\n')
	return true
}

/**
 * @param {SpawnFn} spawn
 * @returns {boolean}
 */
export function checkAzDevopsLogin(spawn) {
	const r = spawn('az', ['account', 'show'])
	if (r.status !== 0 || r.error) {
		process.stderr.write('✗ az devops login not valid. Run: az login\n')
		return false
	}
	process.stdout.write('✓ az devops login valid\n')
	return true
}

/**
 * Checks and pre-warms the identity cache per ADR-0006.
 *
 * @param {SpawnFn} spawn
 * @returns {boolean}
 */
export function checkAzDevopsUserShow(spawn) {
	const r = spawn('az', ['devops', 'user', 'show', '--user', 'me'])
	if (r.status !== 0 || r.error) {
		process.stderr.write(
			'✗ az devops user show --user me failed. Ensure az devops configure --defaults organization=<url> is set.\n'
		)
		return false
	}
	process.stdout.write('✓ az devops identity pre-warmed\n')
	return true
}

/**
 * @param {PingFn} ping
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function checkConfluenceReachable(ping, url) {
	const result = await ping(url)
	if (!result.ok) {
		process.stderr.write(`✗ Confluence unreachable at ${url}. Check CONFLUENCE_URL or ~/.unic-confluence.json\n`)
		return false
	}
	process.stdout.write(`✓ Confluence reachable (HTTP ${result.status ?? '?'})\n`)
	return true
}

/**
 * Silent when jiraUrl is null (per ADR-0004).
 *
 * @param {PingFn} ping
 * @param {string | null} jiraUrl
 * @returns {Promise<boolean>}
 */
export async function checkJiraReachable(ping, jiraUrl) {
	if (!jiraUrl) return true
	const result = await ping(jiraUrl)
	if (!result.ok) {
		process.stderr.write(`✗ Jira unreachable at ${jiraUrl}. Check JIRA_URL or jiraUrl in ~/.unic-confluence.json\n`)
		return false
	}
	process.stdout.write(`✓ Jira reachable (HTTP ${result.status ?? '?'})\n`)
	return true
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

/**
 * Runs every preflight check and returns true only when all critical checks pass.
 * Every check runs unconditionally so the user sees all failures in one pass.
 *
 * @param {DoctorDeps} [deps]
 * @returns {Promise<boolean>}
 */
export async function runDoctor(deps = {}) {
	const spawn = deps.spawn ?? defaultSpawn
	const ping = deps.ping ?? defaultPing
	const creds = (deps.loadCreds ?? loadAllCredentials)()

	const azOk = checkAzCli(spawn)
	const extOk = checkAzureDevopsExtension(spawn)
	const loginOk = checkAzDevopsLogin(spawn)
	const userOk = checkAzDevopsUserShow(spawn)

	let confluenceOk
	if (creds.confluence) {
		confluenceOk = await checkConfluenceReachable(ping, creds.confluence.url)
	} else {
		process.stderr.write(
			'✗ Confluence credentials not configured. Add ~/.unic-confluence.json or set CONFLUENCE_URL/CONFLUENCE_USER/CONFLUENCE_TOKEN\n'
		)
		confluenceOk = false
	}

	const jiraOk = await checkJiraReachable(ping, creds.jira?.url ?? null)

	return azOk && extOk && loginOk && userOk && confluenceOk && jiraOk
}

// Entry point when run directly
const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] === thisFile) {
	runDoctor().then((ok) => {
		process.exit(ok ? 0 : 1)
	})
}
