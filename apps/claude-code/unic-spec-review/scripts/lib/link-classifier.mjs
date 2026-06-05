// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * link-classifier.mjs — classify a pasted URL by kind and extract identifiers.
 *
 * Returns one of five kinds: 'confluence', 'figma-page', 'figma-frame',
 * 'live', 'unknown'. Never throws; returns 'unknown' for malformed input.
 */

import { pathToFileURL } from 'node:url'

/**
 * @typedef {'confluence' | 'figma-page' | 'figma-frame' | 'live' | 'unknown'} UrlKind
 */

/**
 * @typedef {Object} ConfluenceClassified
 * @property {'confluence'} kind
 * @property {string} pageId
 * @property {string} url
 */

/**
 * @typedef {Object} OtherClassified
 * @property {'figma-page' | 'figma-frame' | 'live' | 'unknown'} kind
 * @property {string} url
 */

/**
 * @typedef {ConfluenceClassified | OtherClassified} Classified
 */

/**
 * Extract a Confluence page id from a parsed URL.
 * @param {URL} parsed
 * @returns {string | null}
 */
function extractPageId(parsed) {
	const m = parsed.pathname.match(/\/pages\/(\d+)/)
	if (m) return m[1]
	const q = parsed.searchParams.get('pageId')
	return q && /^\d+$/.test(q) ? q : null
}

/**
 * Classify a single pasted URL by kind, extracting identifiers where relevant.
 * @param {string} url
 * @returns {Classified}
 */
export function classifyUrl(url) {
	let parsed
	try {
		parsed = new URL(url)
	} catch {
		return { kind: 'unknown', url }
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { kind: 'unknown', url }
	}

	if (parsed.pathname.includes('/wiki/')) {
		const pageId = extractPageId(parsed)
		if (pageId) return { kind: 'confluence', pageId, url }
		return { kind: 'unknown', url }
	}

	const host = parsed.hostname.toLowerCase()
	if (host === 'www.figma.com' || host === 'figma.com') {
		return parsed.searchParams.has('node-id') ? { kind: 'figma-frame', url } : { kind: 'figma-page', url }
	}

	if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
		return { kind: 'live', url }
	}

	return { kind: 'unknown', url }
}

// CLI entry: output JSON classification for one URL argument
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const url = process.argv[2]
	if (!url) {
		process.stderr.write('link-classifier: URL argument required\n')
		process.exit(1)
	}
	process.stdout.write(`${JSON.stringify(classifyUrl(url))}\n`)
}
