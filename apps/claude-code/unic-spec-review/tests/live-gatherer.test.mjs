// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildLiveContext, CONTENT_LIMIT, formatLivePageSummary } from '../scripts/lib/live-gatherer.mjs'

describe('formatLivePageSummary', () => {
	it('includes the URL', () => {
		const out = formatLivePageSummary('https://prod.example.com', { title: 'Home', content: 'Hi' })
		assert.ok(out.includes('Live page: https://prod.example.com'))
	})

	it('shows the title when present', () => {
		const out = formatLivePageSummary('url', { title: 'Checkout', content: 'x' })
		assert.ok(out.includes('Title: Checkout'))
	})

	it('shows (untitled) when title is null', () => {
		const out = formatLivePageSummary('url', { title: null, content: 'x' })
		assert.ok(out.includes('Title: (untitled)'))
	})

	it('shows (untitled) when title is missing from obs', () => {
		const out = formatLivePageSummary('url', { content: 'x' })
		assert.ok(out.includes('Title: (untitled)'))
	})

	it('shows (untitled) when title is an empty string', () => {
		const out = formatLivePageSummary('url', { title: '', content: 'x' })
		assert.ok(out.includes('Title: (untitled)'))
	})

	it('shows (no content captured) when content is an empty string', () => {
		const out = formatLivePageSummary('url', { title: 'T', content: '' })
		assert.ok(out.includes('(no content captured)'))
	})

	it('shows content when present', () => {
		const out = formatLivePageSummary('url', { title: 'T', content: 'Visible body text' })
		assert.ok(out.includes('Visible body text'))
	})

	it('shows (no content captured) when content is null', () => {
		const out = formatLivePageSummary('url', { title: 'T', content: null })
		assert.ok(out.includes('(no content captured)'))
	})

	it('shows (no content captured) when content is missing', () => {
		const out = formatLivePageSummary('url', { title: 'T' })
		assert.ok(out.includes('(no content captured)'))
	})

	it('truncates content beyond the limit and appends [truncated]', () => {
		const content = 'x'.repeat(CONTENT_LIMIT + 500)
		const out = formatLivePageSummary('url', { content })
		assert.ok(out.includes('[truncated]'))
		assert.ok(out.includes('x'.repeat(CONTENT_LIMIT)))
		assert.ok(!out.includes('x'.repeat(CONTENT_LIMIT + 1)))
	})

	it('does not truncate content at exactly the limit', () => {
		const content = 'x'.repeat(CONTENT_LIMIT)
		const out = formatLivePageSummary('url', { content })
		assert.ok(!out.includes('[truncated]'))
	})

	it('handles null/missing obs fields without throwing', () => {
		assert.doesNotThrow(() => formatLivePageSummary('url', { title: null, content: null }))
	})
})

describe('buildLiveContext', () => {
	it('returns fallback string for empty array', () => {
		assert.equal(buildLiveContext([]), '(no live observations gathered)')
	})

	it('returns fallback string for non-array input', () => {
		assert.equal(buildLiveContext(/** @type {any} */ (null)), '(no live observations gathered)')
	})

	it('formats a single observation', () => {
		const out = buildLiveContext([{ url: 'https://prod.example.com', title: 'Home', content: 'Body' }])
		assert.ok(out.includes('Live page: https://prod.example.com'))
		assert.ok(out.includes('Title: Home'))
	})

	it('joins multiple observations with the separator', () => {
		const out = buildLiveContext([
			{ url: 'https://a.com', title: 'A', content: 'a' },
			{ url: 'https://b.com', title: 'B', content: 'b' },
		])
		assert.ok(out.includes('\n\n---\n\n'))
		assert.ok(out.includes('Live page: https://a.com'))
		assert.ok(out.includes('Live page: https://b.com'))
	})
})
