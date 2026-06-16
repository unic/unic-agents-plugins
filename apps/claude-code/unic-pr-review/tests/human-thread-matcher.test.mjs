// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchHumanThreadsToFindings } from '../scripts/lib/human-thread-matcher.mjs'

/** @type {import('../scripts/lib/human-thread-matcher.mjs').AnnotatedFinding} */
const BASE_FINDING = {
	severity: 'important',
	confidence: 80,
	filePath: 'src/foo.ts',
	startLine: 42,
	title: 'Missing null check',
	body: 'The value may be null here.',
}

/** @returns {import('../scripts/lib/human-thread-matcher.mjs').HumanThread} */
function makeThread(overrides = {}) {
	return {
		threadId: 100,
		filePath: 'src/foo.ts',
		startLine: 42,
		status: 'active',
		excerpt: 'Please fix this null check.',
		...overrides,
	}
}

describe('matchHumanThreadsToFindings', () => {
	it('returns unchanged findings and empty unmatchedUnresolved when humanThreads is empty', () => {
		const result = matchHumanThreadsToFindings([BASE_FINDING], [])
		assert.equal(result.annotatedFindings.length, 1)
		assert.equal(result.annotatedFindings[0].body, BASE_FINDING.body)
		assert.equal(result.unmatchedUnresolved.length, 0)
	})

	it('returns empty results when both inputs are empty', () => {
		const result = matchHumanThreadsToFindings([], [])
		assert.deepEqual(result.annotatedFindings, [])
		assert.deepEqual(result.unmatchedUnresolved, [])
	})

	it('annotates Finding with open Human Thread wording when thread is active', () => {
		const thread = makeThread({ threadId: 63474, status: 'active' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.ok(result.annotatedFindings[0].body.includes('Overlaps open Human Thread #63474.'))
		assert.equal(result.unmatchedUnresolved.length, 0)
	})

	it('annotates Finding with open Human Thread wording when thread is pending', () => {
		const thread = makeThread({ threadId: 63475, status: 'pending' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.ok(result.annotatedFindings[0].body.includes('Overlaps open Human Thread #63475.'))
	})

	it('annotates Finding with re-verify wording when thread is resolved (fixed)', () => {
		const thread = makeThread({ threadId: 63474, status: 'fixed' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.ok(
			result.annotatedFindings[0].body.includes('Thread #63474 marked fixed but issue still present — re-verify.')
		)
		assert.equal(result.unmatchedUnresolved.length, 0)
	})

	it('annotates Finding with re-verify wording for all resolved statuses', () => {
		for (const status of ['fixed', 'wontFix', 'closed', 'byDesign']) {
			const thread = makeThread({ threadId: 1, status })
			const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
			assert.ok(result.annotatedFindings[0].body.includes('re-verify.'), `Expected re-verify for status ${status}`)
		}
	})

	it('leaves Finding unchanged when no thread matches by filePath', () => {
		const thread = makeThread({ filePath: 'src/bar.ts', status: 'active' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.equal(result.annotatedFindings[0].body, BASE_FINDING.body)
		assert.equal(result.unmatchedUnresolved.length, 1)
	})

	it('leaves Finding unchanged when no thread matches by line proximity (boundary: ±10)', () => {
		const inRange = makeThread({ startLine: 52, status: 'active' }) // 42+10 = exactly 52
		const outOfRange = makeThread({ threadId: 101, startLine: 53, status: 'active' }) // 42+11 = 53

		const inResult = matchHumanThreadsToFindings([BASE_FINDING], [inRange])
		assert.ok(inResult.annotatedFindings[0].body.includes('Overlaps open Human Thread'), 'Expected match at ±10')

		const outResult = matchHumanThreadsToFindings([BASE_FINDING], [outOfRange])
		assert.equal(outResult.annotatedFindings[0].body, BASE_FINDING.body, 'Expected no match at ±11')
	})

	it('matches on the lower boundary (-10 lines)', () => {
		const thread = makeThread({ startLine: 32, status: 'active' }) // 42-10 = 32
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.ok(result.annotatedFindings[0].body.includes('Overlaps open Human Thread'))
	})

	it('non-inline thread (filePath null) never matches a Finding', () => {
		const thread = makeThread({ filePath: null, startLine: null, status: 'active' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.equal(result.annotatedFindings[0].body, BASE_FINDING.body)
		assert.equal(result.unmatchedUnresolved.length, 1)
		assert.equal(result.unmatchedUnresolved[0].threadId, thread.threadId)
	})

	it('unresolved non-inline thread appears in unmatchedUnresolved', () => {
		const thread = makeThread({ threadId: 63477, filePath: null, startLine: null, status: 'pending' })
		const result = matchHumanThreadsToFindings([], [thread])
		assert.equal(result.unmatchedUnresolved.length, 1)
		assert.equal(result.unmatchedUnresolved[0].threadId, 63477)
	})

	it('resolved unmatched thread is NOT in unmatchedUnresolved', () => {
		const thread = makeThread({ filePath: 'src/other.ts', startLine: 99, status: 'fixed' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.equal(result.unmatchedUnresolved.length, 0)
	})

	it('resolved unmatched non-inline thread is NOT in unmatchedUnresolved', () => {
		const thread = makeThread({ filePath: null, startLine: null, status: 'byDesign' })
		const result = matchHumanThreadsToFindings([], [thread])
		assert.equal(result.unmatchedUnresolved.length, 0)
	})

	it('unresolved thread matched to a Finding is NOT in unmatchedUnresolved', () => {
		const thread = makeThread({ threadId: 63474, status: 'active' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread])
		assert.equal(result.unmatchedUnresolved.length, 0)
	})

	it('first matching thread wins; second matching thread remains in unmatchedUnresolved', () => {
		const thread1 = makeThread({ threadId: 63474, status: 'active' })
		const thread2 = makeThread({ threadId: 63475, status: 'active' })
		// Both match same Finding — only first annotates it; second is unmatched
		const result = matchHumanThreadsToFindings([BASE_FINDING], [thread1, thread2])
		assert.ok(result.annotatedFindings[0].body.includes('#63474'))
		assert.ok(!result.annotatedFindings[0].body.includes('#63475'))
		assert.equal(result.unmatchedUnresolved.length, 1)
		assert.equal(result.unmatchedUnresolved[0].threadId, 63475)
	})

	it('handles multiple findings each matched to different threads', () => {
		const finding1 = { ...BASE_FINDING, startLine: 10 }
		const finding2 = { ...BASE_FINDING, startLine: 50 }
		const thread1 = makeThread({ threadId: 1, startLine: 10, status: 'active' })
		const thread2 = makeThread({ threadId: 2, startLine: 50, status: 'fixed' })
		const result = matchHumanThreadsToFindings([finding1, finding2], [thread1, thread2])
		assert.ok(result.annotatedFindings[0].body.includes('open Human Thread #1'))
		assert.ok(result.annotatedFindings[1].body.includes('re-verify'))
		assert.equal(result.unmatchedUnresolved.length, 0)
	})

	it('does not mutate the original findings array', () => {
		const finding = { ...BASE_FINDING }
		const originalBody = finding.body
		const thread = makeThread({ status: 'active' })
		matchHumanThreadsToFindings([finding], [thread])
		assert.equal(finding.body, originalBody)
	})

	it('handles humanThreads that is not an array gracefully', () => {
		const result = matchHumanThreadsToFindings([BASE_FINDING], /** @type {any} */ (null))
		assert.equal(result.annotatedFindings[0].body, BASE_FINDING.body)
		assert.deepEqual(result.unmatchedUnresolved, [])
	})

	it('mixed inline and non-inline unresolved threads both appear in unmatchedUnresolved', () => {
		const inlineThread = makeThread({ threadId: 1, filePath: 'src/other.ts', startLine: 200, status: 'active' })
		const nonInlineThread = makeThread({ threadId: 2, filePath: null, startLine: null, status: 'active' })
		const result = matchHumanThreadsToFindings([BASE_FINDING], [inlineThread, nonInlineThread])
		assert.equal(result.unmatchedUnresolved.length, 2)
	})

	it('PR #5570 scenario: 5 human threads classified; 0 matched to empty findings → all 5 unresolved', () => {
		/** @type {import('../scripts/lib/human-thread-matcher.mjs').HumanThread[]} */
		const threads = [
			{ threadId: 63474, filePath: 'src/a.ts', startLine: 10, status: 'active', excerpt: 'Fix A' },
			{ threadId: 63475, filePath: 'src/b.ts', startLine: 20, status: 'pending', excerpt: 'Fix B' },
			{ threadId: 63476, filePath: 'src/c.ts', startLine: 30, status: 'active', excerpt: 'Fix C' },
			{ threadId: 63477, filePath: null, startLine: null, status: 'active', excerpt: 'General comment' },
			{ threadId: 63478, filePath: 'src/d.ts', startLine: 40, status: 'fixed', excerpt: 'Fix D' },
		]
		const result = matchHumanThreadsToFindings([], threads)
		// 63478 is resolved and not matched → excluded from unmatchedUnresolved
		assert.equal(result.unmatchedUnresolved.length, 4)
		const ids = result.unmatchedUnresolved.map((t) => t.threadId)
		assert.ok(ids.includes(63474))
		assert.ok(ids.includes(63475))
		assert.ok(ids.includes(63476))
		assert.ok(ids.includes(63477))
		assert.ok(!ids.includes(63478), 'Resolved thread must not appear in Notice')
	})
})
