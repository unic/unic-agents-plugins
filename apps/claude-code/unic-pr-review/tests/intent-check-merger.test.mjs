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

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.deepEqual(merged[0].verdicts, { 'AC 1': 'addressed', 'AC 2': 'partially addressed' })
	})

	it('ignores assessed items whose id is not in the skeleton', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } },
			{ id: 'PROJ-9', title: 'Ghost', verdicts: { 'AC 1': 'addressed' } },
		]

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.equal(merged.length, 1)
		assert.equal(merged[0].id, 'PROJ-1')
	})

	it('ignores assessed AC keys not present in the skeleton item', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed', 'AC 99': 'addressed' } }]

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.deepEqual(Object.keys(merged[0].verdicts), ['AC 1'])
		assert.deepEqual(merged[0].verdicts, { 'AC 1': 'addressed' })
	})

	it('keeps unaddressed when a skeleton AC is absent from the assessed output', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed', 'AC 2': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.equal(merged[0].verdicts['AC 1'], 'addressed')
		assert.equal(merged[0].verdicts['AC 2'], 'unaddressed')
	})

	it('keeps unaddressed when the assessed verdict value is invalid', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'maybe?' } }]

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.equal(merged[0].verdicts['AC 1'], 'unaddressed')
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

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.equal(merged[0].verdicts['AC 1'], 'unaddressed')
		assert.equal(merged[0].note, 'Could not fetch')
	})

	it('returns the skeleton unchanged when assessed is null (total failure)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]

		const merged = mergeIntentCheck(skeleton, /** @type {unknown} */ (null))

		assert.equal(merged, skeleton)
	})

	it('returns the skeleton unchanged when assessed is not an array (total failure)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]

		const merged = mergeIntentCheck(skeleton, /** @type {unknown} */ ({}))

		assert.equal(merged, skeleton)
	})

	it('returns the skeleton unchanged when assessed is an empty array (total failure)', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]

		const merged = mergeIntentCheck(skeleton, [])

		assert.equal(merged, skeleton)
	})

	it('leaves a skeleton item unchanged when no assessed item shares its id', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [
			{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } },
			{ id: 'PROJ-2', title: 'Logout', verdicts: { 'AC 1': 'unaddressed' } },
		]
		const assessed = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'addressed' } }]

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.equal(merged[0].verdicts['AC 1'], 'addressed')
		assert.equal(merged[1].verdicts['AC 1'], 'unaddressed')
	})

	it('keeps skeleton verdicts when the assessed item has no verdicts property', () => {
		/** @type {IntentCheckItem[]} */
		const skeleton = [{ id: 'PROJ-1', title: 'Login', verdicts: { 'AC 1': 'unaddressed' } }]
		const assessed = /** @type {unknown} */ ([{ id: 'PROJ-1', title: 'Login' }])

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.equal(merged[0].verdicts['AC 1'], 'unaddressed')
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

		const merged = mergeIntentCheck(skeleton, assessed)

		assert.equal(merged[0].verdicts['AC 1'], 'unaddressed')
		assert.equal(merged[0].note, 'Could not fetch')
		assert.equal(merged[1].verdicts['AC 1'], 'addressed')
	})
})
