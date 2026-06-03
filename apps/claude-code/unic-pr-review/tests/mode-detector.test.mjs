// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectMode } from '../scripts/lib/mode-detector.mjs'

describe('detectMode', () => {
	it('returns pre-pr when hasUrl is false', () => {
		assert.equal(detectMode({ hasUrl: false }), 'pre-pr')
	})

	it('returns first-review when URL given and no prior signature', () => {
		assert.equal(detectMode({ hasUrl: true, hasPriorSignature: false }), 'first-review')
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
