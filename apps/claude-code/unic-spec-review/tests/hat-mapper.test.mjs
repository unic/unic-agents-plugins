// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { VALID_DIMENSIONS } from '../scripts/lib/finding.mjs'
import { DIMENSION_HAT, dimensionToHat, groupByHat } from '../scripts/lib/hat-mapper.mjs'

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

describe('dimensionToHat', () => {
	it('maps all eight Black-hat dimensions to black', () => {
		const blackDims = [
			'gaps',
			'ambiguity',
			'spec-versus-design',
			'spec-versus-live',
			'internal-consistency',
			'testability',
			'feasibility',
			'non-functional',
		]
		for (const d of blackDims) {
			assert.equal(dimensionToHat(d), 'black', `${d} should map to black`)
		}
	})

	it('maps perspective dimensions to their own hat', () => {
		assert.equal(dimensionToHat('green'), 'green')
		assert.equal(dimensionToHat('yellow'), 'yellow')
		assert.equal(dimensionToHat('red'), 'red')
	})

	it('falls back to black for an unknown dimension', () => {
		assert.equal(dimensionToHat('totally-unknown'), 'black')
	})
})

describe('DIMENSION_HAT', () => {
	it('has exactly one entry per valid dimension', () => {
		assert.equal(Object.keys(DIMENSION_HAT).length, VALID_DIMENSIONS.length)
		for (const d of VALID_DIMENSIONS) {
			assert.ok(d in DIMENSION_HAT, `${d} missing from DIMENSION_HAT`)
		}
	})
})

describe('groupByHat', () => {
	it('returns an empty Map for empty input', () => {
		const groups = groupByHat([])
		assert.equal(groups.size, 0)
	})

	it('groups a single black finding under black', () => {
		const groups = groupByHat([makeFinding({})])
		assert.equal(groups.size, 1)
		assert.equal(groups.get('black')?.length, 1)
	})

	it('separates findings across hats', () => {
		const black = makeFinding({ hat: 'black', dimension: 'gaps', title: 'b' })
		const green = makeFinding({ hat: 'green', dimension: 'green', title: 'g' })
		const groups = groupByHat([black, green])
		assert.equal(groups.size, 2)
		assert.equal(groups.get('black')?.[0].title, 'b')
		assert.equal(groups.get('green')?.[0].title, 'g')
	})

	it('collects two blacks under the same key', () => {
		const groups = groupByHat([makeFinding({ title: 'a' }), makeFinding({ title: 'b' })])
		assert.equal(groups.get('black')?.length, 2)
	})

	it('falls back to dimensionToHat when hat is absent', () => {
		const noHat = /** @type {any} */ ({
			dimension: 'green',
			title: 'g',
			body: 'b',
			severity: 'minor',
			confidence: 60,
			anchor: null,
		})
		const groups = groupByHat([noHat])
		assert.equal(groups.get('green')?.length, 1)
	})

	it('preserves order within a group', () => {
		const groups = groupByHat([makeFinding({ title: '1' }), makeFinding({ title: '2' }), makeFinding({ title: '3' })])
		assert.deepEqual(
			groups.get('black')?.map((f) => f.title),
			['1', '2', '3']
		)
	})
})
