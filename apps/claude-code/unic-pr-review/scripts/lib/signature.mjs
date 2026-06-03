// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * signature.mjs — single source of truth for the Bot Signature wording (ADR-0006).
 *
 * Every renderer that appends the footer MUST call renderFooter() from here.
 * The exact load-bearing wording lives ONLY in SIGNATURE_PREFIX — do not
 * inline it anywhere else. Detection (parser) and rendering (footer) cannot
 * drift apart when both import from this module.
 */

/**
 * Load-bearing wording prefix. Exported only for round-trip tests.
 * Do not reference outside this module and its tests.
 *
 * @type {string}
 */
export const SIGNATURE_PREFIX = '🤖 Reviewed by Claude Code — Iteration '

/**
 * Render the Bot Signature footer line for the given iteration number.
 *
 * Returns `<prefix><iteration>\n\n`. Renderers push this after a `---` line
 * into a `parts` array joined with `\n`: the join's `\n` supplies the
 * separator-to-footer break, leaving one trailing `\n` as the document
 * terminator. Do not inline the prefix anywhere else.
 *
 * @param {number} iteration - 1-based iteration number for this Review run
 * @returns {string}
 */
export function renderFooter(iteration) {
	return `${SIGNATURE_PREFIX}${iteration}\n\n`
}

/**
 * A single comment within an ADO PR Thread. The caller filters at thread
 * granularity (it keeps a thread when the thread's FIRST comment is
 * bot-authored), so individual comments here are not guaranteed to be
 * bot-authored.
 *
 * @typedef {Object} ThreadComment
 * @property {string} content - comment body text (may contain CRLF line endings)
 * @property {{ id: string }} author - comment author identity
 * @property {string} [publishedDate] - ISO date string (for future ordering; not used by parser today)
 */

/**
 * A simplified ADO PR Thread payload. The caller (ADO Fetcher, Step 4a) filters
 * threads to only those whose FIRST comment is bot-authored before passing here;
 * the remaining comments in a kept thread may have other authors.
 *
 * @typedef {Object} SignatureThread
 * @property {ThreadComment[]} comments - at least one comment
 */

/**
 * Result of parsing a Bot Signature from pre-filtered thread payloads.
 *
 * @typedef {Object} ParsedSignature
 * @property {number} priorRevisionId - iteration number N from the footer; equals priorIteration.
 *   Used by the caller to look up the revision in REVISIONS.value (ADO iteration ID = revision ID).
 * @property {string} priorAuthorUserId - ADO user ID of the matched comment author;
 *   falls back to an empty string `''` when the matched comment's author.id is absent
 * @property {number} priorIteration - the iteration number N from "Iteration N" in the footer
 */

/**
 * Parse the most recent Bot Signature from pre-filtered PR Thread payloads.
 *
 * "Most recent" is defined as the highest iteration number found across all
 * comment bodies. The caller must have already filtered threads to only those
 * whose FIRST comment is bot-authored (ADR-0006 identity-caching requirement);
 * this function still iterates over every comment in each kept thread.
 *
 * CRLF-tolerant: `\r\n` in comment content is normalised to `\n` before matching.
 *
 * @param {SignatureThread[]} threads - threads whose first comment is bot-authored
 * @returns {ParsedSignature | null}
 */
export function parseSignature(threads) {
	/** @type {ParsedSignature | null} */
	let best = null
	const regex = new RegExp(`${SIGNATURE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`)
	for (const thread of threads) {
		for (const comment of thread.comments ?? []) {
			const body = (comment.content ?? '').replace(/\r\n/g, '\n')
			const match = body.match(regex)
			if (!match) continue
			const n = parseInt(match[1], 10)
			if (best === null || n > best.priorRevisionId) {
				best = {
					priorRevisionId: n,
					priorAuthorUserId: comment.author?.id ?? '',
					priorIteration: n,
				}
			}
		}
	}
	return best
}
