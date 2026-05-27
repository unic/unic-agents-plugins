// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { detectMode, formatModeEnv, SIGNATURE_PREFIX } from '../scripts/mode-detection.mjs'

const orchestratorPath = new URL('../commands/review-pr.md', import.meta.url)
const orchestrator = readFileSync(orchestratorPath, 'utf8')

describe('SIGNATURE_PREFIX', () => {
	it('exports the canonical bot-signature prefix verbatim', () => {
		assert.equal(SIGNATURE_PREFIX, '🤖 *Reviewed by Claude Code*')
	})
})

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

describe('Orchestrator markdown — --dry-run argument parser', () => {
	it('contains the deterministic Step 2 case-statement verbatim', () => {
		// The whitespace-padded `" $ARGUMENTS "` and `" --dry-run "` are
		// load-bearing — a future simplification dropping the spaces would silently
		// regress matching for tokens at the start or end of $ARGUMENTS.
		const expected = 'case " $ARGUMENTS " in *" --dry-run "*) IS_DRY_RUN=true ;; *) IS_DRY_RUN=false ;; esac'
		assert.ok(
			orchestrator.includes(expected),
			'Step 2 must contain the deterministic --dry-run parser exactly:\n' + expected
		)
	})
})

describe('Orchestrator markdown — Step 5 MODE-resolution matrix', () => {
	// Slice the Step 5 section out of the orchestrator markdown so we only assert
	// on the MODE-resolution matrix content, not on incidental mentions elsewhere.
	const step5Start = orchestrator.indexOf('## Step 5')
	const step6Start = orchestrator.indexOf('## Step 6', step5Start + 1)
	const step5 = step5Start >= 0 && step6Start > step5Start ? orchestrator.slice(step5Start, step6Start) : ''

	it('extracts a non-empty Step 5 section between `## Step 5` and `## Step 6`', () => {
		assert.ok(step5.length > 0, 'Could not locate the `## Step 5` … `## Step 6` slice in commands/review-pr.md')
	})

	for (const mode of /** @type {const} */ (['first-review', 're-review', 'dry-run-first', 'dry-run-rereview'])) {
		it(`mentions the \`${mode}\` MODE literal in Step 5`, () => {
			assert.ok(
				step5.includes(mode),
				`Step 5 MODE-resolution matrix must cover the \`${mode}\` cell of IS_DRY_RUN × IS_REREVIEW.`
			)
		})
	}
})
