// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { basename, join } from 'node:path'
import { describe, it } from 'node:test'
import { renderReport } from '../scripts/lib/report-renderer.mjs'

/**
 * Build a renderer-deps stub that records the mkdir/write calls.
 * @returns {{ deps: import('../scripts/lib/report-renderer.mjs').RendererDeps, calls: { mkdirDir: string, path: string, data: string } }}
 */
function stubDeps() {
	const calls = { mkdirDir: '', path: '', data: '' }
	const deps = {
		mkdirSync: (/** @type {string} */ dir) => {
			calls.mkdirDir = dir
		},
		writeFileSync: (/** @type {string} */ p, /** @type {string} */ d) => {
			calls.path = p
			calls.data = d
		},
	}
	return { deps, calls }
}

const BASE_INPUT = {
	pageTitle: 'My Spec',
	pageUrl: 'https://x.atlassian.net/wiki/spaces/X/pages/1/My-Spec',
	timestamp: '2026-06-05T13:45:09.123Z',
	findings: [],
}

describe('renderReport', () => {
	it('creates the output directory and writes to outputDir/spec-review-<slug>.md', () => {
		const { deps, calls } = stubDeps()
		const result = renderReport(BASE_INPUT, '/tmp/out', deps)
		assert.equal(calls.mkdirDir, '/tmp/out')
		assert.equal(result.path, join('/tmp/out', 'spec-review-2026-06-05-13-45-09.md'))
		assert.equal(calls.path, result.path)
	})

	it('derives a filename slug with no colon or T character', () => {
		const { deps, calls } = stubDeps()
		renderReport(BASE_INPUT, '/tmp/out', deps)
		const filename = basename(calls.path)
		assert.ok(!filename.includes(':'))
		assert.ok(!filename.includes('T'))
		assert.match(filename, /^spec-review-2026-06-05-13-45-09\.md$/)
	})

	it('includes the page title, url, and timestamp in the markdown', () => {
		const { deps, calls } = stubDeps()
		const result = renderReport(BASE_INPUT, '/tmp/out', deps)
		assert.ok(calls.data.includes('My Spec'))
		assert.ok(calls.data.includes(BASE_INPUT.pageUrl))
		assert.ok(calls.data.includes(BASE_INPUT.timestamp))
		assert.equal(result.markdown, calls.data)
	})

	it('renders each finding with title, severity badge, and confidence', () => {
		const { deps, calls } = stubDeps()
		renderReport(
			{
				...BASE_INPUT,
				findings: [
					{ title: 'Missing logout flow', description: 'No end state defined.', severity: 'critical', confidence: 92 },
				],
			},
			'/tmp/out',
			deps
		)
		assert.ok(calls.data.includes('Missing logout flow'))
		assert.ok(calls.data.includes('`critical`'))
		assert.ok(calls.data.includes('(92%)'))
		assert.ok(calls.data.includes('No end state defined.'))
	})

	it('renders the no-findings message for an empty findings list', () => {
		const { deps, calls } = stubDeps()
		renderReport(BASE_INPUT, '/tmp/out', deps)
		assert.ok(calls.data.includes('_No gaps or completeness findings._'))
	})

	it('returns { path, markdown } matching the written content', () => {
		const { deps, calls } = stubDeps()
		const result = renderReport(BASE_INPUT, '/tmp/out', deps)
		assert.equal(result.path, calls.path)
		assert.equal(result.markdown, calls.data)
	})

	it('renders the anchor quote block when anchor is present', () => {
		const { deps, calls } = stubDeps()
		renderReport(
			{
				...BASE_INPUT,
				findings: [
					{
						title: 'Missing error state',
						description: 'No failure outcome defined.',
						severity: 'important',
						confidence: 80,
						anchor: 'The user clicks Submit',
					},
				],
			},
			'/tmp/out',
			deps
		)
		assert.ok(calls.data.includes('> Anchor: `The user clicks Submit`'))
	})
})
