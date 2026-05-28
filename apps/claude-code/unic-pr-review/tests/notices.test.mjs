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

	it('renders both notices when both flags are set', () => {
		const out = renderNotices({
			fallbackToFirstReview: true,
			persistentUnaddressed: ['Rename variable'],
		})
		assert.ok(out.includes('> **Notice:**'))
		assert.ok(out.includes('> **Persistent unaddressed findings:**'))
	})
})
