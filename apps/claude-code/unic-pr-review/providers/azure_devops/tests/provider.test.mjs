// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { discoverWorkItems, parsePrUrl, prUrlPattern } from '../provider.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
/** @param {string} name */
const fixture = (name) => JSON.parse(readFileSync(resolve(__dirname, '../fixtures', name), 'utf8'))

describe('prUrlPattern', () => {
	it('matches dev.azure.com PR URL', () => {
		assert.ok(prUrlPattern.test('https://dev.azure.com/myorg/myproj/_git/myrepo/pullrequest/42'))
	})
	it('matches visualstudio.com PR URL', () => {
		assert.ok(prUrlPattern.test('https://myorg.visualstudio.com/myproj/_git/myrepo/pullrequest/7'))
	})
	it('does not match a GitHub PR URL', () => {
		assert.ok(!prUrlPattern.test('https://github.com/unic/repo/pull/1'))
	})
	it('does not match an ADO non-PR URL', () => {
		assert.ok(!prUrlPattern.test('https://dev.azure.com/myorg/myproj/_git/myrepo'))
	})
})

describe('parsePrUrl', () => {
	it('parses dev.azure.com URL correctly', () => {
		const result = parsePrUrl('https://dev.azure.com/myorg/myproj/_git/myrepo/pullrequest/42')
		assert.deepEqual(result, { orgUrl: 'https://dev.azure.com/myorg', project: 'myproj', repo: 'myrepo', prId: 42 })
	})
	it('parses visualstudio.com URL correctly', () => {
		const result = parsePrUrl('https://myorg.visualstudio.com/myproj/_git/myrepo/pullrequest/7')
		assert.deepEqual(result, { orgUrl: 'https://myorg.visualstudio.com', project: 'myproj', repo: 'myrepo', prId: 7 })
	})
	it('throws on non-ADO URL', () => {
		assert.throws(() => parsePrUrl('https://github.com/foo/bar/pull/1'), /Not an ADO PR URL/)
	})
})

describe('discoverWorkItems', () => {
	it('returns normalised list from fixture with one WI', () => {
		const meta = fixture('pr-with-work-items.json')
		const items = discoverWorkItems(meta)
		assert.equal(items.length, 1)
		assert.equal(items[0].id, '101')
		assert.equal(items[0].type, 'ado-work-item')
		assert.equal(items[0].url, 'https://dev.azure.com/myorg/myproject/_apis/wit/workitems/101')
	})
	it('returns empty array from fixture without WIs', () => {
		const meta = fixture('pr-without-work-items.json')
		assert.deepEqual(discoverWorkItems(meta), [])
	})
	it('returns all WIs from fixture with multiple WIs', () => {
		const meta = fixture('pr-with-multiple-work-items.json')
		const items = discoverWorkItems(meta)
		assert.equal(items.length, 2)
		assert.deepEqual(
			items.map((i) => i.id),
			['101', '102']
		)
	})
	it('returns empty array when workItemRefs absent', () => {
		assert.deepEqual(discoverWorkItems({}), [])
	})
	it('throws on non-object input instead of silently returning empty', () => {
		// @ts-expect-error — deliberately passing the wrong shape to assert the guard fires
		assert.throws(() => discoverWorkItems(null), /Expected PR metadata object/)
		// @ts-expect-error — deliberately passing the wrong shape to assert the guard fires
		assert.throws(() => discoverWorkItems('not-json'), /got string/)
		// @ts-expect-error — deliberately passing the wrong shape to assert the guard fires
		assert.throws(() => discoverWorkItems([]), /got array/)
	})
	it('emits string ids and ado-work-item type for every entry', () => {
		const items = discoverWorkItems(fixture('pr-with-multiple-work-items.json'))
		for (const item of items) {
			assert.equal(typeof item.id, 'string')
			assert.equal(item.type, 'ado-work-item')
		}
	})
})
