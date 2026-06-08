// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveAnchor } from '../scripts/lib/inline-anchor-resolver.mjs'

describe('resolveAnchor', () => {
	it('returns footer/no-anchor when anchor is null', () => {
		const r = resolveAnchor(null, '<p>some page content</p>')
		assert.equal(r.type, 'footer')
		assert.equal(/** @type {any} */ (r).reason, 'no-anchor')
	})

	it('returns footer/no-anchor when anchor is empty string', () => {
		const r = resolveAnchor('', '<p>some page content</p>')
		assert.equal(r.type, 'footer')
		assert.equal(/** @type {any} */ (r).reason, 'no-anchor')
	})

	it('returns inline/matchCount=1 for a unique match', () => {
		const r = resolveAnchor('user clicks Submit', '<p>The user clicks Submit button to proceed.</p>')
		assert.equal(r.type, 'inline')
		assert.equal(/** @type {any} */ (r).matchCount, 1)
		assert.equal(/** @type {any} */ (r).textSelection, 'user clicks Submit')
	})

	it('returns the normalized anchor as textSelection (whitespace collapsed)', () => {
		const original = 'User  Clicks Submit'
		const r = resolveAnchor(original, '<p>User  Clicks Submit</p>')
		assert.equal(r.type, 'inline')
		assert.equal(/** @type {any} */ (r).textSelection, 'User Clicks Submit')
	})

	it('returns footer/no-anchor when anchor is whitespace-only', () => {
		const r = resolveAnchor('   ', '<p>some page content</p>')
		assert.equal(r.type, 'footer')
		assert.equal(/** @type {any} */ (r).reason, 'no-anchor')
	})

	it('returns footer/not-found when anchor text is absent from the page', () => {
		const r = resolveAnchor('nonexistent phrase', '<p>totally different content</p>')
		assert.equal(r.type, 'footer')
		assert.equal(/** @type {any} */ (r).reason, 'not-found')
	})

	it('returns footer/ambiguous when anchor appears more than once', () => {
		const html = '<p>The button is red. The button is large.</p>'
		const r = resolveAnchor('button', html)
		assert.equal(r.type, 'footer')
		assert.equal(/** @type {any} */ (r).reason, 'ambiguous')
		assert.equal(/** @type {any} */ (r).ambiguousCount, 2)
	})

	it('matches case-insensitively', () => {
		const r = resolveAnchor('SUBMIT BUTTON', '<p>The submit button is here.</p>')
		assert.equal(r.type, 'inline')
	})

	it('strips HTML before matching', () => {
		const r = resolveAnchor('plain text', '<p><strong>plain</strong> text in the spec</p>')
		assert.equal(r.type, 'inline')
	})

	it('normalizes whitespace before matching', () => {
		const r = resolveAnchor('hello world', '<p>hello   world is here</p>')
		assert.equal(r.type, 'inline')
	})

	it('returns footer/not-found for empty page HTML', () => {
		const r = resolveAnchor('some anchor', '')
		assert.equal(r.type, 'footer')
		assert.equal(/** @type {any} */ (r).reason, 'not-found')
	})

	it('does not throw on special regex characters in the anchor', () => {
		assert.doesNotThrow(() => resolveAnchor('price (USD)', '<p>price (USD) is shown</p>'))
	})

	it('correctly handles anchor with regex-special characters (unique match)', () => {
		const r = resolveAnchor('price (USD)', '<p>The price (USD) is shown in the header.</p>')
		assert.equal(r.type, 'inline')
	})
})
