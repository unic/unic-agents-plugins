#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
	extractConfluencePageId,
	FetchError,
	fetchConfluencePageBody,
	postConfluenceComment,
} from '../atlassian-fetch.mjs'
import { FOOTER_MARKER } from './attribution-footer.mjs'
import { loadAtlassianCreds } from './credentials.mjs'
import { resolveAnchor } from './inline-anchor-resolver.mjs'
import { escapeHtml, mdToStorage } from './md-to-storage.mjs'

/** @import { AtlassianCreds } from './credentials.mjs' */
/** @import { FetchLike } from '../atlassian-fetch.mjs' */

/**
 * @typedef {Object} PostFindingResult
 * @property {string} id - Confluence comment id, or '' when absent from the response
 * @property {'inline' | 'footer'} type - how the comment was anchored
 * @property {string | null} reason - footer reason (resolver reason or 'inline-rejected'); null for inline
 */

/**
 * @typedef {Object} FindingInput
 * @property {string} title
 * @property {string} body
 * @property {string} severity
 * @property {number} confidence
 * @property {string} dimension
 * @property {string} hat
 * @property {string | null | undefined} [anchor]
 */

/**
 * Fetch the page body, resolve the anchor, convert the body, and post the Finding.
 *
 * Reactive footer fallback (ADR-0004): when Confluence rejects the inline anchor
 * (HTTP 400 → FetchError kind 'rejected'), the same body is retried as a page-level
 * footer comment and the result is reported as `type:'footer', reason:'inline-rejected'`.
 * Every other failure (auth, not-found, network/timeout/5xx) propagates unchanged so the
 * caller fails loud — only an anchor rejection triggers a retry.
 * @param {{ pageId: string, finding: FindingInput, creds: AtlassianCreds, fetch?: FetchLike }} opts
 * @returns {Promise<PostFindingResult>}
 */
export async function postFinding({ pageId, finding, creds, fetch: fetchImpl = globalThis.fetch }) {
	const fetchOpts = { fetch: fetchImpl }
	const pageUrl = `${creds.url}/wiki/pages/${pageId}`
	const pageHtml = await fetchConfluencePageBody(pageUrl, creds, fetchOpts)
	const resolution = resolveAnchor(finding.anchor ?? null, pageHtml)
	const titleLine = `<p><strong>${escapeHtml(finding.title)}</strong> (${escapeHtml(finding.severity)}, ${escapeHtml(String(finding.confidence))}%, ${escapeHtml(finding.dimension)})</p>`
	const convertedBody = mdToStorage(finding.body)
	const footerLine = `<p>${FOOTER_MARKER} | dimension: ${escapeHtml(finding.dimension)} | hat: ${escapeHtml(finding.hat)}</p>`
	const bodyWithFooter = `${titleLine}\n${convertedBody}\n${footerLine}`

	if (resolution.type === 'inline') {
		const anchor = { textSelection: resolution.textSelection, matchCount: resolution.matchCount }
		try {
			const result = await postConfluenceComment(pageId, bodyWithFooter, 'inline', anchor, creds, fetchOpts)
			return { id: result.id, type: 'inline', reason: null }
		} catch (err) {
			if (err instanceof FetchError && err.kind === 'rejected') {
				const result = await postConfluenceComment(pageId, bodyWithFooter, 'footer', null, creds, fetchOpts)
				return { id: result.id, type: 'footer', reason: 'inline-rejected' }
			}
			throw err
		}
	}

	const result = await postConfluenceComment(pageId, bodyWithFooter, 'footer', null, creds, fetchOpts)
	return { id: result.id, type: 'footer', reason: resolution.reason }
}

async function main() {
	const argv = process.argv.slice(2)
	const pageUrlIdx = argv.indexOf('--page-url')
	const findingFileIdx = argv.indexOf('--finding-file')

	const pageUrl = pageUrlIdx >= 0 ? argv[pageUrlIdx + 1] : undefined
	const findingFile = findingFileIdx >= 0 ? argv[findingFileIdx + 1] : undefined

	if (!pageUrl || !findingFile) {
		process.stderr.write(
			`${JSON.stringify({ error: 'Usage: confluence-writer.mjs --page-url <url> --finding-file <path>' })}\n`
		)
		process.exit(1)
	}

	let finding
	try {
		finding = JSON.parse(readFileSync(findingFile, 'utf8'))
	} catch (err) {
		process.stderr.write(
			JSON.stringify({ error: `Failed to read finding file: ${err instanceof Error ? err.message : String(err)}` }) +
				'\n'
		)
		process.exit(1)
	}

	if (typeof finding.body !== 'string') {
		process.stderr.write(`${JSON.stringify({ error: 'finding.body must be a string — malformed finding file' })}\n`)
		process.exit(1)
	}

	const creds = loadAtlassianCreds()
	if (!creds) {
		process.stderr.write(
			`${JSON.stringify({ error: 'No Atlassian credentials configured - run /unic-spec-review:setup-confluence' })}\n`
		)
		process.exit(1)
	}

	const pageId = extractConfluencePageId(pageUrl)
	if (!pageId) {
		process.stderr.write(`${JSON.stringify({ error: `Could not extract page ID from URL: ${pageUrl}` })}\n`)
		process.exit(1)
	}

	try {
		const result = await postFinding({ pageId, finding, creds })
		if (!result.id) {
			// A 2xx with no comment id means the write is unverifiable (response shape drift,
			// proxy, etc.). Treat it as a failure rather than report a phantom success: a
			// blank id cannot be located, verified, or de-duplicated against later (S8).
			process.stderr.write(
				`${JSON.stringify({ error: 'Confluence returned success but no comment id - the comment is unverifiable; check the page manually before retrying' })}\n`
			)
			process.exit(1)
		}
		process.stdout.write(`${JSON.stringify({ id: result.id, type: result.type, reason: result.reason })}\n`)
		process.exit(0)
	} catch (err) {
		process.stderr.write(`${JSON.stringify({ error: err instanceof Error ? err.message : String(err) })}\n`)
		process.exit(1)
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		process.stderr.write(`${JSON.stringify({ error: err instanceof Error ? err.message : String(err) })}\n`)
		process.exit(1)
	})
}
