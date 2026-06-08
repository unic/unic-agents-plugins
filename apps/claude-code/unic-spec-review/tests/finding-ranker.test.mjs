// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rankFindings } from '../scripts/lib/finding-ranker.mjs'

/**
 * Build a valid Finding, overriding selected fields.
 * @param {Partial<import('../scripts/lib/finding.mjs').Finding>} overrides
 * @returns {import('../scripts/lib/finding.mjs').Finding}
 */
function makeFinding(overrides) {
	return {
		hat: 'black',
		dimension: 'gaps',
		title: 't',
		body: 'b',
		severity: 'minor',
		confidence: 60,
		anchor: null,
		...overrides,
	}
}

describe('rankFindings', () => {
	it('returns an empty array for empty input', () => {
		assert.deepEqual(rankFindings([]), [])
	})

	it('returns a single finding unchanged', () => {
		const f = makeFinding({ confidence: 70 })
		assert.deepEqual(rankFindings([f]), [f])
	})

	it('ranks critical before important at the same confidence', () => {
		const important = makeFinding({ severity: 'important', confidence: 90, title: 'imp' })
		const critical = makeFinding({ severity: 'critical', confidence: 90, title: 'crit' })
		const ranked = rankFindings([important, critical])
		assert.equal(ranked[0].title, 'crit')
		assert.equal(ranked[1].title, 'imp')
	})

	it('ranks higher confidence first at the same severity', () => {
		const low = makeFinding({ severity: 'important', confidence: 60, title: 'low' })
		const high = makeFinding({ severity: 'important', confidence: 90, title: 'high' })
		const ranked = rankFindings([low, high])
		assert.equal(ranked[0].title, 'high')
	})

	it('is stable for equal scores', () => {
		const a = makeFinding({ severity: 'minor', confidence: 70, title: 'a' })
		const b = makeFinding({ severity: 'minor', confidence: 70, title: 'b' })
		const c = makeFinding({ severity: 'minor', confidence: 70, title: 'c' })
		const ranked = rankFindings([a, b, c])
		assert.deepEqual(
			ranked.map((f) => f.title),
			['a', 'b', 'c']
		)
	})

	it('ranks a mixed set critical > important > minor', () => {
		const minor = makeFinding({ severity: 'minor', confidence: 60, title: 'minor' })
		const critical = makeFinding({ severity: 'critical', confidence: 90, title: 'critical' })
		const important = makeFinding({ severity: 'important', confidence: 80, title: 'important' })
		const ranked = rankFindings([minor, critical, important])
		assert.deepEqual(
			ranked.map((f) => f.title),
			['critical', 'important', 'minor']
		)
	})

	it('does not mutate the input array', () => {
		const minor = makeFinding({ severity: 'minor', confidence: 60, title: 'minor' })
		const critical = makeFinding({ severity: 'critical', confidence: 90, title: 'critical' })
		const input = [minor, critical]
		rankFindings(input)
		assert.equal(input[0].title, 'minor')
		assert.equal(input[1].title, 'critical')
	})
})
