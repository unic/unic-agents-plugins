#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic
/**
 * push-to-confluence.mjs
 * Publishes a Markdown file to a Confluence page via the v2 API.
 *
 * Usage: npm run confluence -- {pageId} {file.md}
 */
/** @import { Credentials, HttpResponse, PageData } from './lib/types.mjs' */

import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { marked } from 'marked'
import { CliError } from './lib/errors.mjs'
import { stripFrontmatter } from './lib/frontmatter.mjs'
import { injectContent } from './lib/inject.mjs'
import {
	appendAlias,
	findAliasForId,
	listAliases,
	pickAvailableAlias,
	readPagesFile,
	writePagesFile,
} from './lib/pages-file.mjs'
import { isNumericId, resolvePageId } from './lib/resolve.mjs'
import { slugify } from './lib/slug.mjs'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ── Credential resolution ──────────────────────────────────────────────────────

/**
 * Loads Confluence credentials from environment variables or ~/.unic-confluence.json.
 * Throws CliError if credentials are not configured.
 *
 * @returns {Credentials}
 */
function loadCredentials() {
	const { CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN } = process.env

	if (CONFLUENCE_URL && CONFLUENCE_USER && CONFLUENCE_TOKEN) {
		return {
			url: CONFLUENCE_URL,
			username: CONFLUENCE_USER,
			token: CONFLUENCE_TOKEN,
		}
	}

	const credFile = path.join(os.homedir(), '.unic-confluence.json')
	if (existsSync(credFile)) {
		try {
			const raw = /** @type {Credentials} */ (JSON.parse(readFileSync(credFile, 'utf8')))
			if (raw.url && raw.username && raw.token) {
				return raw
			}
		} catch {
			// fall through to error below
		}
	}

	throw new CliError('Run `npm run confluence -- --setup` to configure credentials')
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

/**
 * @param {string} username
 * @param {string} token
 * @returns {string} Base64-encoded Basic auth header value.
 */
function makeBasicAuth(username, token) {
	return `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`
}

/**
 * Makes an HTTPS request and resolves with the status code and response body.
 * Rejects if the network is unreachable.
 *
 * @param {string} method - HTTP method ("GET" or "PUT").
 * @param {string} urlStr - Full HTTPS URL.
 * @param {string} authHeader - Authorization header value.
 * @param {object} [bodyObj] - Request body object, JSON-serialised if provided.
 * @returns {Promise<HttpResponse>}
 */
function httpsRequest(method, urlStr, authHeader, bodyObj) {
	return new Promise((resolve, reject) => {
		const parsed = new URL(urlStr)
		const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null
		const options = {
			method,
			hostname: parsed.hostname,
			path: parsed.pathname + parsed.search,
			headers: {
				Authorization: authHeader,
				'Content-Type': 'application/json',
				Accept: 'application/json',
				...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
			},
		}

		const req = https.request(options, (res) => {
			let data = ''
			res.on('data', (chunk) => {
				data += chunk
			})
			res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
		})

		req.setTimeout(30_000, () => {
			req.destroy(new Error('Request timed out after 30s — check VPN/network connectivity'))
		})

		req.on('error', (err) => {
			reject(err)
		})

		if (bodyStr) req.write(bodyStr)
		req.end()
	})
}

/**
 * Throws a CliError with a human-readable message for a non-2xx HTTP response.
 *
 * @param {number} status - HTTP status code.
 * @param {string} _title - Intentionally unused; signature kept for API compatibility.
 * @param {{ pageArg?: string, filePath?: string }} [opts] - Used to build the 409 retry hint.
 * @returns {never}
 */
function handleHttpError(status, _title, { pageArg = '', filePath = '' } = {}) {
	const retryHint = pageArg
		? `Retry with: pnpm confluence ${pageArg} ${filePath}`
		: 'Re-run the command with the current page version.'
	const messages = /** @type {Record<number, string>} */ ({
		401: 'API token rejected — generate a new one at https://id.atlassian.com → Security → API tokens (note: tokens created before 2025 may have expired)',
		403: 'Access denied — check that your API token has permission to read and write this page',
		404: 'Page ID not found — check confluence-pages.json or verify the page still exists',
		409: `Page was updated by someone else. ${retryHint}`,
	})
	const msg = messages[status] ?? `Unexpected response from Confluence (HTTP ${status}) — check VPN/network and retry`
	throw new CliError(msg)
}

// ── HTML post-processing ───────────────────────────────────────────────────────

/**
 * Rewrites <pre><code> blocks emitted by `marked` into Confluence storage-format
 * `ac:structured-macro ac:name="code"` elements so that syntax highlighting
 * and the copy-to-clipboard button work in Confluence.
 *
 * Known limitation: code blocks whose content contains the CDATA close sequence
 * `]]>` are not handled — this is exceptionally rare and can be addressed in a
 * follow-up if it surfaces.
 *
 * @param {string} html - HTML string as emitted by `marked`
 * @returns {string} HTML with <pre><code> blocks replaced by Confluence macros
 */
function postProcessHtml(html) {
	/** @param {string} str @returns {string} */
	function decodeEntities(str) {
		return str
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
	}

	return html.replace(/<pre><code(?:\s+class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_, lang, code) => {
		const rawCode = decodeEntities(code)
		const langParam = lang ? `\n  <ac:parameter ac:name="language">${lang}</ac:parameter>` : ''
		return `<ac:structured-macro ac:name="code">${langParam}\n  <ac:plain-text-body><![CDATA[${rawCode}]]></ac:plain-text-body>\n</ac:structured-macro>`
	})
}

// ── Verify flow ────────────────────────────────────────────────────────────────

async function runVerify() {
	const pagesPath = path.join(process.cwd(), 'confluence-pages.json')
	if (!existsSync(pagesPath)) {
		throw new CliError('confluence-pages.json not found — create it first')
	}

	/** @type {Record<string, unknown>} */
	let pages
	try {
		pages = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(pagesPath, 'utf8')))
	} catch {
		throw new CliError('invalid JSON in confluence-pages.json — check syntax')
	}

	const pageKeys = Object.keys(pages).filter((k) => k !== '_comment')
	console.log(`Verifying ${pageKeys.length} page(s): ${pageKeys.join(', ')}`)

	const { url: baseUrl, username, token } = loadCredentials()
	const authHeader = makeBasicAuth(username, token)

	const entries = Object.entries(pages).filter(([k]) => k !== '_comment')

	// Phase 1: synchronous ID validation — report all bad IDs before any network I/O.
	let hasErrors = false
	for (const [key, id] of entries) {
		if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
			console.error(
				`❌ ${key}: Invalid page ID in confluence-pages.json: ${JSON.stringify(id)} — must be a positive integer`
			)
			hasErrors = true
		}
	}
	if (hasErrors) {
		throw new CliError('Invalid page IDs found — fix confluence-pages.json', 1)
	}

	// Phase 2: fire all GETs concurrently.
	const results = await Promise.all(
		entries.map(async ([key, id]) => {
			const numId = /** @type {number} */ (id)
			const getUrl = `${baseUrl.replace(/\/$/, '')}/wiki/api/v2/pages/${numId}?body-format=storage`
			try {
				const res = await httpsRequest('GET', getUrl, authHeader)
				if (res.status === 200) {
					const pageData = /** @type {{ title?: string }} */ (JSON.parse(res.body))
					return {
						ok: true,
						key,
						id: numId,
						title: pageData.title,
						networkError: false,
						status: 200,
					}
				}
				return {
					ok: false,
					key,
					id: numId,
					title: undefined,
					networkError: false,
					status: res.status,
				}
			} catch {
				return { ok: false, key, id: numId, title: undefined, networkError: true, status: 0 }
			}
		})
	)

	// Phase 3: print results in confluence-pages.json key order.
	for (const r of results) {
		if (r.ok) {
			console.log(`✅ ${r.key} (${r.id}): ${r.title}`)
		} else if (r.networkError) {
			console.error(`⚠️  ${r.key} (${r.id}): Network error`)
			hasErrors = true
		} else if (r.status === 404) {
			console.error(`❌ ${r.key} (${r.id}): Page not found — 404`)
			hasErrors = true
		} else {
			console.error(`⚠️  ${r.key} (${r.id}): Unexpected HTTP ${r.status}`)
			hasErrors = true
		}
	}

	if (hasErrors) {
		throw new CliError('One or more pages failed verification — see errors above', 1)
	}
}

// ── Setup flow ─────────────────────────────────────────────────────────────────

async function runSetup() {
	if (!process.stdin.isTTY) {
		throw new CliError('--setup requires an interactive terminal')
	}

	const credPath = path.join(os.homedir(), '.unic-confluence.json')
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	const question = (/** @type {string} */ prompt) => new Promise((resolve) => rl.question(prompt, resolve))

	/** @type {{ url?: string, username?: string, token?: string } | null} */
	let existing = null
	if (existsSync(credPath)) {
		try {
			existing = /** @type {{ url?: string, username?: string, token?: string }} */ (
				JSON.parse(readFileSync(credPath, 'utf8'))
			)
		} catch {
			// ignore
		}
	}

	if (existing?.username) {
		const answer = await question(`Credentials already configured for ${existing.username}. Overwrite? (y/n): `)
		if (/** @type {string} */ (answer).trim().toLowerCase() !== 'y') {
			console.log('Aborted.')
			rl.close()
			process.exit(0)
		}
	}

	const defaultUrl = existing?.url ?? 'https://uniccom.atlassian.net'
	const urlInput = await question(`Confluence URL [${defaultUrl}]: `)
	const url = /** @type {string} */ (urlInput).trim() || defaultUrl

	const userInput = await question(`Email${existing?.username ? ` [${existing.username}]` : ''}: `)
	const username = /** @type {string} */ (userInput).trim() || existing?.username || ''

	const tokenInput = await question('API token (Note: tokens created before 2025 may have expired): ')
	const token = /** @type {string} */ (tokenInput).trim()

	rl.close()

	if (!username || !token) {
		throw new CliError('Username and API token are required.')
	}

	const creds = { url, username, token }
	writeFileSync(credPath, JSON.stringify(creds, null, 2), 'utf8')
	chmodSync(credPath, 0o600)

	// Non-blocking validation GET
	const authHeader = makeBasicAuth(username, token)
	const testUrl = `${url.replace(/\/$/, '')}/wiki/api/v2/pages?limit=1`
	try {
		const res = await httpsRequest('GET', testUrl, authHeader)
		if (res.status >= 200 && res.status < 300) {
			console.log('✅ Credentials saved. Connection test: OK')
		} else {
			console.log(
				'✅ Credentials saved. Connection test: SKIPPED (network unreachable) — run npm run confluence -- --verify to test'
			)
		}
	} catch {
		console.log(
			'✅ Credentials saved. Connection test: SKIPPED (network unreachable) — run npm run confluence -- --verify to test'
		)
	}
}

// ── List ──────────────────────────────────────────────────────────────────────

function runList() {
	let res
	try {
		res = readPagesFile(process.cwd())
	} catch (err) {
		throw new CliError(`invalid JSON in confluence-pages.json — ${/** @type {Error} */ (err).message}`)
	}
	if (!res.existed) {
		console.log(`No confluence-pages.json in ${process.cwd()}`)
		return
	}
	const rows = listAliases(res.pages)
	if (rows.length === 0) {
		console.log('No aliases configured yet.')
		return
	}
	const aliasW = Math.max(5, ...rows.map(([k]) => k.length))
	console.log(`${'alias'.padEnd(aliasW)}  page id`)
	console.log(`${'─'.repeat(aliasW)}  ──────────────`)
	for (const [k, v] of rows) console.log(`${k.padEnd(aliasW)}  ${v}`)
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
	try {
		const args = process.argv.slice(2)

		if (args[0] === '--setup') {
			await runSetup()
			return
		}
		if (args[0] === '--check-auth') {
			const { url: baseUrl, username, token } = loadCredentials()
			const authHeader = makeBasicAuth(username, token)
			let res
			try {
				res = await httpsRequest('GET', `${baseUrl.replace(/\/$/, '')}/wiki/api/v2/pages?limit=1`, authHeader)
			} catch (err) {
				throw new CliError(/** @type {Error} */ (err).message)
			}
			if (res.status >= 200 && res.status < 300) {
				console.log('✓ Credentials valid')
				return
			}
			handleHttpError(res.status, '')
		}
		if (args[0] === '--verify') {
			await runVerify()
			return
		}
		if (args[0] === '--list') {
			runList()
			return
		}

		const dryRun = args.includes('--dry-run')
		const replaceAll = args.includes('--replace-all')
		const noSave = args.includes('--no-save')
		const positionalArgs = args.filter((a) => !a.startsWith('--'))
		if (positionalArgs.length < 2) {
			throw new CliError(
				'Usage: node scripts/push-to-confluence.mjs [--dry-run] [--replace-all] [--no-save] {pageId} {file.md}'
			)
		}
		const pageArg = positionalArgs[0] ?? ''
		const wasNumericArg = isNumericId(pageArg)
		const filePath = positionalArgs[1] ?? ''
		const pageId = resolvePageId(pageArg)
		const resolvedPath = path.resolve(filePath)

		if (!existsSync(resolvedPath)) {
			throw new CliError(`File not found: ${filePath}`)
		}

		const stats = statSync(resolvedPath)
		if (stats.size > MAX_FILE_BYTES) {
			throw new CliError('File too large for Confluence API — split the document')
		}

		const rawContent = readFileSync(resolvedPath, 'utf8')
		const stripped = stripFrontmatter(rawContent)
		const rawHtml = marked(stripped)
		const html = postProcessHtml(/** @type {string} */ (rawHtml))

		if (!html || !html.trim()) {
			throw new CliError('Markdown converted to empty HTML — check the source file is not empty')
		}

		const { url: baseUrl, username, token } = loadCredentials()
		const authHeader = makeBasicAuth(username, token)
		const getUrl = `${baseUrl.replace(/\/$/, '')}/wiki/api/v2/pages/${pageId}?body-format=storage`

		let getRes
		try {
			getRes = await httpsRequest('GET', getUrl, authHeader)
		} catch (err) {
			throw new CliError(/** @type {Error} */ (err).message)
		}
		if (getRes.status < 200 || getRes.status >= 300) {
			handleHttpError(getRes.status, '', { pageArg, filePath })
		}

		/** @type {PageData} */
		let pageData
		try {
			pageData = /** @type {PageData} */ (JSON.parse(getRes.body))
		} catch {
			throw new CliError('Unexpected response from Confluence — check VPN/network and retry')
		}

		const version = pageData?.version?.number
		if (typeof version !== 'number' || !Number.isInteger(version) || version <= 0) {
			throw new CliError('Could not read page version from Confluence response — retry or contact support')
		}

		const title = pageData?.title ?? ''
		const existingBody = pageData?.body?.storage?.value ?? ''

		console.log(`Page: "${title}" (version ${version})`)

		const newBody = injectContent(existingBody, html, title, {
			replaceAll,
			dryRun,
			pageId,
			version,
		})

		if (dryRun) {
			console.log('=== DRY RUN — Page would be updated to: ===\n')
			console.log(newBody)
			console.log('\n=== END DRY RUN ===')
			return
		}

		const putUrl = `${baseUrl.replace(/\/$/, '')}/wiki/api/v2/pages/${pageId}`
		const putBody = {
			id: pageId,
			status: 'current',
			title,
			body: { representation: 'storage', value: newBody },
			version: { number: version + 1 },
		}

		let putRes
		try {
			putRes = await httpsRequest('PUT', putUrl, authHeader, putBody)
		} catch (err) {
			throw new CliError(/** @type {Error} */ (err).message)
		}
		if (putRes.status < 200 || putRes.status >= 300) {
			handleHttpError(putRes.status, title, { pageArg, filePath })
		}

		if (wasNumericArg && !dryRun && !noSave) {
			try {
				const { pages, path: pagesPath } = readPagesFile(process.cwd())
				const existing = findAliasForId(pages, pageId)
				if (existing) {
					console.log(`ℹ Page ${pageId} already aliased as "${existing}"`)
				} else {
					const alias = pickAvailableAlias(pages, slugify(title), pageId)
					writePagesFile(pagesPath, appendAlias(pages, alias, pageId))
					console.log(`✓ Saved alias "${alias}" → ${pageId} in confluence-pages.json`)
				}
			} catch (err) {
				console.error(`⚠ Could not save alias: ${/** @type {Error} */ (err).message}`)
			}
		}
		console.log(`✓ Published "${title}" to Confluence (version ${version + 1})`)
	} catch (err) {
		if (err instanceof CliError) {
			console.error(err.message)
			process.exit(err.exitCode)
		}
		throw err
	}
}

main()
