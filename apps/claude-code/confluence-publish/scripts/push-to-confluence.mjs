#!/usr/bin/env node
/**
 * push-to-confluence.mjs
 * Publishes a Markdown file to a Confluence page via the v2 API.
 *
 * Usage: npm run confluence -- {pageId} {file.md}
 */

import { createRequire } from 'module'
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import https from 'https'
import { createInterface } from 'readline'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const { marked } = require('marked')

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ── Credential resolution ──────────────────────────────────────────────────────

function loadCredentials() {
	const { CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN } = process.env

	if (CONFLUENCE_URL && CONFLUENCE_USER && CONFLUENCE_TOKEN) {
		return { url: CONFLUENCE_URL, username: CONFLUENCE_USER, token: CONFLUENCE_TOKEN }
	}

	const credFile = path.join(os.homedir(), '.unic-confluence.json')
	if (existsSync(credFile)) {
		try {
			const raw = JSON.parse(readFileSync(credFile, 'utf8'))
			if (raw.url && raw.username && raw.token) {
				return raw
			}
		} catch {
			// fall through to error below
		}
	}

	console.error('Run `npm run confluence -- --setup` to configure credentials')
	process.exit(1)
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

function makeBasicAuth(username, token) {
	return 'Basic ' + Buffer.from(`${username}:${token}`).toString('base64')
}

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
			res.on('data', (chunk) => (data += chunk))
			res.on('end', () => resolve({ status: res.statusCode, body: data }))
		})

		req.on('error', () => {
			reject(new Error('Cannot reach Confluence — check VPN/network connectivity'))
		})

		if (bodyStr) req.write(bodyStr)
		req.end()
	})
}

function handleHttpError(status, title) {
	const messages = {
		401: 'API token rejected — generate a new one at https://id.atlassian.com → Security → API tokens (note: tokens created before 2025 may have expired)',
		403: 'Access denied — check that your API token has permission to read and write this page',
		404: 'Page ID not found — check confluence-pages.json or verify the page still exists',
		409: `Page was updated by someone else. Retry with: npm run confluence -- ${process.argv[2]} ${process.argv[3]}`,
	}
	const msg = messages[status] ?? `Unexpected response from Confluence (HTTP ${status}) — check VPN/network and retry`
	console.error(msg)
	process.exit(1)
}

// ── YAML frontmatter stripping ─────────────────────────────────────────────────

function stripFrontmatter(content) {
	// The opening --- must be at byte 0 to avoid treating a CommonMark HR in the body as frontmatter
	// \r?\n handles both LF and CRLF line endings
	return content.replace(/^---\r?\n.*?\r?\n---\s*\r?\n/s, '')
}

// ── Content injection strategies ───────────────────────────────────────────────

const TEXT_START_RE = /(?:<p>\s*)?\[AUTO_INSERT_START:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/
const TEXT_END_RE = /(?:<p>\s*)?\[AUTO_INSERT_END:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/

function injectContent(existingBody, newHtml, title) {
	const hasStart = TEXT_START_RE.test(existingBody)
	const hasEnd = TEXT_END_RE.test(existingBody)

	// Strategy 1: plain-text markers
	if (hasStart || hasEnd) {
		if (hasStart !== hasEnd) {
			console.error(
				`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END] on page "${title}" — fix the Confluence page before publishing`
			)
			process.exit(1)
		}

		const startMatch = TEXT_START_RE.exec(existingBody)
		const startLabel = startMatch[1].trim()
		const afterStart = startMatch.index + startMatch[0].length

		// Construct a label-specific END pattern and search only after the start position.
		// This avoids false label-mismatch errors when the page content contains documentation
		// examples of the marker syntax that use different labels.
		const escapedLabel = startLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		const labelEndRe = new RegExp(`(?:<p>\\s*)?\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\](?:\\s*<\\/p>)?`)
		const endMatch = labelEndRe.exec(existingBody.slice(afterStart))

		if (!endMatch) {
			console.error(
				`Marker label mismatch on page "${title}": [AUTO_INSERT_START:${startLabel}] has no matching [AUTO_INSERT_END:${startLabel}] — fix the Confluence page before publishing`
			)
			process.exit(1)
		}

		return existingBody.slice(0, afterStart) + '\n' + newHtml + '\n' + existingBody.slice(afterStart + endMatch.index)
	}

	// Strategy 2: anchor macros (legacy fallback)
	// Matches Confluence storage format: <ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">md-start</ac:parameter></ac:structured-macro>
	const anchorStartRe =
		/<ac:structured-macro[^>]*ac:name="anchor"[^>]*>\s*<ac:parameter[^>]*>md-start<\/ac:parameter>\s*<\/ac:structured-macro>/
	const anchorEndRe =
		/<ac:structured-macro[^>]*ac:name="anchor"[^>]*>\s*<ac:parameter[^>]*>md-end<\/ac:parameter>\s*<\/ac:structured-macro>/
	const hasAnchorStart = anchorStartRe.test(existingBody)
	const hasAnchorEnd = anchorEndRe.test(existingBody)

	if (hasAnchorStart || hasAnchorEnd) {
		if (hasAnchorStart !== hasAnchorEnd) {
			console.error(
				`Found md-start anchor without md-end (or vice versa) on page "${title}" — fix the Confluence page before publishing`
			)
			process.exit(1)
		}

		const startMatch = anchorStartRe.exec(existingBody)
		const endMatch = anchorEndRe.exec(existingBody)

		return (
			existingBody.slice(0, startMatch.index + startMatch[0].length) +
			'\n' +
			newHtml +
			'\n' +
			existingBody.slice(endMatch.index)
		)
	}

	// Strategy 3: append (no markers found)
	return existingBody + '\n' + newHtml
}

// ── Page ID resolution ────────────────────────────────────────────────────────

function isNumericId(arg) {
	return /^\d+$/.test(arg)
}

function resolvePageId(arg) {
	if (isNumericId(arg)) {
		const id = parseInt(arg, 10)
		if (!Number.isInteger(id) || id <= 0) {
			console.error(`Invalid page ID: ${arg}`)
			process.exit(1)
		}
		return id
	}

	const pagesPath = path.join(process.cwd(), 'confluence-pages.json')
	if (!existsSync(pagesPath)) {
		console.error('confluence-pages.json not found — create it or pass a page ID directly')
		process.exit(1)
	}

	let pages
	try {
		pages = JSON.parse(readFileSync(pagesPath, 'utf8'))
	} catch {
		console.error('invalid JSON in confluence-pages.json — check syntax')
		process.exit(1)
	}

	if (!(arg in pages)) {
		const keys = Object.keys(pages)
			.filter((k) => k !== '_comment')
			.join(', ')
		console.error(`'${arg}' not found in confluence-pages.json — available keys: ${keys}`)
		process.exit(1)
	}

	const id = pages[arg]
	if (!Number.isInteger(id) || id <= 0) {
		console.error(`Invalid page ID for key '${arg}': ${id} — must be a positive integer`)
		process.exit(1)
	}

	return id
}

// ── Verify flow ────────────────────────────────────────────────────────────────

async function runVerify() {
	const pagesPath = path.join(process.cwd(), 'confluence-pages.json')
	if (!existsSync(pagesPath)) {
		console.error('confluence-pages.json not found — create it first')
		process.exit(1)
	}

	let pages
	try {
		pages = JSON.parse(readFileSync(pagesPath, 'utf8'))
	} catch {
		console.error('invalid JSON in confluence-pages.json — check syntax')
		process.exit(1)
	}

	const pageKeys = Object.keys(pages).filter((k) => k !== '_comment')
	console.log(`Verifying ${pageKeys.length} page(s): ${pageKeys.join(', ')}`)

	const { url: baseUrl, username, token } = loadCredentials()
	const authHeader = makeBasicAuth(username, token)

	let hasErrors = false
	for (const [key, id] of Object.entries(pages)) {
		if (key === '_comment') continue
		if (!Number.isInteger(id) || id <= 0) {
			console.error(
				`❌ ${key}: Invalid page ID in confluence-pages.json: ${JSON.stringify(id)} — must be a positive integer`
			)
			hasErrors = true
			continue
		}
		const getUrl = `${baseUrl.replace(/\/$/, '')}/wiki/api/v2/pages/${id}?body-format=storage`
		try {
			const res = await httpsRequest('GET', getUrl, authHeader)
			if (res.status === 200) {
				const pageData = JSON.parse(res.body)
				console.log(`✅ ${key} (${id}): ${pageData.title}`)
			} else if (res.status === 404) {
				console.error(`❌ ${key} (${id}): Page not found — 404`)
				hasErrors = true
			} else {
				console.error(`⚠️  ${key} (${id}): Unexpected HTTP ${res.status}`)
				hasErrors = true
			}
		} catch {
			console.error(`⚠️  ${key} (${id}): Network error`)
			hasErrors = true
		}
	}

	process.exit(hasErrors ? 1 : 0)
}

// ── Setup flow ─────────────────────────────────────────────────────────────────

async function runSetup() {
	if (!process.stdin.isTTY) {
		console.error('--setup requires an interactive terminal')
		process.exit(1)
	}

	const credPath = path.join(os.homedir(), '.unic-confluence.json')
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve))

	let existing = null
	if (existsSync(credPath)) {
		try {
			existing = JSON.parse(readFileSync(credPath, 'utf8'))
		} catch {
			// ignore
		}
	}

	if (existing?.username) {
		const answer = await question(`Credentials already configured for ${existing.username}. Overwrite? (y/n): `)
		if (answer.trim().toLowerCase() !== 'y') {
			console.log('Aborted.')
			rl.close()
			process.exit(0)
		}
	}

	const defaultUrl = existing?.url ?? 'https://uniccom.atlassian.net'
	const urlInput = await question(`Confluence URL [${defaultUrl}]: `)
	const url = urlInput.trim() || defaultUrl

	const userInput = await question(`Email${existing?.username ? ` [${existing.username}]` : ''}: `)
	const username = userInput.trim() || existing?.username || ''

	const tokenInput = await question(`API token (Note: tokens created before 2025 may have expired): `)
	const token = tokenInput.trim()

	rl.close()

	if (!username || !token) {
		console.error('Username and API token are required.')
		process.exit(1)
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

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
	const args = process.argv.slice(2)

	if (args[0] === '--setup') {
		await runSetup()
		process.exit(0)
	}
	if (args[0] === '--verify') {
		await runVerify()
		return
	}

	if (args.length < 2) {
		console.error('Usage: npm run confluence -- {pageId} {file.md}')
		process.exit(1)
	}

	const [pageArg, filePath] = args
	const pageId = resolvePageId(pageArg)
	const resolvedPath = path.resolve(filePath)

	if (!existsSync(resolvedPath)) {
		console.error(`File not found: ${filePath}`)
		process.exit(1)
	}

	const stats = statSync(resolvedPath)
	if (stats.size > MAX_FILE_BYTES) {
		console.error('File too large for Confluence API — split the document')
		process.exit(1)
	}

	const rawContent = readFileSync(resolvedPath, 'utf8')
	const stripped = stripFrontmatter(rawContent)
	const html = marked(stripped)

	if (!html || !html.trim()) {
		console.error('Markdown converted to empty HTML — check the source file is not empty')
		process.exit(1)
	}

	const { url: baseUrl, username, token } = loadCredentials()
	const authHeader = makeBasicAuth(username, token)
	const getUrl = `${baseUrl.replace(/\/$/, '')}/wiki/api/v2/pages/${pageId}?body-format=storage`

	let getRes
	try {
		getRes = await httpsRequest('GET', getUrl, authHeader)
	} catch (err) {
		console.error(err.message)
		process.exit(1)
	}
	if (getRes.status < 200 || getRes.status >= 300) {
		handleHttpError(getRes.status, '')
	}

	let pageData
	try {
		pageData = JSON.parse(getRes.body)
	} catch {
		console.error('Unexpected response from Confluence — check VPN/network and retry')
		process.exit(1)
	}

	const version = pageData?.version?.number
	if (!Number.isInteger(version) || version <= 0) {
		console.error('Could not read page version from Confluence response — retry or contact support')
		process.exit(1)
	}

	const title = pageData?.title ?? ''
	const existingBody = pageData?.body?.storage?.value ?? ''

	console.log(`Page: "${title}" (version ${version})`)

	const newBody = injectContent(existingBody, html, title)

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
		console.error(err.message)
		process.exit(1)
	}
	if (putRes.status < 200 || putRes.status >= 300) {
		handleHttpError(putRes.status, title)
	}

	console.log(`✓ Published "${title}" to Confluence (version ${version + 1})`)
}

main()
