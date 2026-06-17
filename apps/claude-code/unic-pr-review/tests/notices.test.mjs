// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderNotices } from '../scripts/lib/notices.mjs'

describe('renderNotices', () => {
	it('returns empty string when no notices apply', () => {
		assert.equal(renderNotices({}), '')
	})

	it('returns empty string when persistentUnaddressed is an empty array', () => {
		assert.equal(renderNotices({ persistentUnaddressed: [] }), '')
	})

	it('ignores a non-array persistentUnaddressed string without throwing or rendering a block', () => {
		const out = renderNotices(/** @type {any} */ ({ persistentUnaddressed: 'a single finding title' }))
		assert.equal(out, '')
		assert.ok(!out.includes('Persistent unaddressed findings'))
		assert.ok(!out.includes('undefined'))
	})

	it('renders the force-push fallback notice when fallbackToFirstReview is true', () => {
		const out = renderNotices({ fallbackToFirstReview: true })
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('force-push detected'))
		assert.ok(out.includes('Falling back to First-review mode'))
	})

	it('renders persistent-unaddressed block with one entry per title', () => {
		const out = renderNotices({
			persistentUnaddressed: [
				{
					threadId: 1,
					threadUrl: 'https://dev.azure.com/org/proj/_git/repo/pullrequest/42?discussionId=1',
					title: 'Null check missing',
					sinceIteration: 1,
				},
				{
					threadId: 2,
					threadUrl: 'https://dev.azure.com/org/proj/_git/repo/pullrequest/42?discussionId=2',
					title: 'Magic number',
					sinceIteration: 2,
				},
			],
		})
		assert.ok(out.includes('> **Persistent unaddressed findings:**'))
		assert.ok(out.includes('> - [Null check missing](https://dev.azure.com/'))
		assert.ok(out.includes('> - [Magic number](https://dev.azure.com/'))
	})

	it('renders threadUrl as a markdown link', () => {
		const url = 'https://dev.azure.com/org/proj/_git/repo/pullrequest/42?discussionId=5'
		const out = renderNotices({
			persistentUnaddressed: [{ threadId: 5, threadUrl: url, title: 'My finding', sinceIteration: 3 }],
		})
		assert.ok(out.includes(`[My finding](${url})`))
	})

	it('renders sinceIteration label', () => {
		const out = renderNotices({
			persistentUnaddressed: [{ threadId: 6, threadUrl: 'https://example.com', title: 'x', sinceIteration: 2 }],
		})
		assert.ok(out.includes('_(since Iteration 2)_'))
	})

	it('preserves order of persistentUnaddressed entries as provided', () => {
		const out = renderNotices({
			persistentUnaddressed: [
				{ threadId: 7, threadUrl: 'https://a.com', title: 'older', sinceIteration: 1 },
				{ threadId: 8, threadUrl: 'https://b.com', title: 'newer', sinceIteration: 3 },
			],
		})
		assert.ok(out.indexOf('older') < out.indexOf('newer'))
	})

	it('renders both notices when both flags are set, with fallback first', () => {
		const out = renderNotices({
			fallbackToFirstReview: true,
			persistentUnaddressed: [
				{
					threadId: 3,
					threadUrl: 'https://dev.azure.com/org/proj/_git/repo/pullrequest/42?discussionId=3',
					title: 'Rename variable',
					sinceIteration: 1,
				},
			],
		})
		const fallbackIdx = out.indexOf('> **Notice:**')
		const persistentIdx = out.indexOf('> **Persistent unaddressed findings:**')
		assert.ok(fallbackIdx >= 0, 'Missing fallback notice')
		assert.ok(persistentIdx >= 0, 'Missing persistent-unaddressed block')
		assert.ok(fallbackIdx < persistentIdx, 'Fallback notice must precede persistent-unaddressed block')
	})

	it('renders the unassessed-intent-check notice when unassessedIntentCheck is true', () => {
		const out = renderNotices({ unassessedIntentCheck: true })
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('Intent Check block'))
		assert.ok(out.includes('unaddressed'))
	})

	it('returns empty string when unassessedIntentCheck is false', () => {
		assert.equal(renderNotices({ unassessedIntentCheck: false }), '')
	})

	it('renders the lost-in-handoff notice when lostInHandoff is true', () => {
		const out = renderNotices({ lostInHandoff: true })
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('data gap'))
		assert.ok(out.includes('Intent Check was skipped'))
	})

	it('returns empty string when lostInHandoff is false', () => {
		assert.equal(renderNotices({ lostInHandoff: false }), '')
	})

	it('renders lost-in-handoff notice after unassessedIntentCheck when both are set', () => {
		const out = renderNotices({ unassessedIntentCheck: true, lostInHandoff: true })
		const unassessedIdx = out.indexOf('Intent Check block')
		const handoffIdx = out.indexOf('data gap')
		assert.ok(unassessedIdx >= 0, 'Missing unassessed notice')
		assert.ok(handoffIdx >= 0, 'Missing lost-in-handoff notice')
		assert.ok(unassessedIdx < handoffIdx, 'unassessed notice must precede lost-in-handoff notice')
	})

	it('renders unassessed-intent-check notice after fallbackToFirstReview when both are set', () => {
		const out = renderNotices({ fallbackToFirstReview: true, unassessedIntentCheck: true })
		const fallbackIdx = out.indexOf('force-push detected')
		const unassessedIdx = out.indexOf('Intent Check block')
		assert.ok(fallbackIdx >= 0, 'Missing fallback notice')
		assert.ok(unassessedIdx >= 0, 'Missing unassessed notice')
		assert.ok(fallbackIdx < unassessedIdx, 'fallback notice must precede unassessed notice')
	})

	it('returns empty string when diffUnavailable is false', () => {
		assert.equal(renderNotices({ diffUnavailable: false }), '')
	})

	it('renders the diff-unavailable notice when diffUnavailable is true', () => {
		const out = renderNotices({ diffUnavailable: true })
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('Line-level diff was unavailable'))
		assert.ok(out.includes('does **not** mean the PR is clean'))
	})

	it('renders diff-unavailable notice after unassessedIntentCheck when both are set', () => {
		const out = renderNotices({ unassessedIntentCheck: true, diffUnavailable: true })
		const unassessedIdx = out.indexOf('Intent Check block')
		const diffIdx = out.indexOf('Line-level diff was unavailable')
		assert.ok(unassessedIdx >= 0, 'Missing unassessed notice')
		assert.ok(diffIdx >= 0, 'Missing diff-unavailable notice')
		assert.ok(unassessedIdx < diffIdx, 'unassessed notice must precede diff-unavailable notice')
	})

	it('renders diff-unavailable notice after fallbackToFirstReview when both are set', () => {
		const out = renderNotices({ fallbackToFirstReview: true, diffUnavailable: true })
		const fallbackIdx = out.indexOf('force-push detected')
		const diffIdx = out.indexOf('Line-level diff was unavailable')
		assert.ok(fallbackIdx >= 0, 'Missing fallback notice')
		assert.ok(diffIdx >= 0, 'Missing diff-unavailable notice')
		assert.ok(fallbackIdx < diffIdx, 'fallback notice must precede diff-unavailable notice')
	})

	it('renders priorVerdictSummary with all three buckets', () => {
		const out = renderNotices({ priorVerdictSummary: { fixed: 2, partial: 1, ignored: 1 } })
		assert.ok(out.includes('> **Re-review:**'))
		assert.ok(out.includes('3 of 4 prior findings addressed'))
		assert.ok(out.includes('2 fixed'))
		assert.ok(out.includes('1 partially addressed'))
		assert.ok(out.includes('1 pending'))
	})

	it('renders priorVerdictSummary when everything is fixed', () => {
		const out = renderNotices({ priorVerdictSummary: { fixed: 3, partial: 0, ignored: 0 } })
		assert.ok(out.includes('3 of 3 prior finding'))
		assert.ok(out.includes('3 fixed'))
		assert.ok(!out.includes('partially addressed'))
		assert.ok(!out.includes('pending'))
	})

	it('renders priorVerdictSummary with singular "finding" when total is 1', () => {
		const out = renderNotices({ priorVerdictSummary: { fixed: 0, partial: 0, ignored: 1 } })
		assert.ok(out.includes('0 of 1 prior finding addressed'))
		assert.ok(out.includes('1 pending'))
	})

	it('renders nothing for priorVerdictSummary when all counts are zero', () => {
		const out = renderNotices({ priorVerdictSummary: { fixed: 0, partial: 0, ignored: 0 } })
		assert.equal(out, '')
	})

	it('renders priorVerdictSummary after diffUnavailable when both set', () => {
		const out = renderNotices({
			diffUnavailable: true,
			priorVerdictSummary: { fixed: 1, partial: 0, ignored: 0 },
		})
		const diffIdx = out.indexOf('Line-level diff')
		const reReviewIdx = out.indexOf('Re-review:')
		assert.ok(diffIdx >= 0)
		assert.ok(reReviewIdx >= 0)
		assert.ok(diffIdx < reReviewIdx, 'diffUnavailable notice must precede priorVerdictSummary')
	})

	it('returns empty string when humanThreadsNotice is an empty array', () => {
		assert.equal(renderNotices({ humanThreadsNotice: [] }), '')
	})

	it('renders humanThreadsNotice with one inline thread', () => {
		const out = renderNotices({
			humanThreadsNotice: [{ threadId: 63474, filePath: 'src/foo.ts', startLine: 42, excerpt: 'Fix this null check.' }],
		})
		assert.ok(out.includes('> **Human Thread notice:**'))
		assert.ok(out.includes('1 unresolved reviewer comment has no matching Finding'))
		assert.ok(out.includes('Thread #63474'))
		assert.ok(out.includes('`src/foo.ts:42`'))
		assert.ok(out.includes('"Fix this null check."'))
	})

	it('renders humanThreadsNotice with plural wording when count > 1', () => {
		const out = renderNotices({
			humanThreadsNotice: [
				{ threadId: 1, filePath: 'src/a.ts', startLine: 10, excerpt: 'A' },
				{ threadId: 2, filePath: 'src/b.ts', startLine: 20, excerpt: 'B' },
			],
		})
		assert.ok(out.includes('2 unresolved reviewer comments have no matching Finding'))
	})

	it('renders (general comment) for non-inline threads in humanThreadsNotice', () => {
		const out = renderNotices({
			humanThreadsNotice: [{ threadId: 63477, filePath: null, startLine: null, excerpt: 'Please add docs.' }],
		})
		assert.ok(out.includes('(general comment)'))
		assert.ok(!out.includes('null'))
	})

	it('truncates excerpt to 80 chars with ellipsis', () => {
		const longExcerpt = 'A'.repeat(100)
		const out = renderNotices({
			humanThreadsNotice: [{ threadId: 1, filePath: 'src/x.ts', startLine: 1, excerpt: longExcerpt }],
		})
		assert.ok(out.includes('A'.repeat(80) + '…'))
		assert.ok(!out.includes('A'.repeat(100)))
	})

	it('does not truncate excerpt shorter than 80 chars', () => {
		const shortExcerpt = 'Short excerpt.'
		const out = renderNotices({
			humanThreadsNotice: [{ threadId: 1, filePath: 'src/x.ts', startLine: 1, excerpt: shortExcerpt }],
		})
		assert.ok(out.includes('"Short excerpt."'))
		assert.ok(!out.includes('…'))
	})

	it('does not truncate excerpt of exactly 80 chars', () => {
		const exactExcerpt = 'A'.repeat(80)
		const out = renderNotices({
			humanThreadsNotice: [{ threadId: 1, filePath: 'src/x.ts', startLine: 1, excerpt: exactExcerpt }],
		})
		assert.ok(out.includes(exactExcerpt))
		assert.ok(!out.includes('…'))
	})

	it('renders empty excerpt string when excerpt is undefined', () => {
		const out = renderNotices({
			humanThreadsNotice: [/** @type {any} */ ({ threadId: 1, filePath: 'src/x.ts', startLine: 1 })],
		})
		assert.ok(out.includes('Thread #1'))
		assert.ok(out.includes('""'))
		assert.ok(!out.includes('undefined'))
	})

	it('renders humanThreadsNotice after diffUnavailable when both set', () => {
		const out = renderNotices({
			diffUnavailable: true,
			humanThreadsNotice: [{ threadId: 1, filePath: 'src/x.ts', startLine: 1, excerpt: 'x' }],
		})
		const diffIdx = out.indexOf('Line-level diff')
		const humanIdx = out.indexOf('Human Thread notice')
		assert.ok(diffIdx >= 0, 'Missing diffUnavailable notice')
		assert.ok(humanIdx >= 0, 'Missing humanThreadsNotice')
		assert.ok(diffIdx < humanIdx, 'diffUnavailable must precede humanThreadsNotice')
	})

	it('renders priorVerdictSummary after humanThreadsNotice when both set', () => {
		const out = renderNotices({
			humanThreadsNotice: [{ threadId: 1, filePath: 'src/x.ts', startLine: 1, excerpt: 'x' }],
			priorVerdictSummary: { fixed: 1, partial: 0, ignored: 0 },
		})
		const humanIdx = out.indexOf('Human Thread notice')
		const reReviewIdx = out.indexOf('Re-review:')
		assert.ok(humanIdx >= 0, 'Missing humanThreadsNotice')
		assert.ok(reReviewIdx >= 0, 'Missing priorVerdictSummary')
		assert.ok(humanIdx < reReviewIdx, 'humanThreadsNotice must precede priorVerdictSummary')
	})
})
