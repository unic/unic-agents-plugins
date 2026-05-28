// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSignature, renderFooter, SIGNATURE_PREFIX } from '../scripts/lib/signature.mjs'

describe('renderFooter', () => {
	it('produces the exact wording for iteration 1', () => {
		assert.equal(renderFooter(1), '🤖 Reviewed by Claude Code — Iteration 1\n\n')
	})

	it('produces the correct iteration number for iteration 5', () => {
		assert.equal(renderFooter(5), '🤖 Reviewed by Claude Code — Iteration 5\n\n')
	})

	it('ends with two newlines', () => {
		assert.ok(renderFooter(1).endsWith('\n\n'))
	})

	it('contains the iteration number at the expected position', () => {
		const footer = renderFooter(42)
		assert.ok(footer.startsWith(SIGNATURE_PREFIX))
		assert.ok(footer.includes('42'))
	})

	it('round-trip: rendered output starts with SIGNATURE_PREFIX', () => {
		const footer = renderFooter(1)
		assert.ok(footer.startsWith(SIGNATURE_PREFIX), `Expected "${footer}" to start with "${SIGNATURE_PREFIX}"`)
	})
})

describe('parseSignature', () => {
	it('returns null for any input (stub)', () => {
		assert.equal(parseSignature('🤖 Reviewed by Claude Code — Iteration 1'), null)
	})

	it('returns null for empty string (stub)', () => {
		assert.equal(parseSignature(''), null)
	})

	it('returns null for a string that does not contain the signature (stub)', () => {
		assert.equal(parseSignature('Some random comment'), null)
	})
})
