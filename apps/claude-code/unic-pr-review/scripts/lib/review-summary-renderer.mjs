// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * review-summary-renderer.mjs — build the Review Summary markdown from
 * structured Finding data.
 *
 * Renderers must NOT inline the Bot Signature wording. The footer is always
 * obtained by calling renderFooter() from signature.mjs (ADR-0006).
 *
 * Review Summary schema (PRD § Schema: Review Summary):
 *
 *   {NOTICES_BLOCK — optional, followed by blank line if present}
 *
 *   ### Intent Check (optional — omitted when no Work Items linked)
 *   - **<title> (<id>)**
 *     - AC 1: addressed
 *
 *   ### 🔴 Critical (N found)
 *   - **[filePath:startLine]** title
 *
 *   ### 🟠 Important (N found)
 *   - **[filePath:startLine]** title
 *
 *   ### 🟡 Minor / Suggestions
 *   - title
 *
 *   ### ✅ What's good
 *   - positive observation
 *
 *   ---
 *   {BOT_SIGNATURE_FOOTER}
 */

import { renderFooter } from './signature.mjs'

/** @import { Severity } from './severity-bucketer.mjs' */

/**
 * @typedef {Object} SummaryFinding
 * @property {Severity} severity
 * @property {string} filePath
 * @property {number} startLine
 * @property {string} title
 */

/**
 * @typedef {'addressed' | 'unaddressed' | 'partially addressed'} AcVerdict
 */

/**
 * The set of valid {@link AcVerdict} values — the single runtime source of truth
 * for the union above. Surfaced verbatim, so it must match the PRD §10 phrasing.
 * @type {readonly AcVerdict[]}
 */
export const AC_VERDICTS = ['addressed', 'unaddressed', 'partially addressed']

/**
 * @param {unknown} value
 * @returns {value is AcVerdict}
 */
export function isAcVerdict(value) {
	return typeof value === 'string' && /** @type {readonly string[]} */ (AC_VERDICTS).includes(value)
}

/**
 * @typedef {Object} IntentCheckItem
 * @property {string} title
 * @property {string} id
 * @property {Record<string, AcVerdict>} verdicts - e.g. { 'AC 1': 'addressed', 'AC 2': 'unaddressed' }
 * @property {string} [note] - optional context, e.g. when an item could not be fetched
 */

/**
 * @typedef {Object} ReviewSummaryContext
 * @property {string} [notices] - pre-rendered notices block from notices.mjs; '' or omit for none
 * @property {IntentCheckItem[]} [intentCheck] - omitted when no Work Items linked or array is empty
 * @property {SummaryFinding[]} findings - all findings; bucketed internally by `severity`
 * @property {string[]} positiveObservations
 * @property {number} iteration - 1-based iteration number
 */

/**
 * @param {SummaryFinding} f
 * @returns {string}
 */
function renderCriticalOrImportant(f) {
	return `- **[${f.filePath}:${f.startLine}]** ${f.title}`
}

/**
 * @param {SummaryFinding} f
 * @returns {string}
 */
function renderMinor(f) {
	return `- ${f.title}`
}

/**
 * Build the Review Summary markdown.
 *
 * Sections with empty Finding arrays are omitted entirely. The "What's good"
 * section always appears. The footer is imported from signature.mjs — never
 * inlined.
 *
 * @param {ReviewSummaryContext} ctx
 * @returns {string}
 */
export function renderReviewSummary(ctx) {
	/** @type {string[]} */
	const parts = []

	if (ctx.notices) {
		parts.push(ctx.notices)
		parts.push('')
	}

	if (ctx.intentCheck && ctx.intentCheck.length > 0) {
		parts.push('### Intent Check')
		parts.push('')
		for (const item of ctx.intentCheck) {
			parts.push(`- **${item.title} (${item.id})**`)
			if (item.note) {
				parts.push(`  - _${item.note}_`)
			}
			for (const [ac, verdict] of Object.entries(item.verdicts)) {
				parts.push(`  - ${ac}: ${verdict}`)
			}
		}
		parts.push('')
	}

	const critical = ctx.findings.filter((f) => f.severity === 'critical')
	const important = ctx.findings.filter((f) => f.severity === 'important')
	const minor = ctx.findings.filter((f) => f.severity === 'minor')

	if (critical.length > 0) {
		parts.push(`### 🔴 Critical (${critical.length} found)`)
		parts.push('')
		for (const f of critical) parts.push(renderCriticalOrImportant(f))
		parts.push('')
	}

	if (important.length > 0) {
		parts.push(`### 🟠 Important (${important.length} found)`)
		parts.push('')
		for (const f of important) parts.push(renderCriticalOrImportant(f))
		parts.push('')
	}

	if (minor.length > 0) {
		parts.push('### 🟡 Minor / Suggestions')
		parts.push('')
		for (const f of minor) parts.push(renderMinor(f))
		parts.push('')
	}

	parts.push("### ✅ What's good")
	parts.push('')
	if (ctx.positiveObservations.length > 0) {
		for (const obs of ctx.positiveObservations) {
			parts.push(`- ${obs}`)
		}
	} else {
		parts.push('- No specific positive observations.')
	}
	parts.push('')

	parts.push('---')
	parts.push(renderFooter(ctx.iteration))

	return parts.join('\n')
}
