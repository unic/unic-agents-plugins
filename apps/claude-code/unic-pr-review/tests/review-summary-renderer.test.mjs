// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderReviewSummary } from '../scripts/lib/review-summary-renderer.mjs'
import { renderFooter } from '../scripts/lib/signature.mjs'

/** @import { ReviewSummaryContext } from '../scripts/lib/review-summary-renderer.mjs' */

/** @type {ReviewSummaryContext} */
const MINIMAL = {
	criticalFindings: [],
	importantFindings: [],
	minorFindings: [],
	positiveObservations: [],
	iteration: 1,
}

describe('renderReviewSummary', () => {
	it("always includes the What's good section", () => {
		const out = renderReviewSummary(MINIMAL)
		assert.ok(out.includes("### ✅ What's good"), `Missing "What's good" section`)
	})

	it('uses footer from signature.mjs (byte-equality)', () => {
		const out = renderReviewSummary(MINIMAL)
		const expected = renderFooter(1)
		assert.ok(
			out.endsWith(expected),
			`Footer mismatch.\nExpected suffix: ${JSON.stringify(expected)}\nActual end: ${JSON.stringify(out.slice(-expected.length - 10))}`
		)
	})

	it('omits Critical section when no critical findings', () => {
		const out = renderReviewSummary(MINIMAL)
		assert.ok(!out.includes('### 🔴 Critical'), 'Critical section should be omitted when empty')
	})

	it('omits Important section when no important findings', () => {
		const out = renderReviewSummary(MINIMAL)
		assert.ok(!out.includes('### 🟠 Important'), 'Important section should be omitted when empty')
	})

	it('omits Minor section when no minor findings', () => {
		const out = renderReviewSummary(MINIMAL)
		assert.ok(!out.includes('### 🟡 Minor'), 'Minor section should be omitted when empty')
	})

	it('includes Critical section with file:line link when critical findings present', () => {
		const out = renderReviewSummary({
			...MINIMAL,
			criticalFindings: [{ filePath: 'src/index.mjs', startLine: 42, title: 'Null pointer' }],
		})
		assert.ok(out.includes('### 🔴 Critical (1 found)'))
		assert.ok(out.includes('**[src/index.mjs:42]** Null pointer'))
	})

	it('includes Important section with file:line link when important findings present', () => {
		const out = renderReviewSummary({
			...MINIMAL,
			importantFindings: [{ filePath: 'lib/util.mjs', startLine: 10, title: 'Magic number' }],
		})
		assert.ok(out.includes('### 🟠 Important (1 found)'))
		assert.ok(out.includes('**[lib/util.mjs:10]** Magic number'))
	})

	it('includes Minor section with title only when minor findings present', () => {
		const out = renderReviewSummary({
			...MINIMAL,
			minorFindings: [{ filePath: 'src/x.mjs', startLine: 1, title: 'Rename variable' }],
		})
		assert.ok(out.includes('### 🟡 Minor / Suggestions'))
		assert.ok(out.includes('- Rename variable'))
		assert.ok(!out.includes('[src/x.mjs:1]'), 'Minor findings do not show file:line link')
	})

	it('includes Intent Check section when intentCheck is provided', () => {
		const out = renderReviewSummary({
			...MINIMAL,
			intentCheck: [{ title: 'User login story', id: 'US-42', verdicts: { 'AC 1': 'addressed' } }],
		})
		assert.ok(out.includes('### Intent Check'))
		assert.ok(out.includes('**User login story (US-42)**'))
		assert.ok(out.includes('- AC 1: addressed'))
	})

	it('omits Intent Check section when intentCheck is absent', () => {
		const out = renderReviewSummary(MINIMAL)
		assert.ok(!out.includes('### Intent Check'), 'Intent Check should be omitted when no work items')
	})

	it('renders notices block before other sections when notices provided', () => {
		const out = renderReviewSummary({ ...MINIMAL, notices: '> **Notice:** test notice' })
		assert.ok(out.startsWith('> **Notice:** test notice'))
	})

	it('does not include a notices block when notices is absent', () => {
		const out = renderReviewSummary(MINIMAL)
		assert.ok(!out.includes('> **Notice:**'))
	})

	it('footer is byte-identical to renderFooter(iteration) for iteration 3', () => {
		const ctx = { ...MINIMAL, iteration: 3 }
		const out = renderReviewSummary(ctx)
		const expected = renderFooter(3)
		assert.ok(out.endsWith(expected))
	})
})
