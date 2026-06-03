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
 * @property {boolean} [unassessedIntentCheck] - true when the Assessor was spawned but
 *   applied zero verdicts (assessed missing, non-array, or all-zero applied count)
 * @property {boolean} [diffUnavailable] - true when line-level diff could not be fetched;
 *   diff-driven aspect agents were not run and an empty Findings list does not mean clean
 * @property {{ fixed: number, partial: number, ignored: number }} [priorVerdictSummary] - verdicts
 *   aggregated across all aspect agents in re-review mode; omit in first-review mode
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

	if (ctx.unassessedIntentCheck) {
		lines.push(
			'> **Notice:** The Intent Check block could not be assessed — the Assessor produced no valid verdicts. ' +
				'Every AC shows `unaddressed`, which may not reflect the diff.'
		)
	}

	if (ctx.diffUnavailable) {
		lines.push(
			'> **Notice:** Line-level diff was unavailable in this preview, so diff-driven Review Aspect agents did not run. ' +
				'An empty Findings list does **not** mean the PR is clean.'
		)
	}

	if (ctx.priorVerdictSummary) {
		const { fixed, partial, ignored } = ctx.priorVerdictSummary
		const total = fixed + partial + ignored
		if (total > 0) {
			const addressed = fixed + partial
			const parts = []
			if (fixed > 0) parts.push(`${fixed} fixed`)
			if (partial > 0) parts.push(`${partial} partially addressed`)
			if (ignored > 0) parts.push(`${ignored} pending`)
			lines.push(
				`> **Re-review:** ${addressed} of ${total} prior finding${total !== 1 ? 's' : ''} addressed` +
					(parts.length > 0 ? ` (${parts.join(', ')})` : '') +
					'.'
			)
		}
	}

	return lines.join('\n')
}
