// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { detectPriorReview } from '../scripts/re-review/detect-prior-review.mjs'

const SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'

/** @param {string} name */
const loadFixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

describe('detectPriorReview', () => {
	it('fresh PR (no bot threads) → isRereview=false, priorThreads=[]', () => {
		const { value: threads } = loadFixture('threads-fresh-pr')
		const result = detectPriorReview({ threads, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result.isRereview, false)
		assert.deepEqual(result.priorThreads, [])
		assert.equal(result.summaryThread, null)
		assert.equal(result.priorIterationId, null)
	})

	it('pending fixture → isRereview=true, summaryThread set, priorIterationId=1', () => {
		const { value: threads } = loadFixture('threads-pending')
		const result = detectPriorReview({ threads, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result.isRereview, true)
		assert.equal(result.priorThreads.length, 2)
		assert.notEqual(result.summaryThread, null)
		assert.equal(result.summaryThread?.threadId, 2)
		assert.equal(result.priorIterationId, 1)
	})

	it('paginated p1+p2 combined → all 8 threads collected, summaryThread.threadId=27', () => {
		const p1 = loadFixture('threads-paginated-p1').value
		const p2 = loadFixture('threads-paginated-p2').value
		const threads = [...p1, ...p2]
		const result = detectPriorReview({ threads, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result.isRereview, true)
		assert.equal(result.priorThreads.length, 8)
		assert.equal(result.summaryThread?.threadId, 27)
		assert.equal(result.priorIterationId, 2)
	})

	it('partial-run → isRereview=true, priorIterationId set, summaryThread found', () => {
		const { value: threads } = loadFixture('threads-partial-run')
		const result = detectPriorReview({ threads, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result.isRereview, true)
		assert.equal(result.priorIterationId, 3)
		assert.notEqual(result.summaryThread, null)
	})

	it('highest threadId wins when multiple summary candidates present', () => {
		/** @type {import('../scripts/re-review/detect-prior-review.mjs').RawADOThread[]} */
		const threads = [
			{
				id: 10,
				threadContext: null,
				comments: [
					{
						content: `## PR Review Summary\n\nOld summary.\n---\n${SIGNATURE_PREFIX} — Iteration 1`,
					},
				],
				status: 'active',
			},
			{
				id: 20,
				threadContext: null,
				comments: [
					{
						content: `## PR Review Summary\n\nNew summary.\n---\n${SIGNATURE_PREFIX} — Iteration 2`,
					},
				],
				status: 'active',
			},
		]
		const result = detectPriorReview({ threads, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(result.summaryThread?.threadId, 20)
		assert.equal(result.priorIterationId, 2)
	})
})
