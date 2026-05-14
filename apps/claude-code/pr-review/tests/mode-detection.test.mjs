// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectMode, formatModeEnv } from '../scripts/mode-detection.mjs'

const SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'

describe('detectMode', () => {
	it('no threads → first-review with empty fields', () => {
		const r = detectMode({ threads: [], signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(r.mode, 'first-review')
		assert.equal(r.isRereview, false)
		assert.equal(r.priorIterationId, '')
		assert.equal(r.summaryThreadId, '')
	})

	it('non-array threads → first-review (defensive)', () => {
		// @ts-expect-error — exercising defensive path
		const r = detectMode({ threads: null, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(r.mode, 'first-review')
		assert.equal(r.isRereview, false)
	})

	it('threads without signature → first-review', () => {
		const threads = [{ id: 1, comments: [{ content: 'hello from a human' }] }]
		const r = detectMode({ threads, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(r.mode, 'first-review')
		assert.equal(r.isRereview, false)
	})

	it('thread with signature and iteration → re-review with stringified fields', () => {
		const threads = [
			{
				id: 42,
				threadContext: null,
				comments: [
					{
						content: `## PR Review Summary\n\nfoo\n\n---\n${SIGNATURE_PREFIX} — Iteration 3`,
					},
				],
			},
		]
		const r = detectMode({ threads, signaturePrefix: SIGNATURE_PREFIX })
		assert.equal(r.mode, 're-review')
		assert.equal(r.isRereview, true)
		assert.equal(r.priorIterationId, '3')
		assert.equal(r.summaryThreadId, '42')
	})
})

describe('formatModeEnv', () => {
	it('emits four KEY=value lines for first-review', () => {
		const r = detectMode({ threads: [], signaturePrefix: SIGNATURE_PREFIX })
		const env = formatModeEnv(r)
		assert.equal(
			env,
			['MODE=first-review', 'IS_REREVIEW=false', 'PRIOR_ITERATION_ID=', 'SUMMARY_THREAD_ID='].join('\n')
		)
	})

	it('emits stringified IDs for re-review', () => {
		const r = {
			/** @type {'re-review'} */ mode: /** @type {const} */ ('re-review'),
			isRereview: true,
			priorIterationId: '3',
			summaryThreadId: '42',
		}
		const env = formatModeEnv(r)
		assert.equal(env, ['MODE=re-review', 'IS_REREVIEW=true', 'PRIOR_ITERATION_ID=3', 'SUMMARY_THREAD_ID=42'].join('\n'))
	})
})
