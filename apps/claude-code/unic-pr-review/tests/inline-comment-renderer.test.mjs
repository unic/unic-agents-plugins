// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderInlineComment } from '../scripts/lib/inline-comment-renderer.mjs'
import { renderFooter } from '../scripts/lib/signature.mjs'

/** @import { InlineCommentContext } from '../scripts/lib/inline-comment-renderer.mjs' */

/** @type {InlineCommentContext} */
const BASE = {
	severity: 'critical',
	title: 'Null pointer dereference',
	body: 'If `input` is undefined on line 42, the call throws. Add a null guard.',
	iteration: 1,
}

describe('renderInlineComment', () => {
	it('critical finding starts with 🔴 emoji + title', () => {
		const out = renderInlineComment(BASE)
		assert.ok(out.startsWith('🔴 Null pointer dereference'), `Unexpected start: ${out.slice(0, 40)}`)
	})

	it('important finding starts with 🟠 emoji + title', () => {
		const out = renderInlineComment({ ...BASE, severity: 'important', title: 'Magic number' })
		assert.ok(out.startsWith('🟠 Magic number'))
	})

	it('minor finding starts with 🟡 emoji + title', () => {
		const out = renderInlineComment({ ...BASE, severity: 'minor', title: 'Rename variable' })
		assert.ok(out.startsWith('🟡 Rename variable'))
	})

	it('includes body text in the output', () => {
		const out = renderInlineComment(BASE)
		assert.ok(out.includes(BASE.body))
	})

	it('includes suggestion block when suggestion is provided', () => {
		const out = renderInlineComment({ ...BASE, suggestion: 'const value = input ?? default' })
		assert.ok(out.includes('```suggestion\nconst value = input ?? default\n```'))
	})

	it('does not include suggestion block when suggestion is absent', () => {
		const out = renderInlineComment(BASE)
		assert.ok(!out.includes('```suggestion'), 'Should not include empty suggestion block')
	})

	it('does not include suggestion block when suggestion is undefined', () => {
		const ctx = { ...BASE, suggestion: undefined }
		const out = renderInlineComment(ctx)
		assert.ok(!out.includes('```suggestion'))
	})

	it('treats whitespace-only suggestion as absent', () => {
		const out = renderInlineComment({ ...BASE, suggestion: '   \n\t' })
		assert.ok(!out.includes('```suggestion'), 'Whitespace-only suggestion should not render a block')
	})

	it('separates body from the suggestion fence with a blank line', () => {
		const out = renderInlineComment({ ...BASE, suggestion: 'fix me' })
		assert.ok(out.includes(`${BASE.body}\n\n\`\`\`suggestion`), 'Expected blank line between body and suggestion fence')
	})

	it('footer is byte-identical to renderFooter(1) for iteration 1', () => {
		const out = renderInlineComment(BASE)
		const expected = renderFooter(1)
		assert.ok(
			out.endsWith(expected),
			`Footer mismatch.\nExpected: ${JSON.stringify(expected)}\nActual end: ${JSON.stringify(out.slice(-expected.length - 5))}`
		)
	})

	it('footer is byte-identical to renderFooter(3) for iteration 3', () => {
		const out = renderInlineComment({ ...BASE, iteration: 3 })
		const expected = renderFooter(3)
		assert.ok(out.endsWith(expected))
	})

	it('separator line --- appears before footer', () => {
		const out = renderInlineComment(BASE)
		const sepIdx = out.lastIndexOf('---')
		const footerIdx = out.lastIndexOf('🤖')
		assert.ok(sepIdx !== -1, 'Missing --- separator')
		assert.ok(sepIdx < footerIdx, '--- must appear before the footer')
	})
})
