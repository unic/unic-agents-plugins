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
 *
 * The parser is stubbed in this slice; the full implementation lands with the
 * re-review detection slice.
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
 * Parse a Bot Signature from PR thread body text.
 *
 * Stub — returns null for all input. Full implementation (regex match on
 * SIGNATURE_PREFIX, CRLF tolerance, revision-id extraction) lands with the
 * re-review detection slice.
 *
 * @param {string} _threadBody
 * @returns {null}
 */
export function parseSignature(_threadBody) {
	return null
}
