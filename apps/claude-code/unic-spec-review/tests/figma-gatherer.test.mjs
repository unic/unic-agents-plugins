// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildFigmaContext, extractAnnotations, formatFigmaNodeSummary } from '../scripts/lib/figma-gatherer.mjs'

describe('extractAnnotations', () => {
	it('returns empty array for null input', () => {
		assert.deepEqual(extractAnnotations(null), [])
	})

	it('returns empty array for undefined input', () => {
		assert.deepEqual(extractAnnotations(undefined), [])
	})

	it('returns empty array for non-object input', () => {
		assert.deepEqual(extractAnnotations(42), [])
	})

	it('extracts annotations from data.annotations[].message', () => {
		assert.deepEqual(extractAnnotations({ annotations: [{ message: 'Click target' }] }), ['Click target'])
	})

	it('extracts annotations from data.node.annotations', () => {
		assert.deepEqual(extractAnnotations({ node: { annotations: [{ message: 'Nested note' }] } }), ['Nested note'])
	})

	it('extracts annotations from data.document.annotations', () => {
		assert.deepEqual(extractAnnotations({ document: { annotations: [{ message: 'Doc note' }] } }), ['Doc note'])
	})

	it('extracts annotations recursively from children', () => {
		const data = { children: [{ children: [{ annotations: [{ message: 'Deep note' }] }] }] }
		assert.deepEqual(extractAnnotations(data), ['Deep note'])
	})

	it('deduplicates annotation texts', () => {
		const data = { annotations: [{ message: 'Same' }, { message: 'Same' }] }
		assert.deepEqual(extractAnnotations(data), ['Same'])
	})

	it('drops empty annotation messages', () => {
		const data = { annotations: [{ message: '' }, { message: 'Kept' }] }
		assert.deepEqual(extractAnnotations(data), ['Kept'])
	})
})

describe('formatFigmaNodeSummary', () => {
	it('includes the URL in the output', () => {
		const out = formatFigmaNodeSummary('https://figma.com/design/abc', {})
		assert.ok(out.includes('Figma source: https://figma.com/design/abc'))
	})

	it('shows the frame name when present', () => {
		const out = formatFigmaNodeSummary('url', { name: 'Checkout Flow' })
		assert.ok(out.includes('Frame/Page: Checkout Flow'))
	})

	it('shows the name from a nested node wrapper', () => {
		const out = formatFigmaNodeSummary('url', { node: { name: 'Nested Frame' } })
		assert.ok(out.includes('Frame/Page: Nested Frame'))
	})

	it('shows (unnamed) when name is absent', () => {
		const out = formatFigmaNodeSummary('url', {})
		assert.ok(out.includes('Frame/Page: (unnamed)'))
	})

	it('shows the description when present', () => {
		const out = formatFigmaNodeSummary('url', { description: 'A checkout' })
		assert.ok(out.includes('Description: A checkout'))
	})

	it('shows (none) for description when absent', () => {
		const out = formatFigmaNodeSummary('url', {})
		assert.ok(out.includes('Description: (none)'))
	})

	it('shows annotations in a list when present', () => {
		const out = formatFigmaNodeSummary('url', { annotations: [{ message: 'Primary CTA' }] })
		assert.ok(out.includes('Annotations:'))
		assert.ok(out.includes('  - Primary CTA'))
	})

	it('shows (none) for annotations when none found', () => {
		const out = formatFigmaNodeSummary('url', { name: 'Frame' })
		assert.ok(out.includes('Annotations: (none)'))
	})

	it('handles null data gracefully', () => {
		assert.doesNotThrow(() => formatFigmaNodeSummary('url', null))
		const out = formatFigmaNodeSummary('url', null)
		assert.ok(out.includes('Frame/Page: (unnamed)'))
	})

	it('handles undefined data gracefully', () => {
		assert.doesNotThrow(() => formatFigmaNodeSummary('url', undefined))
	})
})

describe('buildFigmaContext', () => {
	it('returns fallback string for empty array', () => {
		assert.equal(buildFigmaContext([]), '(no Figma data gathered)')
	})

	it('returns fallback string for non-array input', () => {
		assert.equal(buildFigmaContext(/** @type {any} */ (null)), '(no Figma data gathered)')
	})

	it('formats a single result', () => {
		const out = buildFigmaContext([{ url: 'https://figma.com/x', data: { name: 'Frame A' } }])
		assert.ok(out.includes('Figma source: https://figma.com/x'))
		assert.ok(out.includes('Frame/Page: Frame A'))
	})

	it('joins multiple results with the separator', () => {
		const out = buildFigmaContext([
			{ url: 'https://figma.com/a', data: { name: 'A' } },
			{ url: 'https://figma.com/b', data: { name: 'B' } },
		])
		assert.ok(out.includes('\n\n---\n\n'))
		assert.ok(out.includes('Frame/Page: A'))
		assert.ok(out.includes('Frame/Page: B'))
	})
})
