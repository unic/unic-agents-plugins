#!/usr/bin/env node
// @ts-check

import { existsSync, readFileSync } from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * @typedef {{ url: string, username: string, token: string }} Credentials
 */

const DEFAULT_CRED_FILE = path.join(os.homedir(), '.unic-confluence.json')

/**
 * Loads Confluence credentials from env vars or a JSON credentials file.
 * CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN env vars take precedence.
 * Falls back to the JSON file at credPath (~/.unic-confluence.json by default).
 * Throws a descriptive Error if neither source yields valid credentials.
 *
 * @param {string} [credPath]
 * @returns {Credentials}
 */
export function loadCredentials(credPath = DEFAULT_CRED_FILE) {
	const { CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN } = process.env
	if (CONFLUENCE_URL && CONFLUENCE_USER && CONFLUENCE_TOKEN) {
		return { url: CONFLUENCE_URL, username: CONFLUENCE_USER, token: CONFLUENCE_TOKEN }
	}
	if (existsSync(credPath)) {
		try {
			const raw = /** @type {Credentials} */ (JSON.parse(readFileSync(credPath, 'utf8')))
			if (raw.url && raw.username && raw.token) return raw
		} catch {
			// fall through to error below
		}
	}
	throw new Error(
		'Confluence credentials not configured — set CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN' +
			' or run `node scripts/push-to-confluence.mjs --setup` to configure ~/.unic-confluence.json'
	)
}

/**
 * Extracts the numeric page ID from a Confluence page URL.
 * Handles patterns: /pages/{id}/ and /pages/{id}
 *
 * @param {string} pageUrl
 * @returns {string}
 */
export function extractPageId(pageUrl) {
	const match = pageUrl.match(/\/pages\/(\d+)(?:\/|$)/)
	if (!match) throw new Error(`Could not extract numeric page ID from URL: ${pageUrl}`)
	return match[1] ?? ''
}

/**
 * Makes an HTTPS GET request and returns status + body.
 *
 * @param {string} urlStr
 * @param {string} authHeader
 * @returns {Promise<{ status: number, body: string }>}
 */
function httpsGet(urlStr, authHeader) {
	return new Promise((resolve, reject) => {
		const parsed = new URL(urlStr)
		const options = {
			method: 'GET',
			hostname: parsed.hostname,
			path: parsed.pathname + parsed.search,
			headers: {
				Authorization: authHeader,
				Accept: 'application/json',
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
		req.on('error', reject)
		req.end()
	})
}

/**
 * Fetches the Confluence storage-format body of a page by its URL.
 * Uses the Confluence v2 API with Basic auth.
 * Throws on non-2xx response or network error.
 *
 * @param {string} pageUrl
 * @param {Credentials} credentials
 * @returns {Promise<string>} Confluence storage XML body
 */
export async function fetchPageText(pageUrl, credentials) {
	const pageId = extractPageId(pageUrl)
	const apiUrl = `${credentials.url.replace(/\/$/, '')}/wiki/api/v2/pages/${pageId}?body-format=storage`
	const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64')}`

	let res
	try {
		res = await httpsGet(apiUrl, authHeader)
	} catch (err) {
		throw new Error(`Network error fetching ${pageUrl}: ${/** @type {Error} */ (err).message}`)
	}

	if (res.status < 200 || res.status >= 300) {
		throw new Error(`Confluence returned HTTP ${res.status} for ${pageUrl}`)
	}

	let parsed
	try {
		parsed = JSON.parse(res.body)
	} catch {
		throw new Error(`Unexpected non-JSON response from Confluence for ${pageUrl}`)
	}

	const content = parsed?.body?.storage?.value
	if (typeof content !== 'string') {
		throw new Error(`No storage body found in Confluence response for ${pageUrl}`)
	}
	return content
}

// ── CLI entry point ────────────────────────────────────────────────────────────

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href

if (isMain) {
	const args = process.argv.slice(2)

	if (args.length === 0 || (args[0] !== '--check-creds' && !args[0].startsWith('http'))) {
		console.error('Usage:')
		console.error('  node scripts/confluence-client.mjs --check-creds')
		console.error('  node scripts/confluence-client.mjs <confluence-page-url>')
		process.exit(1)
	}

	if (args[0] === '--check-creds') {
		try {
			loadCredentials()
			process.exit(0)
		} catch (err) {
			console.error(/** @type {Error} */ (err).message)
			process.exit(1)
		}
	} else {
		const url = args[0] ?? ''
		try {
			const creds = loadCredentials()
			const text = await fetchPageText(url, creds)
			process.stdout.write(text)
		} catch (err) {
			console.error(/** @type {Error} */ (err).message)
			process.exit(1)
		}
	}
}
