// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderNotices } from '../scripts/lib/notices.mjs'

describe('renderNotices', () => {
	it('returns empty string when no notices apply', () => {
		assert.equal(renderNotices({}), '')
	})

	it('returns empty string when persistentUnaddressed is an empty array', () => {
		assert.equal(renderNotices({ persistentUnaddressed: [] }), '')
	})

	it('renders the force-push fallback notice when fallbackToFirstReview is true', () => {
		const out = renderNotices({ fallbackToFirstReview: true })
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('force-push detected'))
		assert.ok(out.includes('Falling back to First-review mode'))
	})

	it('renders persistent-unaddressed block with one entry per title', () => {
		const out = renderNotices({ persistentUnaddressed: ['Null check missing', 'Magic number'] })
		assert.ok(out.includes('> **Persistent unaddressed findings:**'))
		assert.ok(out.includes('> - Null check missing'))
		assert.ok(out.includes('> - Magic number'))
	})

	it('renders both notices when both flags are set, with fallback first', () => {
		const out = renderNotices({
			fallbackToFirstReview: true,
			persistentUnaddressed: ['Rename variable'],
		})
		const fallbackIdx = out.indexOf('> **Notice:**')
		const persistentIdx = out.indexOf('> **Persistent unaddressed findings:**')
		assert.ok(fallbackIdx >= 0, 'Missing fallback notice')
		assert.ok(persistentIdx >= 0, 'Missing persistent-unaddressed block')
		assert.ok(fallbackIdx < persistentIdx, 'Fallback notice must precede persistent-unaddressed block')
	})

	it('renders the unassessed-intent-check notice when unassessedIntentCheck is true', () => {
		const out = renderNotices({ unassessedIntentCheck: true })
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('Intent Check block'))
		assert.ok(out.includes('unaddressed'))
	})

	it('returns empty string when unassessedIntentCheck is false', () => {
		assert.equal(renderNotices({ unassessedIntentCheck: false }), '')
	})

	it('renders unassessed-intent-check notice after fallbackToFirstReview when both are set', () => {
		const out = renderNotices({ fallbackToFirstReview: true, unassessedIntentCheck: true })
		const fallbackIdx = out.indexOf('force-push detected')
		const unassessedIdx = out.indexOf('Intent Check block')
		assert.ok(fallbackIdx >= 0, 'Missing fallback notice')
		assert.ok(unassessedIdx >= 0, 'Missing unassessed notice')
		assert.ok(fallbackIdx < unassessedIdx, 'fallback notice must precede unassessed notice')
	})

	it('returns empty string when diffUnavailable is false', () => {
		assert.equal(renderNotices({ diffUnavailable: false }), '')
	})

	it('renders the diff-unavailable notice when diffUnavailable is true', () => {
		const out = renderNotices({ diffUnavailable: true })
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('Line-level diff was unavailable'))
		assert.ok(out.includes('does **not** mean the PR is clean'))
	})

	it('renders diff-unavailable notice after unassessedIntentCheck when both are set', () => {
		const out = renderNotices({ unassessedIntentCheck: true, diffUnavailable: true })
		const unassessedIdx = out.indexOf('Intent Check block')
		const diffIdx = out.indexOf('Line-level diff was unavailable')
		assert.ok(unassessedIdx >= 0, 'Missing unassessed notice')
		assert.ok(diffIdx >= 0, 'Missing diff-unavailable notice')
		assert.ok(unassessedIdx < diffIdx, 'unassessed notice must precede diff-unavailable notice')
	})

	it('renders diff-unavailable notice after fallbackToFirstReview when both are set', () => {
		const out = renderNotices({ fallbackToFirstReview: true, diffUnavailable: true })
		const fallbackIdx = out.indexOf('force-push detected')
		const diffIdx = out.indexOf('Line-level diff was unavailable')
		assert.ok(fallbackIdx >= 0, 'Missing fallback notice')
		assert.ok(diffIdx >= 0, 'Missing diff-unavailable notice')
		assert.ok(fallbackIdx < diffIdx, 'fallback notice must precede diff-unavailable notice')
	})
})
