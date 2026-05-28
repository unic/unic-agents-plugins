// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bucketBySeverity } from '../scripts/lib/severity-bucketer.mjs'

describe('bucketBySeverity', () => {
	it('100 → critical', () => {
		assert.equal(bucketBySeverity(100), 'critical')
	})

	it('90 → critical (inclusive lower bound)', () => {
		assert.equal(bucketBySeverity(90), 'critical')
	})

	it('89 → important (boundary flip from critical)', () => {
		assert.equal(bucketBySeverity(89), 'important')
	})

	it('85 → important (mid-range)', () => {
		assert.equal(bucketBySeverity(85), 'important')
	})

	it('80 → important (inclusive lower bound)', () => {
		assert.equal(bucketBySeverity(80), 'important')
	})

	it('79 → minor (boundary flip from important)', () => {
		assert.equal(bucketBySeverity(79), 'minor')
	})

	it('70 → minor (mid-range)', () => {
		assert.equal(bucketBySeverity(70), 'minor')
	})

	it('60 → minor (inclusive lower bound)', () => {
		assert.equal(bucketBySeverity(60), 'minor')
	})

	it('59 → null (dropped, below floor)', () => {
		assert.equal(bucketBySeverity(59), null)
	})

	it('55 → null (dropped)', () => {
		assert.equal(bucketBySeverity(55), null)
	})

	it('0 → null (dropped)', () => {
		assert.equal(bucketBySeverity(0), null)
	})
})
