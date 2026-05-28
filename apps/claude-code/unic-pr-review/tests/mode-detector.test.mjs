// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectMode } from '../scripts/lib/mode-detector.mjs'

describe('detectMode', () => {
	it('returns pre-pr when hasUrl is false (all other flags false)', () => {
		assert.equal(detectMode({ hasUrl: false, hasPriorSignature: false, revisionsAvailable: false }), 'pre-pr')
	})

	it('returns pre-pr when hasUrl is false even when other flags are true', () => {
		assert.equal(detectMode({ hasUrl: false, hasPriorSignature: true, revisionsAvailable: true }), 'pre-pr')
	})

	it('returns first-review when hasUrl is true and no prior signature', () => {
		assert.equal(detectMode({ hasUrl: true, hasPriorSignature: false, revisionsAvailable: false }), 'first-review')
	})

	it('returns first-review when hasUrl is true, no prior signature, revisionsAvailable true', () => {
		assert.equal(detectMode({ hasUrl: true, hasPriorSignature: false, revisionsAvailable: true }), 'first-review')
	})

	it('returns re-review when URL given, prior signature found, revision still available', () => {
		assert.equal(detectMode({ hasUrl: true, hasPriorSignature: true, revisionsAvailable: true }), 're-review')
	})

	it('returns first-review-fallback when URL given, prior signature found, revision gone (force-push)', () => {
		assert.equal(
			detectMode({ hasUrl: true, hasPriorSignature: true, revisionsAvailable: false }),
			'first-review-fallback'
		)
	})
})
