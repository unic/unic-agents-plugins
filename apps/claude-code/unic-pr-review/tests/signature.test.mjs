// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSignature, renderFooter, SIGNATURE_PREFIX } from '../scripts/lib/signature.mjs'

describe('renderFooter', () => {
	it('produces the exact wording for iteration 1', () => {
		assert.equal(renderFooter(1), '🤖 Reviewed by Claude Code — Iteration 1\n\n')
	})

	it('produces the correct iteration number for iteration 5', () => {
		assert.equal(renderFooter(5), '🤖 Reviewed by Claude Code — Iteration 5\n\n')
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
})

describe('parseSignature', () => {
	// Helpers
	/** @param {number} n @param {string} authorId @returns {import('../scripts/lib/signature.mjs').SignatureThread} */
	const threadWith = (n, authorId = 'bot-123') => ({
		comments: [{ content: `${renderFooter(n)}`, author: { id: authorId } }],
	})

	it('returns null when threads array is empty', () => {
		assert.equal(parseSignature([]), null)
	})

	it('returns null when no comment contains the signature', () => {
		const threads = [{ comments: [{ content: 'Just a regular comment', author: { id: 'human-1' } }] }]
		assert.equal(parseSignature(threads), null)
	})

	it('parses iteration number from a single signature comment', () => {
		const result = parseSignature([threadWith(3)])
		assert.ok(result)
		assert.equal(result.priorRevisionId, 3)
		assert.equal(result.priorIteration, 3)
		assert.equal(result.priorAuthorUserId, 'bot-123')
	})

	it('picks the highest iteration when multiple signatures exist (newest wins)', () => {
		const threads = [threadWith(1, 'bot-1'), threadWith(5, 'bot-1'), threadWith(2, 'bot-1')]
		const result = parseSignature(threads)
		assert.ok(result)
		assert.equal(result.priorRevisionId, 5)
	})

	it('returns the highest iteration regardless of array order (force-push: caller decides)', () => {
		// If the prior Revision no longer exists in the PR history (force-push), the
		// parser still returns the result — caller is responsible for checking
		// revisionsAvailable and deciding the mode (ADR-0006 / ADR-0007).
		const threads = [threadWith(7, 'bot-1')]
		const result = parseSignature(threads)
		assert.ok(result !== null, 'Should return a result even if revision may be gone')
		assert.equal(result.priorRevisionId, 7)
	})

	it('normalises CRLF line endings before matching', () => {
		const crlfContent = renderFooter(4).replace(/\n/g, '\r\n')
		const threads = [{ comments: [{ content: crlfContent, author: { id: 'bot-1' } }] }]
		const result = parseSignature(threads)
		assert.ok(result)
		assert.equal(result.priorRevisionId, 4)
	})

	it('round-trip: renderFooter(N) output parses back to priorRevisionId N', () => {
		for (const n of [1, 5, 42, 100]) {
			const footer = renderFooter(n)
			const result = parseSignature([{ comments: [{ content: footer, author: { id: 'bot-x' } }] }])
			assert.ok(result, `Expected parse result for iteration ${n}`)
			assert.equal(result.priorRevisionId, n, `Round-trip failed for iteration ${n}`)
		}
	})

	it('returns null when threads have comments but none match the prefix', () => {
		const threads = [
			{ comments: [{ content: '🤖 Something else entirely', author: { id: 'bot-1' } }] },
			{ comments: [{ content: 'Iteration 3 but without the prefix', author: { id: 'bot-1' } }] },
		]
		assert.equal(parseSignature(threads), null)
	})

	it('handles threads with multiple comments — matches across comments within a thread', () => {
		const thread = {
			comments: [
				{ content: 'First comment in thread', author: { id: 'bot-1' } },
				{ content: renderFooter(6), author: { id: 'bot-1' } },
			],
		}
		const result = parseSignature([thread])
		assert.ok(result)
		assert.equal(result.priorRevisionId, 6)
	})
})
