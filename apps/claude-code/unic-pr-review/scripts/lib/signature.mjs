// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * signature.mjs — single source of truth for the Bot Signature wording (ADR-0006).
 *
 * Every renderer that appends the footer MUST call renderFooter() from here.
 * The exact load-bearing wording lives ONLY in SIGNATURE_PREFIX — do not
 * inline it anywhere else. Detection keys on ITERATION_MARKER_REGEX only;
 * rendering and detection cannot drift when both import from this module.
 */

/**
 * Load-bearing wording prefix. Exported only for round-trip tests.
 * Do not reference outside this module and its tests.
 *
 * @type {string}
 */
export const SIGNATURE_PREFIX = '🤖 Reviewed by Claude Code — Iteration '

/** Load-bearing Iteration Marker regex. Detection keys on this, never on author identity. */
const ITERATION_MARKER_REGEX = /<!-- unic-pr-review:iteration=(\d+) -->/

/**
 * Render the Bot Signature footer for the given iteration number.
 *
 * Returns the visible line, the hidden Iteration Marker on its own line, and
 * two trailing newlines. Renderers push this after a `---` line into a `parts`
 * array joined with `\n`: the join's `\n` supplies the separator-to-footer
 * break, leaving one trailing `\n` as the document terminator.
 *
 * Do not inline the prefix or the marker anywhere else.
 *
 * @param {number} iteration - 1-based iteration number for this Review run
 * @returns {string}
 */
export function renderFooter(iteration) {
	return `${SIGNATURE_PREFIX}${iteration}\n<!-- unic-pr-review:iteration=${iteration} -->\n\n`
}

/**
 * A single comment within an ADO PR Thread.
 *
 * @typedef {Object} ThreadComment
 * @property {string} content - comment body text (may contain CRLF line endings)
 * @property {string} [publishedDate] - ISO date string (for future ordering; not used by parser today)
 */

/**
 * A simplified ADO PR Thread payload. The caller (ADO Fetcher, Step 4a) filters
 * threads to only those whose FIRST comment contains an Iteration Marker before
 * passing here; the remaining comments in a kept thread may not carry a marker.
 *
 * @typedef {Object} SignatureThread
 * @property {ThreadComment[]} comments - at least one comment
 */

/**
 * Result of parsing a Bot Signature from pre-filtered thread payloads.
 *
 * @typedef {Object} ParsedSignature
 * @property {number} priorRevisionId - iteration number N from the Iteration Marker; equals priorIteration.
 *   Used by the caller to look up the revision in REVISIONS.value (ADO iteration ID = revision ID).
 * @property {number} priorIteration - the iteration number N from the Iteration Marker
 */

/**
 * Parse the most recent Bot Signature from pre-filtered PR Thread payloads.
 *
 * "Most recent" is defined as the highest iteration number found across all
 * comment bodies via the Iteration Marker (`<!-- unic-pr-review:iteration=N -->`).
 * Detection never uses the comment author's ADO identity (ADR-0006).
 *
 * CRLF-tolerant: `\r\n` in comment content is normalised to `\n` before matching.
 *
 * @param {SignatureThread[]} threads - threads whose first comment contains an Iteration Marker
 * @returns {ParsedSignature | null}
 */
export function parseSignature(threads) {
	/** @type {ParsedSignature | null} */
	let best = null
	for (const thread of threads) {
		for (const comment of thread.comments ?? []) {
			const body = (comment.content ?? '').replace(/\r\n/g, '\n')
			const match = body.match(ITERATION_MARKER_REGEX)
			if (!match) continue
			const n = parseInt(match[1], 10)
			if (Number.isNaN(n)) continue
			if (best === null || n > best.priorRevisionId) {
				best = {
					priorRevisionId: n,
					priorIteration: n,
				}
			}
		}
	}
	return best
}
