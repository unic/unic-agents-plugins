// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FLAG_THRESHOLD, jaccard, matchDedup, SKIP_THRESHOLD, tokenize } from '../scripts/lib/dedup-matcher.mjs'

/**
 * Build a valid Finding, overriding selected fields.
 * @param {Partial<import('../scripts/lib/finding.mjs').Finding>} overrides
 * @returns {import('../scripts/lib/finding.mjs').Finding}
 */
function makeFinding(overrides) {
	return {
		hat: 'black',
		dimension: 'gaps',
		title: 'Missing error handling',
		body: 'The spec does not describe how errors are handled.',
		severity: 'important',
		confidence: 80,
		anchor: null,
		...overrides,
	}
}

/**
 * Build a ConfluenceComment, overriding selected fields.
 * @param {Partial<import('../scripts/atlassian-fetch.mjs').ConfluenceComment>} overrides
 * @returns {import('../scripts/atlassian-fetch.mjs').ConfluenceComment}
 */
function makeComment(overrides) {
	return {
		id: 'c1',
		type: 'footer',
		body: '',
		author: 'reviewer',
		created: '',
		...overrides,
	}
}

describe('tokenize', () => {
	it('returns an empty set for an empty string', () => {
		assert.equal(tokenize('').size, 0)
	})

	it('lowercases all tokens', () => {
		const tokens = tokenize('Hello WORLD')
		assert.ok(tokens.has('hello'))
		assert.ok(tokens.has('world'))
	})

	it('strips punctuation and special characters', () => {
		const tokens = tokenize('error-handling, missing! spec?')
		assert.deepEqual([...tokens].sort(), ['error', 'handling', 'missing', 'spec'])
	})

	it('drops single-character tokens', () => {
		const tokens = tokenize('a big I issue')
		assert.ok(!tokens.has('a'))
		assert.ok(!tokens.has('i'))
		assert.ok(tokens.has('big'))
		assert.ok(tokens.has('issue'))
	})

	it('collapses multiple spaces', () => {
		const tokens = tokenize('one    two\t\nthree')
		assert.deepEqual([...tokens].sort(), ['one', 'three', 'two'])
	})

	it('returns an empty set for null input', () => {
		assert.equal(tokenize(/** @type {any} */ (null)).size, 0)
	})

	it('returns an empty set for undefined input', () => {
		assert.equal(tokenize(/** @type {any} */ (undefined)).size, 0)
	})
})

describe('jaccard', () => {
	it('returns 0 when both sets are empty', () => {
		assert.equal(jaccard(new Set(), new Set()), 0)
	})

	it('returns 1 for identical sets', () => {
		assert.equal(jaccard(new Set(['a', 'b']), new Set(['a', 'b'])), 1)
	})

	it('returns 0 for completely disjoint sets', () => {
		assert.equal(jaccard(new Set(['aa', 'bb']), new Set(['cc', 'dd'])), 0)
	})

	it('returns the exact fraction for partial overlap', () => {
		// |{aa,bb} ∩ {aa,bb,cc,dd}| = 2, |union| = 4 → 0.5
		assert.equal(jaccard(new Set(['aa', 'bb']), new Set(['aa', 'bb', 'cc', 'dd'])), 0.5)
	})

	it('returns 1/3 for half-overlapping two-element sets', () => {
		// |{aa,bb} ∩ {bb,cc}| = 1, |union {aa,bb,cc}| = 3 → 1/3
		assert.ok(Math.abs(jaccard(new Set(['aa', 'bb']), new Set(['bb', 'cc'])) - 1 / 3) < 1e-9)
	})

	it('returns 0 when one set is empty and the other is not', () => {
		assert.equal(jaccard(new Set(), new Set(['aa', 'bb'])), 0)
	})
})

describe('matchDedup', () => {
	it('returns post for an empty comments array', () => {
		const result = matchDedup(makeFinding({}), [])
		assert.equal(result.decision, 'post')
		assert.deepEqual(result.nearDuplicates, [])
	})

	it('returns post when no comment meets FLAG_THRESHOLD', () => {
		const comments = [makeComment({ body: 'totally unrelated content about pricing tiers and billing' })]
		const result = matchDedup(makeFinding({}), comments)
		assert.equal(result.decision, 'post')
		assert.deepEqual(result.nearDuplicates, [])
	})

	it('returns flag when a comment is at or above FLAG_THRESHOLD but below SKIP_THRESHOLD', () => {
		// Shared issue words clear 0.25 but the extra words on each side keep it below 0.6.
		const finding = makeFinding({ title: 'Missing error handling', body: 'The spec does not describe errors.' })
		const comments = [makeComment({ body: 'Missing error handling is incomplete in the spec' })]
		const result = matchDedup(finding, comments)
		assert.equal(result.decision, 'flag')
		assert.equal(result.nearDuplicates.length, 1)
		assert.ok(result.nearDuplicates[0].similarity >= FLAG_THRESHOLD)
		assert.ok(result.nearDuplicates[0].similarity < SKIP_THRESHOLD)
	})

	it('returns skip when a comment is at or above SKIP_THRESHOLD', () => {
		const finding = makeFinding({ title: 'Missing error handling', body: 'The spec does not describe errors.' })
		const comments = [makeComment({ body: 'Missing error handling the spec does not describe errors' })]
		const result = matchDedup(finding, comments)
		assert.equal(result.decision, 'skip')
		assert.ok(result.nearDuplicates[0].similarity >= SKIP_THRESHOLD)
	})

	it('returns skip for an identical title+body comment (score ~ 1.0)', () => {
		const finding = makeFinding({ title: 'Pagination is undefined', body: 'The list endpoint has no page size limit.' })
		const comments = [makeComment({ body: 'Pagination is undefined The list endpoint has no page size limit.' })]
		const result = matchDedup(finding, comments)
		assert.equal(result.decision, 'skip')
		assert.ok(result.nearDuplicates[0].similarity >= 0.9)
	})

	it('lets skip take precedence over flag when both are present', () => {
		const finding = makeFinding({ title: 'Missing error handling', body: 'The spec does not describe errors.' })
		const comments = [
			makeComment({ id: 'flagish', body: 'Missing error handling the spec omits retry behavior entirely' }),
			makeComment({ id: 'skipish', body: 'Missing error handling the spec does not describe errors' }),
		]
		const result = matchDedup(finding, comments)
		assert.equal(result.decision, 'skip')
	})

	it('sorts nearDuplicates by similarity descending', () => {
		const finding = makeFinding({ title: 'Missing error handling', body: 'The spec does not describe errors.' })
		const comments = [
			makeComment({ id: 'low', body: 'Missing error handling is incomplete in the spec' }),
			makeComment({ id: 'high', body: 'Missing error handling the spec does not describe errors' }),
		]
		const result = matchDedup(finding, comments)
		assert.ok(result.nearDuplicates.length >= 2)
		assert.ok(result.nearDuplicates[0].similarity >= result.nearDuplicates[1].similarity)
		assert.equal(result.nearDuplicates[0].comment.id, 'high')
	})

	it('excludes comments below FLAG_THRESHOLD from nearDuplicates', () => {
		const finding = makeFinding({ title: 'Missing error handling', body: 'The spec does not describe errors.' })
		const comments = [
			makeComment({ id: 'unrelated', body: 'completely different topic about onboarding emails and copy tone' }),
			makeComment({ id: 'related', body: 'Missing error handling the spec does not describe errors' }),
		]
		const result = matchDedup(finding, comments)
		assert.equal(result.nearDuplicates.length, 1)
		assert.equal(result.nearDuplicates[0].comment.id, 'related')
	})

	it('compares the full comment body including any attribution footer text', () => {
		const finding = makeFinding({ title: 'Missing error handling', body: 'The spec does not describe errors.' })
		const comments = [
			makeComment({
				body: 'Missing error handling the spec does not describe errors\n\nReviewed by unic-spec-review (gaps, black hat)',
			}),
		]
		const result = matchDedup(finding, comments)
		// Footer tokens dilute the score but the shared issue text still clears FLAG_THRESHOLD.
		assert.ok(result.decision === 'flag' || result.decision === 'skip')
		assert.equal(result.nearDuplicates.length, 1)
	})

	it('compares title-only when the finding body is empty', () => {
		const finding = makeFinding({ title: 'Pagination is undefined', body: '' })
		const comments = [makeComment({ body: 'Pagination is undefined' })]
		const result = matchDedup(finding, comments)
		assert.equal(result.decision, 'skip')
		assert.ok(result.nearDuplicates[0].similarity >= SKIP_THRESHOLD)
	})

	it('returns post when the comment body is an empty string', () => {
		const result = matchDedup(makeFinding({}), [makeComment({ body: '' })])
		assert.equal(result.decision, 'post')
		assert.deepEqual(result.nearDuplicates, [])
	})

	it('returns post when existingComments is null', () => {
		const result = matchDedup(makeFinding({}), /** @type {any} */ (null))
		assert.equal(result.decision, 'post')
		assert.deepEqual(result.nearDuplicates, [])
	})
})
