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
		const items = discoverWorkItems(fixture('pr-with-work-items.json').workItemRefs)
		assert.equal(items.length, 1)
		assert.equal(items[0].id, '101')
		assert.equal(items[0].type, 'ado-work-item')
		assert.equal(items[0].url, 'https://dev.azure.com/myorg/myproject/_apis/wit/workitems/101')
	})
	it('returns empty array from explicit empty refs (legitimate no-WI case)', () => {
		assert.deepEqual(discoverWorkItems([]), [])
	})
	it('returns all WIs from fixture with multiple WIs', () => {
		const items = discoverWorkItems(fixture('pr-with-multiple-work-items.json').workItemRefs)
		assert.equal(items.length, 2)
		assert.deepEqual(
			items.map((i) => i.id),
			['101', '102']
		)
	})
	it('throws on undefined — data-loss path must not silently return empty', () => {
		// absent key on FETCHER_OUTPUT collapses to undefined; this must throw so the
		// orchestrator's absent-key loud-Notice path (review-pr.md Step 1.5, ADR-0004)
		// is the only way to reach WORK_ITEMS=[] when data is missing
		// @ts-expect-error — deliberately passing undefined to assert the guard fires
		assert.throws(() => discoverWorkItems(undefined), /Expected workItemRefs array/)
	})
	it('throws on non-array inputs instead of silently returning empty', () => {
		// @ts-expect-error — deliberately passing the wrong shape to assert the guard fires
		assert.throws(() => discoverWorkItems(null), /Expected workItemRefs array/)
		// @ts-expect-error — deliberately passing the wrong shape to assert the guard fires
		assert.throws(() => discoverWorkItems({}), /got object/)
		// @ts-expect-error — deliberately passing the wrong shape to assert the guard fires
		assert.throws(() => discoverWorkItems('not-json'), /got string/)
	})
	it('emits string ids and ado-work-item type for every entry', () => {
		const items = discoverWorkItems(fixture('pr-with-multiple-work-items.json').workItemRefs)
		for (const item of items) {
			assert.equal(typeof item.id, 'string')
			assert.equal(item.type, 'ado-work-item')
		}
	})
	it('normalises integer wire-format ids to strings', () => {
		// The live pullrequestworkitems endpoint returns integer ids; fixtures use strings.
		// discoverWorkItems must coerce via String(ref.id) so downstream id handling is stable
		// regardless of wire shape — this exercises the integer branch the JSDoc `id: string | number`
		// widening opened, which the fixture-shape tests below cannot reach.
		const items = discoverWorkItems([{ id: 42622, url: 'https://dev.azure.com/FZAG/_apis/wit/workitems/42622' }])
		assert.equal(items.length, 1)
		assert.equal(items[0].id, '42622')
		assert.equal(typeof items[0].id, 'string')
	})
})

// Fetcher contract: the ADO Fetcher (Step 1.5) fetches workItemRefs from pullrequestworkitems
// and emits them as a top-level field on FETCHER_OUTPUT (not nested inside prMetadata).
// The orchestrator (review-pr.md Step 1.5) reads FETCHER_OUTPUT.workItemRefs directly and
// passes the array to discoverWorkItems — never the raw prMetadata blob.
// These tests assert that the fixtures reflect the expected ADO wire shape so the
// normalisation tests above remain grounded in real data.
describe('fetcher contract — fixture workItemRefs shapes match ADO wire format', () => {
	it('pr-with-work-items fixture has workItemRefs with at least one entry', () => {
		const meta = fixture('pr-with-work-items.json')
		assert.ok(Array.isArray(meta.workItemRefs), 'workItemRefs must be an array')
		assert.ok(meta.workItemRefs.length > 0, 'fixture must have at least one work item ref')
	})
	it('pr-with-multiple-work-items fixture has workItemRefs with multiple entries', () => {
		const meta = fixture('pr-with-multiple-work-items.json')
		assert.ok(Array.isArray(meta.workItemRefs), 'workItemRefs must be an array')
		assert.ok(meta.workItemRefs.length > 1, 'fixture must have more than one work item ref')
	})
	it('pr-without-work-items fixture has workItemRefs as empty array (not absent)', () => {
		const meta = fixture('pr-without-work-items.json')
		assert.ok(Array.isArray(meta.workItemRefs), 'workItemRefs must be present even when empty')
		assert.equal(meta.workItemRefs.length, 0)
	})
	it('each workItemRef has string id and url', () => {
		// Note: fixtures use synthetic string ids ("101") for simplicity.
		// The real ADO pullrequestworkitems endpoint returns integer ids (101).
		// discoverWorkItems normalises both via String(ref.id), so runtime is safe;
		// this assertion matches the fixture shape, not the wire format.
		const meta = fixture('pr-with-work-items.json')
		for (const ref of meta.workItemRefs) {
			assert.equal(typeof ref.id, 'string', 'workItemRef.id must be a string')
			assert.equal(typeof ref.url, 'string', 'workItemRef.url must be a string')
		}
	})
})
