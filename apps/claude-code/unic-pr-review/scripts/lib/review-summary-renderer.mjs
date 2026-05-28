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

/**
 * @typedef {Object} SummaryFinding
 * @property {string} filePath
 * @property {number} startLine
 * @property {string} title
 */

/**
 * @typedef {Object} IntentCheckItem
 * @property {string} title
 * @property {string} id
 * @property {Record<string, string>} verdicts - e.g. { 'AC 1': 'addressed', 'AC 2': 'unaddressed' }
 */

/**
 * @typedef {Object} ReviewSummaryContext
 * @property {string} [notices] - pre-rendered notices block from notices.mjs; '' or omit for none
 * @property {IntentCheckItem[]} [intentCheck] - omitted when no Work Items linked
 * @property {SummaryFinding[]} criticalFindings
 * @property {SummaryFinding[]} importantFindings
 * @property {SummaryFinding[]} minorFindings
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
			for (const [ac, verdict] of Object.entries(item.verdicts)) {
				parts.push(`  - ${ac}: ${verdict}`)
			}
		}
		parts.push('')
	}

	if (ctx.criticalFindings.length > 0) {
		parts.push(`### 🔴 Critical (${ctx.criticalFindings.length} found)`)
		parts.push('')
		for (const f of ctx.criticalFindings) {
			parts.push(renderCriticalOrImportant(f))
		}
		parts.push('')
	}

	if (ctx.importantFindings.length > 0) {
		parts.push(`### 🟠 Important (${ctx.importantFindings.length} found)`)
		parts.push('')
		for (const f of ctx.importantFindings) {
			parts.push(renderCriticalOrImportant(f))
		}
		parts.push('')
	}

	if (ctx.minorFindings.length > 0) {
		parts.push('### 🟡 Minor / Suggestions')
		parts.push('')
		for (const f of ctx.minorFindings) {
			parts.push(renderMinor(f))
		}
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
