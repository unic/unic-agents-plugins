// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyUrl } from '../scripts/lib/link-classifier.mjs'

describe('classifyUrl', () => {
	it('routes a modern Confluence page URL to confluence and extracts the page id', () => {
		const url = 'https://x.atlassian.net/wiki/spaces/X/pages/123456/Title'
		assert.deepEqual(classifyUrl(url), { kind: 'confluence', pageId: '123456', url })
	})

	it('routes a legacy Confluence URL (?pageId=) to confluence', () => {
		const url = 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=789'
		assert.deepEqual(classifyUrl(url), { kind: 'confluence', pageId: '789', url })
	})

	it('returns unknown for a /wiki/ URL with no extractable page id', () => {
		const url = 'https://x.atlassian.net/wiki/spaces/X/overview'
		assert.deepEqual(classifyUrl(url), { kind: 'unknown', url })
	})

	it('routes a Figma URL with a node-id param to figma-frame', () => {
		const url = 'https://www.figma.com/design/abc/My-File?node-id=1-2'
		assert.deepEqual(classifyUrl(url), { kind: 'figma-frame', url })
	})

	it('routes a Figma URL without a node-id param to figma-page', () => {
		const url = 'https://www.figma.com/design/abc/My-File'
		assert.deepEqual(classifyUrl(url), { kind: 'figma-page', url })
	})

	it('routes a bare figma.com URL (no www) to figma-page', () => {
		const url = 'https://figma.com/design/abc/My-File'
		assert.deepEqual(classifyUrl(url), { kind: 'figma-page', url })
	})

	it('routes a generic HTTPS URL to live', () => {
		const url = 'https://example.com/products/checkout'
		assert.deepEqual(classifyUrl(url), { kind: 'live', url })
	})

	it('returns unknown for a malformed URL string', () => {
		const url = 'not a url at all'
		assert.deepEqual(classifyUrl(url), { kind: 'unknown', url })
	})

	it('returns unknown for a non-HTTP protocol', () => {
		const url = 'ftp://files.example.com/spec.txt'
		assert.deepEqual(classifyUrl(url), { kind: 'unknown', url })
	})
})
