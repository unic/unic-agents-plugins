// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSignature, renderFooter, SIGNATURE_PREFIX } from '../scripts/lib/signature.mjs'

describe('renderFooter', () => {
	it('produces the visible line for iteration 1', () => {
		assert.ok(renderFooter(1).startsWith('🤖 Reviewed by Claude Code — Iteration 1\n'))
	})

	it('produces the correct iteration number for iteration 5', () => {
		assert.ok(renderFooter(5).includes('Iteration 5'))
	})

	it('ends with two newlines', () => {
		assert.ok(renderFooter(1).endsWith('\n\n'))
	})

	it('contains the iteration number at the expected position', () => {
		const footer = renderFooter(42)
		assert.ok(footer.startsWith(SIGNATURE_PREFIX))
		assert.ok(footer.includes('42'))
	})

	it('round-trip: rendered output starts with SIGNATURE_PREFIX', () => {
		const footer = renderFooter(1)
		assert.ok(footer.startsWith(SIGNATURE_PREFIX), `Expected "${footer}" to start with "${SIGNATURE_PREFIX}"`)
	})

	it('contains the hidden Iteration Marker', () => {
		assert.ok(renderFooter(3).includes('<!-- unic-pr-review:iteration=3 -->'))
	})

	it('Iteration Marker is on its own line', () => {
		const lines = renderFooter(7).split('\n')
		assert.ok(lines.includes('<!-- unic-pr-review:iteration=7 -->'))
	})
})

describe('parseSignature', () => {
	// Helpers
	/** @param {number} n @returns {import('../scripts/lib/signature.mjs').SignatureThread} */
	const threadWith = (n) => ({
		comments: [{ content: renderFooter(n) }],
	})

	it('returns null when threads array is empty', () => {
		assert.equal(parseSignature([]), null)
	})

	it('returns null when no comment contains the signature', () => {
		const threads = [{ comments: [{ content: 'Just a regular comment' }] }]
		assert.equal(parseSignature(threads), null)
	})

	it('parses iteration number from a single signature comment', () => {
		const result = parseSignature([threadWith(3)])
		assert.ok(result)
		assert.equal(result.priorRevisionId, 3)
		assert.equal(result.priorIteration, 3)
	})

	it('picks the highest iteration when multiple signatures exist (newest wins)', () => {
		const threads = [threadWith(1), threadWith(5), threadWith(2)]
		const result = parseSignature(threads)
		assert.ok(result)
		assert.equal(result.priorRevisionId, 5)
	})

	it('returns the highest iteration regardless of array order (force-push: caller decides)', () => {
		// If the prior Revision no longer exists in the PR history (force-push), the
		// parser still returns the result — caller is responsible for checking
		// revisionsAvailable and deciding the mode (ADR-0006 / ADR-0007).
		const threads = [threadWith(7)]
		const result = parseSignature(threads)
		assert.ok(result !== null, 'Should return a result even if revision may be gone')
		assert.equal(result.priorRevisionId, 7)
	})

	it('normalises CRLF line endings before matching', () => {
		const crlfContent = renderFooter(4).replace(/\n/g, '\r\n')
		const threads = [{ comments: [{ content: crlfContent }] }]
		const result = parseSignature(threads)
		assert.ok(result)
		assert.equal(result.priorRevisionId, 4)
	})

	it('returns null when threads have comments but none match the prefix', () => {
		const threads = [
			{ comments: [{ content: '🤖 Something else entirely' }] },
			{ comments: [{ content: 'Iteration 3 but without the prefix' }] },
		]
		assert.equal(parseSignature(threads), null)
	})

	it('handles threads with multiple comments — matches across comments within a thread', () => {
		const thread = {
			comments: [{ content: 'First comment in thread' }, { content: renderFooter(6) }],
		}
		const result = parseSignature([thread])
		assert.ok(result)
		assert.equal(result.priorRevisionId, 6)
	})

	it('returns null when a thread has no comments field', () => {
		assert.equal(parseSignature(/** @type {any} */ ([{}])), null)
	})

	it('skips comment with no content field and continues to next', () => {
		const threads = /** @type {any} */ ([{ comments: [{}] }, threadWith(2)])
		const result = parseSignature(threads)
		assert.ok(result)
		assert.equal(result.priorRevisionId, 2)
	})

	it('returns null when only the visible footer is present but no Iteration Marker', () => {
		const visibleOnly = '🤖 Reviewed by Claude Code — Iteration 2\n\n'
		const threads = [{ comments: [{ content: visibleOnly }] }]
		assert.equal(parseSignature(threads), null)
	})

	it('returns null when a quote-reply reproduces the visible footer but has no Iteration Marker', () => {
		const quoteReply = '> 🤖 Reviewed by Claude Code — Iteration 2\n\nLooks good.'
		const threads = [{ comments: [{ content: quoteReply }] }]
		assert.equal(parseSignature(threads), null)
	})

	it('marker round-trip: renderFooter(N) output parses back to priorRevisionId N via marker', () => {
		for (const n of [1, 5, 42, 100]) {
			const footer = renderFooter(n)
			const result = parseSignature([{ comments: [{ content: footer }] }])
			assert.ok(result, `Expected parse result for iteration ${n}`)
			assert.equal(result.priorRevisionId, n, `Round-trip failed for iteration ${n}`)
		}
	})

	it('highest-N-wins: picks the highest marker across multiple threads', () => {
		const threads = [
			{ comments: [{ content: renderFooter(1) }] },
			{ comments: [{ content: renderFooter(5) }] },
			{ comments: [{ content: renderFooter(2) }] },
		]
		const result = parseSignature(threads)
		assert.ok(result)
		assert.equal(result.priorRevisionId, 5)
	})
})
