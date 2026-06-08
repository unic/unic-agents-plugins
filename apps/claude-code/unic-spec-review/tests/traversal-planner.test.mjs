// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BUDGET_THRESHOLD, planTraversal } from '../scripts/lib/traversal-planner.mjs'

/** @import { PageMeta } from '../scripts/lib/traversal-planner.mjs' */

const BASE = 'https://unic.atlassian.net'

/**
 * Build a seed PageMeta with sensible defaults.
 * @param {string} id
 * @param {Partial<PageMeta>} [over]
 * @returns {PageMeta}
 */
function meta(id, over = {}) {
	return {
		id,
		url: `${BASE}/wiki/spaces/X/pages/${id}/Seed-${id}`,
		title: `Seed ${id}`,
		linkedUrls: [],
		childPages: [],
		...over,
	}
}

/**
 * Build a ChildPageRef.
 * @param {string} id
 * @returns {{ id: string, title: string, url: string }}
 */
function child(id) {
	return { id, title: `Child ${id}`, url: `${BASE}/wiki/spaces/X/pages/${id}/Child-${id}` }
}

/** @param {string} id */
const wikiUrl = (id) => `${BASE}/wiki/spaces/X/pages/${id}/Linked-${id}`

describe('planTraversal', () => {
	it('single seed, no children, no links: no confirmation, just the seed', () => {
		const map = new Map([['100', meta('100')]])
		const plan = planTraversal(['100'], map)
		assert.equal(plan.total, 1)
		assert.equal(plan.needsConfirmation, false)
		assert.deepEqual(
			plan.pages.map((p) => p.pageId),
			['100']
		)
		assert.equal(plan.pages[0].source, 'seed')
		assert.equal(plan.pages[0].title, 'Seed 100')
	})

	it('seed with child pages: children appear as source child and confirmation is required', () => {
		const map = new Map([['100', meta('100', { childPages: [child('201'), child('202')] })]])
		const plan = planTraversal(['100'], map)
		assert.equal(plan.total, 3)
		assert.equal(plan.needsConfirmation, true)
		assert.deepEqual(
			plan.pages.map((p) => p.source),
			['seed', 'child', 'child']
		)
		assert.deepEqual(
			plan.pages.map((p) => p.pageId),
			['100', '201', '202']
		)
	})

	it('seed with in-body Confluence links: linked pages classified and included', () => {
		const map = new Map([['100', meta('100', { linkedUrls: [wikiUrl('301')] })]])
		const plan = planTraversal(['100'], map)
		assert.equal(plan.total, 2)
		assert.equal(plan.needsConfirmation, true)
		const linked = plan.pages.find((p) => p.source === 'linked')
		assert.ok(linked)
		assert.equal(linked.pageId, '301')
		assert.equal(linked.url, wikiUrl('301'))
	})

	it('non-Confluence linkedUrls (figma, live) are filtered out', () => {
		const map = new Map([
			[
				'100',
				meta('100', {
					linkedUrls: ['https://www.figma.com/file/abc/Design', 'https://app.example.com/dashboard'],
				}),
			],
		])
		const plan = planTraversal(['100'], map)
		assert.equal(plan.total, 1)
		assert.equal(plan.needsConfirmation, false)
		assert.deepEqual(
			plan.pages.map((p) => p.pageId),
			['100']
		)
	})

	it('duplicate pageId across child and link is deduplicated (appears once)', () => {
		const map = new Map([['100', meta('100', { childPages: [child('201')], linkedUrls: [wikiUrl('201')] })]])
		const plan = planTraversal(['100'], map)
		assert.equal(plan.total, 2)
		const ids = plan.pages.map((p) => p.pageId)
		assert.deepEqual(ids, ['100', '201'])
		// The child wins because children are emitted before linked pages.
		assert.equal(plan.pages[1].source, 'child')
	})

	it('seed pageId appearing in its own linkedUrls is not duplicated', () => {
		const map = new Map([['100', meta('100', { linkedUrls: [wikiUrl('100')] })]])
		const plan = planTraversal(['100'], map)
		assert.equal(plan.total, 1)
		assert.equal(plan.needsConfirmation, false)
		assert.deepEqual(
			plan.pages.map((p) => p.pageId),
			['100']
		)
	})

	it('budget threshold: more than BUDGET_THRESHOLD seeds requires confirmation even with no expansion', () => {
		const seeds = Array.from({ length: BUDGET_THRESHOLD + 1 }, (_, i) => String(i + 1))
		const map = new Map(seeds.map((id) => [id, meta(id)]))
		const plan = planTraversal(seeds, map)
		assert.equal(plan.total, BUDGET_THRESHOLD + 1)
		assert.equal(
			plan.pages.every((p) => p.source === 'seed'),
			true
		)
		assert.equal(plan.needsConfirmation, true)
	})

	it('empty seeds array yields an empty plan', () => {
		const plan = planTraversal([], new Map())
		assert.deepEqual(plan, { pages: [], total: 0, needsConfirmation: false })
	})

	it('ordering: seeds first, then children, then linked pages', () => {
		const map = new Map([
			['100', meta('100', { childPages: [child('201')], linkedUrls: [wikiUrl('301')] })],
			['101', meta('101', { childPages: [child('202')], linkedUrls: [wikiUrl('302')] })],
		])
		const plan = planTraversal(['100', '101'], map)
		assert.deepEqual(
			plan.pages.map((p) => p.source),
			['seed', 'seed', 'child', 'child', 'linked', 'linked']
		)
		assert.deepEqual(
			plan.pages.map((p) => p.pageId),
			['100', '101', '201', '202', '301', '302']
		)
	})

	it('seed with no metadata in the map is treated as seed-only without throwing', () => {
		const plan = planTraversal(['999'], new Map())
		assert.equal(plan.total, 1)
		assert.equal(plan.needsConfirmation, false)
		assert.deepEqual(plan.pages[0], { pageId: '999', url: '', title: '', source: 'seed' })
	})

	it('repeated seed ids are deduplicated and do not trigger confirmation', () => {
		const map = new Map([['100', meta('100')]])
		const plan = planTraversal(['100', '100'], map)
		assert.equal(plan.total, 1)
		assert.equal(plan.needsConfirmation, false)
	})

	it('malformed child entries (missing id) are skipped', () => {
		const map = new Map([['100', meta('100', { childPages: [/** @type {any} */ ({ title: 'no id' }), child('201')] })]])
		const plan = planTraversal(['100'], map)
		assert.deepEqual(
			plan.pages.map((p) => p.pageId),
			['100', '201']
		)
	})
})
