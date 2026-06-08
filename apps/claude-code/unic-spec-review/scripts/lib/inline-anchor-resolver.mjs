// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * @typedef {Object} InlineResolution
 * @property {'inline'} type
 * @property {string} textSelection - the anchor text to pass to the Confluence v2 API
 * @property {number} matchCount - always 1 (unique match); textSelectionMatchCount for the API
 */

/**
 * @typedef {Object} FooterResolution
 * @property {'footer'} type
 * @property {'no-anchor' | 'not-found' | 'ambiguous'} reason
 * @property {number} [ambiguousCount] - number of occurrences when reason === 'ambiguous'
 */

/**
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
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolve a Finding anchor against a Confluence page HTML body.
 * Returns an InlineResolution (unique match) or FooterResolution (fallback).
 * Matching is case-insensitive and whitespace-normalized; the returned
 * `textSelection` is the normalized anchor string (whitespace collapsed),
 * ensuring the match and the value sent to the Confluence v2 API are consistent.
 * Never throws.
 * @param {string | null} anchor
 * @param {string} pageHtml
 * @returns {InlineResolution | FooterResolution}
 */
export function resolveAnchor(anchor, pageHtml) {
	if (anchor === null || anchor.trim() === '') {
		return { type: 'footer', reason: 'no-anchor' }
	}
	const normalizedPage = stripHtml(pageHtml)
	const normalizedAnchor = anchor.replace(/\s+/g, ' ').trim()
	const matches = normalizedPage.match(new RegExp(escapeRegex(normalizedAnchor), 'gi'))
	const count = matches ? matches.length : 0
	if (count === 0) return { type: 'footer', reason: 'not-found' }
	if (count === 1) return { type: 'inline', textSelection: normalizedAnchor, matchCount: 1 }
	return { type: 'footer', reason: 'ambiguous', ambiguousCount: count }
}
