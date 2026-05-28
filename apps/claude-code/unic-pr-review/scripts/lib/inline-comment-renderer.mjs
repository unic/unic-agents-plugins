// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * inline-comment-renderer.mjs — build the Inline Comment markdown from a
 * single structured Finding.
 *
 * Renderers must NOT inline the Bot Signature wording. The footer is always
 * obtained by calling renderFooter() from signature.mjs (ADR-0006).
 *
 * Inline Comment schema (PRD § Schema: Inline Comment):
 *
 *   {severity emoji} {title}
 *
 *   {prose diagnosis + fix options}
 *
 *   [OPTIONAL: ```suggestion block — only when finding.suggestion is present]
 *
 *   ---
 *   {BOT_SIGNATURE_FOOTER}
 */

import { renderFooter } from './signature.mjs'

/** @import { Severity } from './severity-bucketer.mjs' */

/** @type {Record<Severity, string>} */
const SEVERITY_EMOJI = {
	critical: '🔴',
	important: '🟠',
	minor: '🟡',
}

/**
 * @typedef {Object} InlineCommentContext
 * @property {Severity} severity
 * @property {string} title
 * @property {string} body
 * @property {string} [suggestion] - raw suggestion code; include block only when present
 * @property {number} iteration - 1-based iteration number
 */

/**
 * Render an Inline Comment for a single Finding.
 *
 * The suggestion block is included ONLY when ctx.suggestion is a string with
 * at least one non-whitespace character — whitespace-only suggestions are
 * treated as absent rather than producing an empty-looking block.
 *
 * @param {InlineCommentContext} ctx
 * @returns {string}
 */
export function renderInlineComment(ctx) {
	const emoji = SEVERITY_EMOJI[ctx.severity]
	/** @type {string[]} */
	const parts = []

	parts.push(`${emoji} ${ctx.title}`)
	parts.push('')
	parts.push(ctx.body)

	if (ctx.suggestion && ctx.suggestion.trim().length > 0) {
		parts.push('')
		parts.push('```suggestion')
		parts.push(ctx.suggestion)
		parts.push('```')
	}

	parts.push('')
	parts.push('---')
	parts.push(renderFooter(ctx.iteration))

	return parts.join('\n')
}
