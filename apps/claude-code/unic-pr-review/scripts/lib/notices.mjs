// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * notices.mjs — build the optional Notices block that appears at the top of
 * the Review Summary before any Findings sections.
 *
 * Returns an empty string when no notices apply, otherwise a block of one or
 * more `>`-prefixed lines with no trailing newline. Callers that follow the
 * block with further sections must push a blank line themselves.
 */

/**
 * @typedef {Object} NoticesContext
 * @property {boolean} [fallbackToFirstReview] - true when force-push caused the prior
 *   Revision to disappear from the PR's Revision history (ADR-0006)
 * @property {string[]} [persistentUnaddressed] - Finding titles that remain unaddressed
 *   across two or more Iterations (US 27)
 */

/**
 * Build the Notices block for the Review Summary.
 *
 * @param {NoticesContext} ctx
 * @returns {string} rendered block, or '' when no notices apply
 */
export function renderNotices(ctx) {
	/** @type {string[]} */
	const lines = []

	if (ctx.fallbackToFirstReview) {
		lines.push(
			'> **Notice:** The prior reviewed Revision is no longer in the PR history ' +
				'(force-push detected). Falling back to First-review mode for this run.'
		)
	}

	if (ctx.persistentUnaddressed && ctx.persistentUnaddressed.length > 0) {
		lines.push('> **Persistent unaddressed findings:**')
		for (const title of ctx.persistentUnaddressed) {
			lines.push(`> - ${title}`)
		}
	}

	return lines.join('\n')
}
