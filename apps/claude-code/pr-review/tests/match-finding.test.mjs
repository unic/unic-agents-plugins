// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchFinding } from '../scripts/re-review/match-finding.mjs'

const SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'

/** @returns {import('../scripts/re-review/match-finding.mjs').PriorThread} */
const makeThread = (threadId, filePath, startLine, endLine, isSummaryThread = false) => ({
	threadId,
	filePath,
	start: startLine !== null ? { line: startLine } : null,
	end: endLine !== null ? { line: endLine } : null,
	comments: [{ content: `Finding.\n---\n${SIGNATURE_PREFIX} — Iteration 1` }],
	status: 'active',
	isSummaryThread,
})

describe('matchFinding', () => {
	it('exact match: file A line 42, prior thread file A lines 42–42 → match', () => {
		const finding = { filePath: '/src/api.ts', startLine: 42, endLine: 42 }
		const priorThreads = [makeThread(1, '/src/api.ts', 42, 42)]
		const result = matchFinding({ finding, priorThreads })
		assert.equal(result?.threadId, 1)
	})

	it('within drift: file A line 44, prior thread file A 42–42 (within ±3) → match', () => {
		const finding = { filePath: '/src/api.ts', startLine: 44, endLine: 44 }
		const priorThreads = [makeThread(2, '/src/api.ts', 42, 42)]
		const result = matchFinding({ finding, priorThreads })
		assert.equal(result?.threadId, 2)
	})

	it('outside drift: file A line 50, prior thread file A 42–42 (outside ±3) → no match', () => {
		const finding = { filePath: '/src/api.ts', startLine: 50, endLine: 50 }
		const priorThreads = [makeThread(3, '/src/api.ts', 42, 42)]
		const result = matchFinding({ finding, priorThreads })
		assert.equal(result, null)
	})

	it('different file: file B finding, prior thread file A → no match', () => {
		const finding = { filePath: '/src/other.ts', startLine: 42, endLine: 42 }
		const priorThreads = [makeThread(4, '/src/api.ts', 42, 42)]
		const result = matchFinding({ finding, priorThreads })
		assert.equal(result, null)
	})

	it('multi-line finding 10–15, prior thread 12–20 (overlapping) → match', () => {
		const finding = { filePath: '/src/utils.ts', startLine: 10, endLine: 15 }
		const priorThreads = [makeThread(5, '/src/utils.ts', 12, 20)]
		const result = matchFinding({ finding, priorThreads })
		assert.equal(result?.threadId, 5)
	})

	it('summary threads are skipped', () => {
		const finding = { filePath: '/src/api.ts', startLine: 42, endLine: 42 }
		const summaryThread = makeThread(6, null, null, null, true)
		const regularThread = makeThread(7, '/src/api.ts', 42, 42)
		const result = matchFinding({ finding, priorThreads: [summaryThread, regularThread] })
		assert.equal(result?.threadId, 7)
	})

	it('custom driftLines=0 exact only', () => {
		const finding = { filePath: '/src/api.ts', startLine: 44, endLine: 44 }
		const priorThreads = [makeThread(8, '/src/api.ts', 42, 42)]
		const result = matchFinding({ finding, priorThreads, driftLines: 0 })
		assert.equal(result, null)
	})
})
