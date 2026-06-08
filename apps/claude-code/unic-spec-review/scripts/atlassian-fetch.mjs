#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * atlassian-fetch.mjs - fetch Confluence page content (and optionally Jira
 * issue data) for spec reviews.
 *
 * Pure-function library plus a thin CLI entry point. Given a list of pasted
 * URLs it routes each by path (`/browse/` -> Jira, `/wiki/` -> Confluence),
 * fetches the linked page / issue via the Atlassian REST APIs using the
 * built-in global `fetch` (Node 22+), and normalises the response into
 * structures the `/review-spec` command and Gaps agent can consume.
 *
 * Credentials come from `lib/credentials.mjs` (env vars override the file).
 * Every HTTP call uses Basic auth (email:token) with a hard 15 s timeout.
 *
 * The fetch helpers accept an injectable `fetch` (via `deps.fetch`) so unit
 * tests can stub HTTP without mocking globalThis.
 *
 * Note: Jira exports (fetchJiraIssue, parseJiraACs, parseJiraBug,
 * extractJiraKey) are vendored from unic-pr-review but untested in this
 * plugin - coverage lives in unic-pr-review.
 */

import { Buffer } from 'node:buffer'
import { pathToFileURL } from 'node:url'
import { loadAtlassianCreds } from './lib/credentials.mjs'

/** @import { AtlassianCreds, Env } from './lib/credentials.mjs' */

/**
 * @typedef {'jira' | 'confluence' | null} UrlRoute
 */

/**
 * @typedef {(url: string, options?: any) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} FetchLike
 */

/**
 * @typedef {Object} JiraItem
 * @property {'jira'} source
 * @property {string} id - the issue key (e.g. "PROJ-42")
 * @property {'story' | 'bug' | 'other'} type
 * @property {string} url - the originally pasted URL
 * @property {string} summary
 * @property {string[]} acs - acceptance criteria (Stories only; [] otherwise)
 * @property {string} repro - reproduction steps (Bugs only; '' otherwise)
 * @property {string} expected - expected behaviour (Bugs only; '' otherwise)
 * @property {string} actual - actual behaviour (Bugs only; '' otherwise)
 * @property {string[]} confluenceLinks - absolute Confluence URLs found in the issue body
 */

/**
 * @typedef {Object} ConfluenceItem
 * @property {'confluence'} source
 * @property {string} id - the page id
 * @property {string} url - the originally pasted URL
 * @property {string} title
 * @property {string} excerpt - first 800 chars of the page body, HTML stripped
 * @property {string[]} linkedUrls - Confluence `/wiki/` hrefs found in the body
 */

/**
 * @typedef {Object} ConfluenceComment
 * @property {string} id - always non-empty for real API responses
 * @property {'footer' | 'inline'} type
 * @property {string} body - plain text from the HTML-stripped comment body
 * @property {string} [anchor] - original selection text (inline comments only)
 * @property {string} author - display name or account id of the commenter
 * @property {string} created - ISO creation timestamp, or '' when unavailable
 */

/**
 * @typedef {Object} ConfluenceCommentsResult
 * @property {ConfluenceComment[]} comments
 * @property {boolean} truncated - true if the page-count cap was hit and the comment set is incomplete
 */

/**
 * @typedef {'unreachable' | 'not-found' | 'auth-error' | 'parse-error' | 'unsupported'} FetchErrorKind
 */

/**
 * @typedef {Object} FetchErrorJson
 * @property {string} url
 * @property {FetchErrorKind} kind
 * @property {string} message
 */

/**
 * @typedef {Object} FetchOutput
 * @property {(JiraItem | ConfluenceItem)[]} items
 * @property {FetchErrorJson[]} errors
 */

/**
 * Structured fetch failure. The `kind` discriminator lets the caller (Gaps agent /
 * `/review-spec` command) decide whether to hard-stop: `unreachable` and
 * `auth-error` on a promised source abort the review; `not-found` is softer.
 */
export class FetchError extends Error {
	/**
	 * @param {string} url
	 * @param {FetchErrorKind} kind
	 * @param {string} message
	 */
	constructor(url, kind, message) {
		super(message)
		this.name = 'FetchError'
		this.url = url
		this.kind = kind
	}
}

/**
 * @typedef {Object} InlineAnchor
 * @property {string} textSelection - exact page text the inline comment anchors to
 * @property {number} matchCount - total occurrences of the selection on the page (textSelectionMatchCount)
 */

/**
 * @typedef {Object} PostedComment
 * @property {string} id - the created comment id, or '' when absent from the response
 * @property {string} created - ISO creation timestamp, or '' when unavailable
 */

export const FETCH_TIMEOUT_MS = 15_000

/**
 * @param {string} url
 * @returns {URL | null}
 */
function tryParseUrl(url) {
	try {
		return new URL(url)
	} catch {
		return null
	}
}

/**
 * Route a pasted URL by its path. `/browse/` → Jira, `/wiki/` → Confluence.
 * Anything else (including malformed URLs and ADO Boards links) returns null.
 * @param {string} url
 * @returns {UrlRoute}
 */
export function routeUrl(url) {
	const parsed = tryParseUrl(url)
	if (!parsed) return null
	if (parsed.pathname.includes('/browse/')) return 'jira'
	if (parsed.pathname.includes('/wiki/')) return 'confluence'
	return null
}

/**
 * Extract a Jira issue key (e.g. "PROJ-42") from a `/browse/KEY-123` URL.
 * @param {string} url
 * @returns {string | null}
 */
export function extractJiraKey(url) {
	const parsed = tryParseUrl(url)
	if (!parsed) return null
	const m = parsed.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/)
	return m ? m[1] : null
}

/**
 * Extract a Confluence page id from either a modern `/pages/123456/` path or a
 * legacy `viewpage.action?pageId=123456` query string.
 * @param {string} url
 * @returns {string | null}
 */
export function extractConfluencePageId(url) {
	const parsed = tryParseUrl(url)
	if (!parsed) return null
	const pathMatch = parsed.pathname.match(/\/pages\/(\d+)/)
	if (pathMatch) return pathMatch[1]
	const queryId = parsed.searchParams.get('pageId')
	return queryId && /^\d+$/.test(queryId) ? queryId : null
}

/**
 * Build the base64 portion of a Basic-auth header from email + API token.
 * Standard HTTP Basic auth: base64(email:token).
 * @param {string} username
 * @param {string} token
 * @returns {string}
 */
export function buildBasicAuth(username, token) {
	return Buffer.from(`${username}:${token}`).toString('base64')
}

/**
 * Concatenate the visible text of an ADF (Atlassian Document Format) node.
 * @param {any} node
 * @returns {string}
 */
function nodeText(node) {
	if (!node) return ''
	if (typeof node.text === 'string') return node.text
	if (Array.isArray(node.content)) return node.content.map(nodeText).join('')
	return ''
}

/**
 * Parse acceptance criteria from a Jira Story description.
 *
 * Cloud instances send ADF JSON; older Server/Data Center instances send a
 * plain string. Both are handled: for ADF, find a heading containing
 * "acceptance" and collect the list items that follow until the next heading;
 * for a string, collect bulleted/numbered lines after an "acceptance criteria"
 * line.
 *
 * @param {unknown} description - ADF object or plain string
 * @returns {string[]}
 */
export function parseJiraACs(description) {
	if (description == null) return []
	if (typeof description === 'string') return parseAcsFromString(description)
	if (typeof description !== 'object') return []
	const adf = /** @type {any} */ (description)
	const content = Array.isArray(adf.content) ? adf.content : []
	/** @type {string[]} */
	const acs = []
	let collecting = false
	for (const node of content) {
		if (node?.type === 'heading') {
			collecting = nodeText(node).toLowerCase().includes('acceptance')
			continue
		}
		if (!collecting) continue
		if (node?.type === 'bulletList' || node?.type === 'orderedList') {
			for (const listItem of node.content ?? []) {
				const text = nodeText(listItem).trim()
				if (text) acs.push(text)
			}
		}
	}
	return acs
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function parseAcsFromString(text) {
	const lines = text.split(/\r?\n/)
	/** @type {string[]} */
	const acs = []
	let collecting = false
	for (const line of lines) {
		const trimmed = line.trim()
		if (/acceptance criteria/i.test(trimmed)) {
			collecting = true
			continue
		}
		if (!collecting) continue
		const listMatch = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
		if (listMatch) {
			acs.push(listMatch[1].trim())
			continue
		}
		if (trimmed === '') continue
		if (/^AC\b/i.test(trimmed)) {
			acs.push(trimmed)
			continue
		}
		break
	}
	return acs
}

/**
 * Group an ADF document into { heading, body } sections.
 * @param {any} adf
 * @returns {{ heading: string, body: string }[]}
 */
function sectionsByHeading(adf) {
	const content = Array.isArray(adf?.content) ? adf.content : []
	/** @type {{ heading: string, bodyParts: string[] }[]} */
	const sections = []
	/** @type {{ heading: string, bodyParts: string[] } | null} */
	let current = null
	for (const node of content) {
		if (node?.type === 'heading') {
			current = { heading: nodeText(node), bodyParts: [] }
			sections.push(current)
		} else if (current) {
			const text = nodeText(node).trim()
			if (text) current.bodyParts.push(text)
		}
	}
	return sections.map((s) => ({ heading: s.heading, body: s.bodyParts.join('\n') }))
}

/**
 * @param {{ heading: string, body: string }[]} sections
 * @param {RegExp} re
 * @returns {string}
 */
function findSection(sections, re) {
	const match = sections.find((s) => re.test(s.heading))
	return match ? match.body : ''
}

/**
 * Coerce an ADF object or a plain string field into text.
 * @param {unknown} value
 * @returns {string}
 */
function fieldText(value) {
	if (value == null) return ''
	if (typeof value === 'string') return value
	if (typeof value === 'object') return nodeText(value).trim()
	return String(value)
}

/**
 * Extract Repro / Expected / Actual from a Jira Bug. Prefers known custom
 * fields; falls back to ADF description headings when the custom fields are
 * absent.
 * @param {any} fields
 * @returns {{ repro: string, expected: string, actual: string }}
 */
export function parseJiraBug(fields) {
	if (!fields || typeof fields !== 'object') {
		return { repro: '', expected: '', actual: '' }
	}
	let repro = fieldText(fields.customfield_10300)
	let expected = fieldText(fields.customfield_10301)
	let actual = fieldText(fields.customfield_10302)
	if ((!repro || !expected || !actual) && fields.description && typeof fields.description === 'object') {
		const sections = sectionsByHeading(fields.description)
		if (!repro) repro = findSection(sections, /repro|steps to reproduce/i)
		if (!expected) expected = findSection(sections, /expected/i)
		if (!actual) actual = findSection(sections, /actual/i)
	}
	return { repro, expected, actual }
}

/**
 * Extract Confluence `/wiki/` hrefs from an HTML body. Best-effort - scoped to
 * href-embedded links, which covers the common Confluence storage format.
 * Deduplicated, order preserved.
 * @param {unknown} htmlBody
 * @returns {string[]}
 */
export function extractConfluenceLinks(htmlBody) {
	if (typeof htmlBody !== 'string') return []
	return [...new Set([...htmlBody.matchAll(/href="([^"]*\/wiki\/[^"]*)"/g)].map((m) => m[1]))]
}

/**
 * Extract absolute Confluence URLs from arbitrary text (e.g. a stringified ADF
 * body with `"href":"https://…/wiki/…"` marks, or plain-text descriptions with
 * bare links).
 * @param {string} text
 * @returns {string[]}
 */
function extractAbsoluteWikiUrls(text) {
	if (typeof text !== 'string') return []
	return [...new Set([...text.matchAll(/https?:\/\/[^\s"'<>]+\/wiki\/[^\s"'<>]+/g)].map((m) => m[0]))]
}

/**
 * @param {string} u
 * @returns {string}
 */
function stripTrailingSlash(u) {
	return u.endsWith('/') ? u.slice(0, -1) : u
}

/**
 * Strip HTML tags and collapse whitespace, returning a clean text excerpt.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
	return html
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim()
}

/**
 * GET a JSON resource with Basic auth and a hard timeout. Classifies failures
 * into FetchError kinds and throws - never returns a partial result.
 * @param {string} url
 * @param {AtlassianCreds} creds
 * @param {FetchLike} fetchImpl
 * @returns {Promise<any>}
 */
async function fetchJson(url, creds, fetchImpl) {
	const headers = {
		Authorization: `Basic ${buildBasicAuth(creds.username, creds.token)}`,
		Accept: 'application/json',
	}
	let res
	try {
		res = await fetchImpl(url, { method: 'GET', headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
	} catch (err) {
		throw new FetchError(url, 'unreachable', mapFetchError(err))
	}
	if (res.status === 401 || res.status === 403) {
		throw new FetchError(url, 'auth-error', `HTTP ${res.status} - credentials rejected`)
	}
	if (res.status === 404) {
		throw new FetchError(url, 'not-found', `HTTP ${res.status} - resource not found`)
	}
	if (!res.ok) {
		throw new FetchError(url, 'unreachable', `HTTP ${res.status}`)
	}
	try {
		return await res.json()
	} catch (err) {
		throw new FetchError(url, 'parse-error', err instanceof Error ? err.message : String(err))
	}
}

/**
 * POST a JSON resource with Basic auth and a hard timeout. Classifies failures
 * into FetchError kinds and throws - never returns a partial result.
 * @param {string} url
 * @param {any} body
 * @param {AtlassianCreds} creds
 * @param {FetchLike} fetchImpl
 * @returns {Promise<any>}
 */
async function postJson(url, body, creds, fetchImpl) {
	const headers = {
		Authorization: `Basic ${buildBasicAuth(creds.username, creds.token)}`,
		Accept: 'application/json',
		'Content-Type': 'application/json',
	}
	let res
	try {
		res = await fetchImpl(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		})
	} catch (err) {
		throw new FetchError(url, 'unreachable', mapFetchError(err))
	}
	if (res.status === 401 || res.status === 403) {
		throw new FetchError(url, 'auth-error', `HTTP ${res.status} - credentials rejected`)
	}
	if (res.status === 404) {
		throw new FetchError(url, 'not-found', `HTTP ${res.status} - resource not found`)
	}
	if (!res.ok) {
		throw new FetchError(url, 'unreachable', `HTTP ${res.status}`)
	}
	try {
		return await res.json()
	} catch (err) {
		throw new FetchError(url, 'parse-error', err instanceof Error ? err.message : String(err))
	}
}

/**
 * Map a fetch rejection to a readable message, recognising the timeout abort.
 * @param {unknown} err
 * @returns {string}
 */
export function mapFetchError(err) {
	if (err instanceof Error && err.name === 'TimeoutError') {
		return `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`
	}
	return err instanceof Error ? err.message : String(err)
}

/**
 * Map a Jira issue type name to the three canonical buckets used for
 * intent extraction. Epics are bucketed as `'story'` because they can
 * carry acceptance criteria in the same AC-heading format.
 * @param {string | undefined} typeName
 * @returns {'story' | 'bug' | 'other'}
 */
function classifyIssueType(typeName) {
	const name = (typeName ?? '').toLowerCase()
	if (name.includes('story') || name === 'epic') return 'story'
	if (name.includes('bug') || name.includes('defect')) return 'bug'
	return 'other'
}

/**
 * Fetch and normalise a Jira issue (Story → ACs, Bug → repro/expected/actual).
 * @param {string} issueKeyOrUrl
 * @param {AtlassianCreds} creds
 * @param {{ fetch?: FetchLike }} [deps]
 * @returns {Promise<JiraItem>}
 */
export async function fetchJiraIssue(issueKeyOrUrl, creds, deps = {}) {
	const fetchImpl = deps.fetch ?? globalThis.fetch
	const jiraBase = stripTrailingSlash(creds.jiraUrl ?? creds.url)
	const key = extractJiraKey(issueKeyOrUrl) ?? issueKeyOrUrl
	// customfield_10016 = story points; included so callers can surface it without a second request.
	const fields = 'summary,description,issuetype,customfield_10016,customfield_10300,customfield_10301,customfield_10302'
	const url = `${jiraBase}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields}`
	const json = await fetchJson(url, creds, fetchImpl)
	const issueFields = json?.fields ?? {}
	const type = classifyIssueType(issueFields.issuetype?.name)
	const summary = typeof issueFields.summary === 'string' ? issueFields.summary : ''
	const acs = type === 'story' ? parseJiraACs(issueFields.description) : []
	const bug = type === 'bug' ? parseJiraBug(issueFields) : { repro: '', expected: '', actual: '' }
	const confluenceLinks = extractAbsoluteWikiUrls(JSON.stringify(issueFields.description ?? ''))
	return {
		source: 'jira',
		id: typeof json?.key === 'string' ? json.key : key,
		type,
		url: issueKeyOrUrl,
		summary,
		acs,
		repro: bug.repro,
		expected: bug.expected,
		actual: bug.actual,
		confluenceLinks,
	}
}

/**
 * Fetch and normalise a Confluence page (title + excerpt + linked wiki URLs).
 * @param {string} pageIdOrUrl
 * @param {AtlassianCreds} creds
 * @param {{ fetch?: FetchLike }} [deps]
 * @returns {Promise<ConfluenceItem>}
 */
export async function fetchConfluencePage(pageIdOrUrl, creds, deps = {}) {
	const fetchImpl = deps.fetch ?? globalThis.fetch
	const confluenceBase = stripTrailingSlash(creds.url)
	const pageId = extractConfluencePageId(pageIdOrUrl)
	if (pageId === null) {
		throw new FetchError(
			pageIdOrUrl,
			'not-found',
			`could not extract a Confluence page ID from this URL format - only /pages/<id>/ and ?pageId=<id> are supported: ${pageIdOrUrl}`
		)
	}
	const url = `${confluenceBase}/wiki/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage,version`
	const json = await fetchJson(url, creds, fetchImpl)
	const htmlBody = json?.body?.storage?.value ?? ''
	return {
		source: 'confluence',
		id: typeof json?.id === 'string' ? json.id : String(pageId),
		url: pageIdOrUrl,
		title: typeof json?.title === 'string' ? json.title : '',
		excerpt: stripHtml(typeof htmlBody === 'string' ? htmlBody : '').slice(0, 800),
		linkedUrls: extractConfluenceLinks(htmlBody).map((href) =>
			href.startsWith('http') ? href : `${confluenceBase}${href}`
		),
	}
}

/**
 * Fetch all footer and inline comments on a Confluence page. Read-only.
 *
 * Uses the v1 REST API child/comment endpoint, following `_links.next` for
 * pagination. The `_links.next` value is a path-relative string (e.g.
 * `/wiki/rest/api/...`), so it is prefixed with the credentials base to form an
 * absolute URL. Each comment is normalised to plain text (HTML stripped); inline
 * comments additionally carry the original selected text as `anchor`.
 * @param {string} pageIdOrUrl
 * @param {AtlassianCreds} creds
 * @param {{ fetch?: FetchLike }} [deps]
 * @returns {Promise<ConfluenceCommentsResult>}
 */
export async function fetchConfluenceComments(pageIdOrUrl, creds, deps = {}) {
	const fetchImpl = deps.fetch ?? globalThis.fetch
	const confluenceBase = stripTrailingSlash(creds.url)
	const pageId = extractConfluencePageId(pageIdOrUrl)
	if (pageId === null) {
		throw new FetchError(
			pageIdOrUrl,
			'not-found',
			`could not extract a Confluence page ID from this URL format - only /pages/<id>/ and ?pageId=<id> are supported: ${pageIdOrUrl}`
		)
	}
	/** @type {ConfluenceComment[]} */
	const comments = []
	const limit = 100
	const MAX_PAGES = 50
	let page = 0
	let truncated = false
	let nextUrl = `${confluenceBase}/wiki/rest/api/content/${encodeURIComponent(pageId)}/child/comment?expand=body.storage,extensions.inlineProperties,history&limit=${limit}&start=0`

	while (nextUrl) {
		// Cap pagination to guard against a misbehaving self-referential `_links.next`.
		// Hitting the cap means the comment set is incomplete, surfaced via `truncated`.
		if (++page > MAX_PAGES) {
			truncated = true
			break
		}
		const json = await fetchJson(nextUrl, creds, fetchImpl)
		const results = Array.isArray(json?.results) ? json.results : []
		for (const result of results) {
			const htmlBody = result?.body?.storage?.value ?? ''
			const body = stripHtml(typeof htmlBody === 'string' ? htmlBody : '')
			const location = result?.extensions?.location
			const type = location === 'inline' ? 'inline' : 'footer'
			const anchor = result?.extensions?.inlineProperties?.selection?.originalSelection
			const author = result?.history?.createdBy?.displayName ?? result?.history?.createdBy?.accountId ?? ''
			const created = result?.history?.createdDate ?? ''
			/** @type {ConfluenceComment} */
			const comment = {
				id: typeof result?.id === 'string' ? result.id : String(result?.id ?? ''),
				type,
				body,
				author,
				created,
			}
			if (anchor) comment.anchor = anchor
			comments.push(comment)
		}
		const rawNext = json?._links?.next
		nextUrl = typeof rawNext === 'string' ? `${confluenceBase}${rawNext}` : ''
	}

	return { comments, truncated }
}

/**
 * Fetch the raw HTML storage body of a Confluence page (for anchor resolution).
 * @param {string} pageIdOrUrl
 * @param {AtlassianCreds} creds
 * @param {{ fetch?: FetchLike }} [deps]
 * @returns {Promise<string>}
 */
export async function fetchConfluencePageBody(pageIdOrUrl, creds, deps = {}) {
	const fetchImpl = deps.fetch ?? globalThis.fetch
	const confluenceBase = stripTrailingSlash(creds.url)
	const pageId = extractConfluencePageId(pageIdOrUrl)
	if (pageId === null) {
		throw new FetchError(
			pageIdOrUrl,
			'not-found',
			`could not extract a Confluence page ID from this URL format - only /pages/<id>/ and ?pageId=<id> are supported: ${pageIdOrUrl}`
		)
	}
	const url = `${confluenceBase}/wiki/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage`
	const json = await fetchJson(url, creds, fetchImpl)
	return typeof json?.body?.storage?.value === 'string' ? json.body.storage.value : ''
}

/**
 * Post a Confluence comment via the v2 REST API. Supports both page-level
 * footer comments and inline comments anchored to a text selection.
 * @param {string} pageId
 * @param {string} body - comment body in wiki markup format
 * @param {'footer' | 'inline'} type
 * @param {InlineAnchor | null} anchor - required when type === 'inline'
 * @param {AtlassianCreds} creds
 * @param {{ fetch?: FetchLike }} [deps]
 * @returns {Promise<PostedComment>}
 */
export async function postConfluenceComment(pageId, body, type, anchor, creds, deps = {}) {
	const fetchImpl = deps.fetch ?? globalThis.fetch
	const confluenceBase = stripTrailingSlash(creds.url)
	const endpoint =
		type === 'inline'
			? `${confluenceBase}/wiki/api/v2/inline-comments`
			: `${confluenceBase}/wiki/api/v2/footer-comments`
	/** @type {any} */
	const payload = { pageId, body: { representation: 'wiki', value: body } }
	if (type === 'inline' && anchor !== null) {
		payload.inlineCommentProperties = {
			textSelection: anchor.textSelection,
			textSelectionMatchCount: anchor.matchCount,
			textSelectionMatchIndex: 0,
		}
	}
	const json = await postJson(endpoint, payload, creds, fetchImpl)
	return {
		id: typeof json?.id === 'string' ? json.id : '',
		created: json?.version?.createdAt ?? '',
	}
}

/**
 * @typedef {Object} CollectDeps
 * @property {FetchLike} [fetch] - injectable fetch for tests
 * @property {string} [homedir] - override for os.homedir(); used in tests
 * @property {Env} [env] - override for process.env; used in tests
 * @property {(homedir?: string, env?: Env) => (AtlassianCreds | null)} [loadCreds] - override credential loader
 * @property {{ write: (s: string) => void }} [stderr] - sink for warnings
 */

/**
 * Route, fetch, and normalise every URL. Never throws - per-URL failures (and a
 * missing or unreadable credential file) are collected into the `errors` array
 * so the caller (Gaps agent or `/review-spec` command) decides whether to
 * hard-stop. Unrecognised URLs are warned on stderr and recorded as a soft
 * `unsupported` error (not silently skipped) so the caller can surface them.
 * @param {string[]} urls
 * @param {CollectDeps} [deps]
 * @returns {Promise<FetchOutput>}
 */
export async function collectIntent(urls, deps = {}) {
	const fetchImpl = deps.fetch ?? globalThis.fetch
	const stderr = deps.stderr ?? process.stderr
	const loadCreds = deps.loadCreds ?? loadAtlassianCreds
	/** @type {AtlassianCreds | null} */
	let creds
	try {
		creds = loadCreds(deps.homedir, deps.env)
	} catch (err) {
		// A present-but-malformed or unreadable credential file throws in the
		// loader. Convert it to a global auth-error (url === '') so callers get the
		// structured never-throws contract and the CLI exits 1, just like missing
		// credentials - a broken config can't yield valid intent either way.
		const message = `credential file could not be read - ${err instanceof Error ? err.message : String(err)}`
		stderr.write(`atlassian-fetch: ${message}\n`)
		return { items: [], errors: [{ url: '', kind: 'auth-error', message }] }
	}
	if (!creds) {
		return {
			items: [],
			errors: [
				{
					url: '',
					kind: 'auth-error',
					message: 'No Atlassian credentials configured - run /unic-spec-review:setup-confluence',
				},
			],
		}
	}

	/** @type {(JiraItem | ConfluenceItem)[]} */
	const items = []
	/** @type {FetchErrorJson[]} */
	const errors = []

	for (const url of urls) {
		const route = routeUrl(url)
		if (route === null) {
			// Surface unsupported URLs (e.g. ADO Boards links) as a soft `unsupported`
			// error instead of skipping silently, so the caller can warn the reviewer
			// rather than producing empty intent with no explanation.
			const message = `unrecognised URL format - only /browse/ (Jira) and /wiki/ (Confluence) paths are supported`
			stderr.write(`atlassian-fetch: ${message}: ${url}; skipping\n`)
			errors.push({ url, kind: 'unsupported', message })
			continue
		}
		try {
			const item =
				route === 'jira'
					? await fetchJiraIssue(url, creds, { fetch: fetchImpl })
					: await fetchConfluencePage(url, creds, { fetch: fetchImpl })
			items.push(item)
		} catch (err) {
			// Report the pasted URL (not the internal API URL) so a hard-stop
			// message names what the reviewer actually entered (AC-7).
			if (err instanceof FetchError) {
				errors.push({ url, kind: err.kind, message: err.message })
			} else {
				// Internal code error - flag as parse-error (soft failure) rather than
				// unreachable (hard-stop), so a code defect doesn't abort the review.
				const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
				stderr.write(`atlassian-fetch: internal error processing ${url}: ${msg}\n`)
				errors.push({ url, kind: 'parse-error', message: msg })
			}
		}
	}

	return { items, errors }
}

/**
 * Parse the `--urls <csv>` argument into a trimmed, non-empty URL list.
 * @param {string[]} argv
 * @returns {string[]}
 */
export function parseUrlsArg(argv) {
	const idx = argv.indexOf('--urls')
	const raw = idx >= 0 ? (argv[idx + 1] ?? '') : ''
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
}

/**
 * CLI entry: parse argv, collect intent, write the FetchOutput as JSON to
 * stdout. Returns the result so tests can assert on it without spawning.
 * @param {string[]} argv
 * @param {CollectDeps & { stdout?: { write: (s: string) => void } }} [deps]
 * @returns {Promise<FetchOutput>}
 */
export async function main(argv, deps = {}) {
	const urls = parseUrlsArg(argv)
	const result = await collectIntent(urls, deps)
	let serialised
	try {
		serialised = JSON.stringify(result)
	} catch (err) {
		throw new Error(`atlassian-fetch: failed to serialise result: ${err instanceof Error ? err.message : String(err)}`)
	}
	;(deps.stdout ?? process.stdout).write(`${serialised}\n`)
	return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main(process.argv.slice(2))
		.then((result) => {
			// Exit 1 only when no credentials are configured at all (global auth-error,
			// url === ''). Per-URL auth errors and not-found entries exit 0 so the
			// gaps-agent can apply hard-stop logic by inspecting the errors array -
			// not-found is soft, auth-error/unreachable per-URL is hard.
			const credsMissing = result.errors.some((e) => e.kind === 'auth-error' && e.url === '')
			process.exit(credsMissing ? 1 : 0)
		})
		.catch((err) => {
			process.stderr.write(`atlassian-fetch: unexpected error: ${err?.stack ?? err?.message ?? String(err)}\n`)
			process.exit(1)
		})
}
