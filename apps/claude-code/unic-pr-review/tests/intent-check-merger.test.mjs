// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeIntentCheck } from '../scripts/lib/intent-check-merger.mjs'

/** @import { IntentCheckItem } from '../scripts/lib/review-summary-renderer.mjs' */

describe('mergeIntentCheck', () => {
	it('overlays assessed verdicts onto matching skeleton item/AC keys (happy path)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed', 'AC 2': 'unaddressed' } }]
		const assessed = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed', 'AC 2': 'partially addressed' } },
		]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.deepEqual(items[0].verdicts, { 'AC 1': 'addressed', 'AC 2': 'partially addressed' })
	})

	it('ignores assessed items whose id is not in the skeleton', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } },
			{ id: 'PROJ-9', title: 'Ghost', verdicts: { 'AC 1': 'addressed' } },
		]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items.length, 1)
		assert.equal(items[0].id, 'PROJ-1')
	})

	it('ignores assessed AC keys not present in the skeleton item', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed', 'AC 99': 'addressed' } }]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.deepEqual(items[0].verdicts, { 'AC 1': 'addressed' })
	})

	it('keeps unaddressed when a skeleton AC is absent from the assessed output', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed', 'AC 2': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items[0].verdicts['AC 1'], 'addressed')
		assert.equal(items[0].verdicts['AC 2'], 'unaddressed')
	})

	it('keeps unaddressed when the assessed verdict value is invalid', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'maybe?' } }]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items[0].verdicts['AC 1'], 'unaddressed')
	})

	it('passes note-bearing skeleton items through verbatim, verdicts untouched', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [
			{
				id: 'PROJ-1',
				title: 'Login',
				verdicts: { 'AC 1': 'unaddressed' },
				note: 'Could not fetch',
			},
		]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items[0].verdicts['AC 1'], 'unaddressed')
		assert.equal(items[0].note, 'Could not fetch')
	})

	it('returns the skeleton unchanged when assessed is null (total failure)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]

		const { items } = mergeIntentCheck(skeleton, /** @type {unknown} */ (null))

		assert.equal(items, skeleton)
	})

	it('returns the skeleton unchanged when assessed is not an array (total failure)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]

		const { items } = mergeIntentCheck(skeleton, /** @type {unknown} */ ({}))

		assert.equal(items, skeleton)
	})

	it('returns the skeleton unchanged when assessed is an empty array (total failure)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]

		const { items } = mergeIntentCheck(skeleton, [])

		assert.equal(items, skeleton)
	})

	it('leaves a skeleton item unchanged when no assessed item shares its id', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } },
			{ id: 'PROJ-2', title: 'Logout', verdicts: { 'AC 1': 'unaddressed' } },
		]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items[0].verdicts['AC 1'], 'addressed')
		assert.equal(items[1].verdicts['AC 1'], 'unaddressed')
	})

	it('keeps skeleton verdicts when the assessed item has no verdicts property', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = /** @type {unknown} */ ([{ id: 'PROJ-1', title: 'Login' }])

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items[0].verdicts['AC 1'], 'unaddressed')
	})

	it('ignores malformed assessed elements (null, non-object, missing id) without throwing', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } },
			{ id: 'PROJ-2', title: 'Logout', verdicts: { 'AC 1': 'unaddressed' } },
		]
		const assessed = /** @type {unknown} */ ([
			null,
			'oops',
			{ title: 'no id' },
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } },
		])

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items[0].verdicts['AC 1'], 'addressed')
		assert.equal(items[1].verdicts['AC 1'], 'unaddressed')
	})

	it('passes note-bearing items through while still merging adjacent normal items', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' }, note: 'Could not fetch' },
			{ id: 'PROJ-2', title: 'Logout', verdicts: { 'AC 1': 'unaddressed' } },
		]
		const assessed = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } },
			{ id: 'PROJ-2', title: 'Logout', verdicts: { 'AC 1': 'addressed' } },
		]

		const { items } = mergeIntentCheck(skeleton, assessed)

		assert.equal(items[0].verdicts['AC 1'], 'unaddressed')
		assert.equal(items[0].note, 'Could not fetch')
		assert.equal(items[1].verdicts['AC 1'], 'addressed')
	})

	it('does not mutate the skeleton or its verdicts, and returns fresh merged items (purity)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const { items } = mergeIntentCheck(skeleton, assessed)

		// merged value reflects the overlay...
		assert.equal(items[0].verdicts['AC 1'], 'addressed')
		// ...but the original skeleton is untouched, and a fresh object was returned.
		assert.equal(skeleton[0].verdicts['AC 1'], 'unaddressed')
		assert.notEqual(items[0], skeleton[0])
		assert.notEqual(items[0].verdicts, skeleton[0].verdicts)
	})
})

describe('mergeIntentCheck diagnostics', () => {
	it('reports applied count and a clean breakdown on the happy path', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed', 'AC 2': 'unaddressed' } }]
		const assessed = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed', 'AC 2': 'partially addressed' } },
		]

		const { diagnostics } = mergeIntentCheck(skeleton, assessed)

		assert.deepEqual(diagnostics, {
			assessedReceived: 1,
			applied: 2,
			droppedElements: 0,
			rejectedVerdicts: 0,
			unmatchedItems: 0,
		})
	})

	it('reports applied: 0 when a non-empty assessed array yields no usable verdicts (total drift)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		// id renamed → no element matches the skeleton; the Notice trigger for the orchestrator.
		const assessed = [{ workItemId: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const { items, diagnostics } = mergeIntentCheck(skeleton, /** @type {unknown} */ (assessed))

		assert.equal(items[0].verdicts['AC 1'], 'unaddressed')
		assert.equal(diagnostics.applied, 0)
		assert.equal(diagnostics.assessedReceived, 1)
		assert.equal(diagnostics.droppedElements, 1) // missing string `id`
	})

	it('counts dropped malformed elements (null, non-object, missing id)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = /** @type {unknown} */ ([
			null,
			'oops',
			{ title: 'no id' },
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } },
		])

		const { diagnostics } = mergeIntentCheck(skeleton, assessed)

		assert.equal(diagnostics.droppedElements, 3)
		assert.equal(diagnostics.applied, 1)
	})

	it('counts rejected verdicts that are present but invalid', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed', 'AC 2': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed', 'AC 2': 'maybe?' } }]

		const { diagnostics } = mergeIntentCheck(skeleton, assessed)

		assert.equal(diagnostics.applied, 1)
		assert.equal(diagnostics.rejectedVerdicts, 1)
	})

	it('does not count an absent (undefined) verdict as rejected', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed', 'AC 2': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const { diagnostics } = mergeIntentCheck(skeleton, assessed)

		assert.equal(diagnostics.applied, 1)
		assert.equal(diagnostics.rejectedVerdicts, 0) // 'AC 2' simply absent, not invalid
	})

	it('counts distinct assessed ids absent from the skeleton as unmatched', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } },
			{ id: 'PROJ-9', title: 'Ghost', verdicts: { 'AC 1': 'addressed' } },
		]

		const { diagnostics } = mergeIntentCheck(skeleton, assessed)

		assert.equal(diagnostics.unmatchedItems, 1)
		assert.equal(diagnostics.applied, 1)
	})

	it('returns all-zero diagnostics on total-failure inputs (null, non-array, empty)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const zero = { assessedReceived: 0, applied: 0, droppedElements: 0, rejectedVerdicts: 0, unmatchedItems: 0 }

		assert.deepEqual(mergeIntentCheck(skeleton, /** @type {unknown} */ (null)).diagnostics, zero)
		assert.deepEqual(mergeIntentCheck(skeleton, /** @type {unknown} */ ({})).diagnostics, zero)
		assert.deepEqual(mergeIntentCheck(skeleton, []).diagnostics, zero)
	})
})
