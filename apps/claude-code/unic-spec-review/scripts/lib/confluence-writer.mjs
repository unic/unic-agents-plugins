#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { extractConfluencePageId, fetchConfluencePageBody, postConfluenceComment } from '../atlassian-fetch.mjs'
import { FOOTER_MARKER } from './attribution-footer.mjs'
import { escapeHtml, mdToStorage } from './md-to-storage.mjs'
import { loadAtlassianCreds } from './credentials.mjs'
import { resolveAnchor } from './inline-anchor-resolver.mjs'

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
		const pageHtml = await fetchConfluencePageBody(pageUrl, creds, { fetch: globalThis.fetch })
		const resolution = resolveAnchor(finding.anchor ?? null, pageHtml)
		const titleLine = `<p><strong>${escapeHtml(finding.title)}</strong> (${escapeHtml(finding.severity)}, ${finding.confidence}%, ${escapeHtml(finding.dimension)})</p>`
		const convertedBody = mdToStorage(finding.body)
		const footerLine = `<p>${FOOTER_MARKER} | dimension: ${escapeHtml(finding.dimension)} | hat: ${escapeHtml(finding.hat)}</p>`
		const bodyWithFooter = `${titleLine}\n${convertedBody}\n${footerLine}`
		const type = resolution.type
		const anchor =
			resolution.type === 'inline'
				? { textSelection: resolution.textSelection, matchCount: resolution.matchCount }
				: null
		const result = await postConfluenceComment(pageId, bodyWithFooter, type, anchor, creds, { fetch: globalThis.fetch })
		if (!result.id) {
			// A 2xx with no comment id means the write is unverifiable (response shape drift,
			// proxy, etc.). Treat it as a failure rather than report a phantom success: a
			// blank id cannot be located, verified, or de-duplicated against later (S8).
			process.stderr.write(
				`${JSON.stringify({ error: 'Confluence returned success but no comment id - the comment is unverifiable; check the page manually before retrying' })}\n`
			)
			process.exit(1)
		}
		process.stdout.write(
			`${JSON.stringify({
				id: result.id,
				created: result.created,
				type,
				reason: resolution.type === 'footer' ? resolution.reason : null,
			})}\n`
		)
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
