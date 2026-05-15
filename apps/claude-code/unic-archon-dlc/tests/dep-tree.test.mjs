// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDepTree } from '../scripts/lib/dep-tree.mjs'

/** @param {string} id @param {string[]} [blocked_by] @returns {import('../scripts/lib/dep-tree.mjs').Issue} */
const issue = (id, blocked_by = []) => ({ id, blocked_by, testCommand: `test-${id}` })

describe('buildDepTree', () => {
	it('linear chain [A, B blocked_by A, C blocked_by B] produces [[A],[B],[C]]', () => {
		const result = buildDepTree([issue('A'), issue('B', ['A']), issue('C', ['B'])])
		assert.equal(result.ok, true)
		if (!result.ok) throw new Error('expected ok')
		assert.deepEqual(result.groups, [['A'], ['B'], ['C']])
	})

	it('independent issues [A, B, C] with no deps produce [[A, B, C]]', () => {
		const result = buildDepTree([issue('A'), issue('B'), issue('C')])
		assert.equal(result.ok, true)
		if (!result.ok) throw new Error('expected ok')
		assert.equal(result.groups.length, 1)
		assert.equal(result.groups[0].length, 3)
		assert.ok(result.groups[0].includes('A'))
		assert.ok(result.groups[0].includes('B'))
		assert.ok(result.groups[0].includes('C'))
	})

	it('mixed [A, B, C blocked_by A] produces [[A, B], [C]]', () => {
		const result = buildDepTree([issue('A'), issue('B'), issue('C', ['A'])])
		assert.equal(result.ok, true)
		if (!result.ok) throw new Error('expected ok')
		assert.equal(result.groups.length, 2)
		const tier0 = result.groups[0]
		const tier1 = result.groups[1]
		assert.ok(tier0.includes('A'))
		assert.ok(tier0.includes('B'))
		assert.equal(tier1, result.groups[1])
		assert.ok(tier1.includes('C'))
	})

	it('circular dependency [A blocked_by B, B blocked_by A] returns ok:false with cycle', () => {
		const result = buildDepTree([issue('A', ['B']), issue('B', ['A'])])
		assert.equal(result.ok, false)
		if (result.ok) throw new Error('expected not ok')
		assert.ok(result.error.toLowerCase().includes('circular') || result.error.toLowerCase().includes('cycle'))
		assert.ok(result.cycle.includes('A'))
		assert.ok(result.cycle.includes('B'))
	})

	it('reference to non-existent issue ID returns ok:false', () => {
		const result = buildDepTree([issue('A', ['NONEXISTENT'])])
		assert.equal(result.ok, false)
		if (result.ok) throw new Error('expected not ok')
		assert.ok(result.error.includes('NONEXISTENT') || result.error.length > 0)
	})

	it('empty issues array returns ok:true with empty groups', () => {
		const result = buildDepTree([])
		assert.equal(result.ok, true)
		if (!result.ok) throw new Error('expected ok')
		assert.deepEqual(result.groups, [])
	})

	it('single issue with no deps returns [[id]]', () => {
		const result = buildDepTree([issue('X')])
		assert.equal(result.ok, true)
		if (!result.ok) throw new Error('expected ok')
		assert.deepEqual(result.groups, [['X']])
	})

	it('diamond dependency [A, B blocked_by A, C blocked_by A, D blocked_by [B, C]] produces correct tiers', () => {
		const result = buildDepTree([issue('A'), issue('B', ['A']), issue('C', ['A']), issue('D', ['B', 'C'])])
		assert.equal(result.ok, true)
		if (!result.ok) throw new Error('expected ok')
		assert.equal(result.groups.length, 3)
		assert.deepEqual(result.groups[0], ['A'])
		const tier1 = result.groups[1]
		assert.ok(tier1.includes('B'))
		assert.ok(tier1.includes('C'))
		assert.deepEqual(result.groups[2], ['D'])
	})
})
