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
 * @typedef {Object} PersistentUnaddressedEntry
 * @property {number} threadId - ADO Thread id the unaddressed Finding lives on
 * @property {string} threadUrl - direct link to the Thread (discussionId anchor)
 * @property {string} title - single-line Finding label
 * @property {number} sinceIteration - earliest Iteration the Finding was raised
 */

/**
 * @typedef {Object} HumanThreadEntry
 * @property {number} threadId - ADO Thread id
 * @property {string | null} filePath - file path for inline threads; null for general comment threads
 * @property {number | null} startLine - line for inline threads; null for general comment threads
 * @property {string} excerpt - first ~150 chars of the thread's first comment
 */

/**
 * @typedef {Object} NoticesContext
 * @property {boolean} [fallbackToFirstReview] - true when force-push caused the prior
 *   Revision to disappear from the PR's Revision history (ADR-0006)
 * @property {PersistentUnaddressedEntry[]} [persistentUnaddressed] - Findings that remain
 *   unaddressed across two or more Iterations, ordered by sinceIteration ascending (US 27)
 * @property {boolean} [unassessedIntentCheck] - true when the Assessor was spawned but
 *   applied zero verdicts (assessed missing, non-array, or all-zero applied count)
 * @property {boolean} [diffUnavailable] - true when line-level diff could not be fetched;
 *   diff-driven aspect agents were not run and an empty Findings list does not mean clean
 * @property {HumanThreadEntry[]} [humanThreadsNotice] - unresolved Human Threads that no
 *   Finding matched (ADR-0016); rendered above the Intent Check
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

	if (Array.isArray(ctx.persistentUnaddressed) && ctx.persistentUnaddressed.length > 0) {
		lines.push('> **Persistent unaddressed findings:**')
		for (const entry of ctx.persistentUnaddressed) {
			lines.push(`> - [${entry.title}](${entry.threadUrl}) _(since Iteration ${entry.sinceIteration})_`)
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

	if (Array.isArray(ctx.humanThreadsNotice) && ctx.humanThreadsNotice.length > 0) {
		const count = ctx.humanThreadsNotice.length
		lines.push(
			`> **Human Thread notice:** ${count} unresolved reviewer comment${count !== 1 ? 's' : ''} ${count !== 1 ? 'have' : 'has'} no matching Finding:`
		)
		for (const t of ctx.humanThreadsNotice) {
			const location = t.filePath != null ? `\`${t.filePath}:${t.startLine}\`` : '(general comment)'
			const raw = t.excerpt ?? ''
			const excerpt = raw.length > 80 ? raw.slice(0, 80) + '…' : raw
			lines.push(`> - Thread #${t.threadId} on ${location} — "${excerpt}"`)
		}
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
				`> **Re-review:** ${addressed} of ${total} prior finding${total !== 1 ? 's' : ''} addressed (${parts.join(', ')}).`
			)
		}
	}

	return lines.join('\n')
}
