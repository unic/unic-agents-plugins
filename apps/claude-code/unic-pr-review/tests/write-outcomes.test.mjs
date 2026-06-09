// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { checkWriteRetry, filterUnposted, recordOutcomes } from '../scripts/lib/write-outcomes.mjs'

const HEAD = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)

function tempDir() {
	return mkdtempSync(join(tmpdir(), 'write-outcomes-'))
}

/** @param {Record<string, unknown>} value */
function writeState(value) {
	const path = join(tempDir(), 'state.json')
	writeFileSync(path, JSON.stringify(value), 'utf8')
	return path
}

describe('checkWriteRetry', () => {
	it('returns {mode:"none"} when state file does not exist', () => {
		const path = join(tempDir(), 'state.json') // never written
		assert.deepEqual(checkWriteRetry(path, HEAD), { mode: 'none' })
	})

	it('returns {mode:"retry", state} when headSha matches current HEAD', () => {
		const path = writeState({ headSha: HEAD, iteration: 1 })
		const result = checkWriteRetry(path, HEAD)
		assert.equal(result.mode, 'retry')
		assert.equal(/** @type {any} */ (result).state.headSha, HEAD)
		assert.equal(/** @type {any} */ (result).state.iteration, 1)
	})

	it('returns {mode:"stale"} when headSha differs from current HEAD', () => {
		const path = writeState({ headSha: OTHER })
		assert.deepEqual(checkWriteRetry(path, HEAD), { mode: 'stale' })
	})

	it('returns {mode:"stale"} when headSha differs — caller should discard state dir', () => {
		// Stale-HEAD discard path: the orchestrator deletes the state dir and runs a normal review.
		const path = writeState({ headSha: OTHER, postedMap: { x: { success: true, threadId: 1 } } })
		assert.deepEqual(checkWriteRetry(path, HEAD), { mode: 'stale' })
	})

	it('returns {mode:"none"} when state file exists but is malformed JSON', () => {
		const path = join(tempDir(), 'state.json')
		writeFileSync(path, '{not json', 'utf8')
		assert.deepEqual(checkWriteRetry(path, HEAD), { mode: 'none' })
	})

	it('returns {mode:"none"} when state file exists but headSha is not a string', () => {
		const path = writeState({ iteration: 2 }) // no headSha
		assert.deepEqual(checkWriteRetry(path, HEAD), { mode: 'none' })
	})

	it('uses injected deps without touching the real filesystem', () => {
		const result = checkWriteRetry('/nowhere/state.json', HEAD, {
			existsSync: () => true,
			readFile: () => JSON.stringify({ headSha: HEAD }),
		})
		assert.equal(result.mode, 'retry')
	})
})

describe('recordOutcomes', () => {
	const inlineResults = [
		{ findingId: 'f1', success: true, threadId: 101, error: null },
		{ findingId: 'f2', success: false, threadId: null, error: 'boom' },
	]

	it('writes postedMap with success/threadId from inlineResults', () => {
		const path = writeState({ headSha: HEAD })
		recordOutcomes(path, inlineResults, { success: false, threadId: null, error: null })
		const state = JSON.parse(readFileSync(path, 'utf8'))
		assert.deepEqual(state.postedMap, {
			f1: { success: true, threadId: 101 },
			f2: { success: false, threadId: null },
		})
	})

	it('sets summaryPosted:true when summaryResult.success is true', () => {
		const path = writeState({ headSha: HEAD })
		recordOutcomes(path, [], { success: true, threadId: 200, error: null })
		assert.equal(JSON.parse(readFileSync(path, 'utf8')).summaryPosted, true)
	})

	it('leaves summaryPosted falsey when summaryResult failed', () => {
		const path = writeState({ headSha: HEAD })
		recordOutcomes(path, [], { success: false, threadId: null, error: 'x' })
		assert.equal(JSON.parse(readFileSync(path, 'utf8')).summaryPosted, false)
	})

	it('preserves summaryPosted:true when already set (does not reset to false)', () => {
		const path = writeState({ headSha: HEAD, summaryPosted: true })
		recordOutcomes(path, [], { success: false, threadId: null, error: 'x' })
		assert.equal(JSON.parse(readFileSync(path, 'utf8')).summaryPosted, true)
	})

	it('merges with existing state fields (headSha, iteration, findings)', () => {
		const path = writeState({ headSha: HEAD, iteration: 3, findings: [{ id: 'f1' }] })
		recordOutcomes(path, inlineResults, null)
		const state = JSON.parse(readFileSync(path, 'utf8'))
		assert.equal(state.headSha, HEAD)
		assert.equal(state.iteration, 3)
		assert.deepEqual(state.findings, [{ id: 'f1' }])
		assert.equal(state.postedMap.f1.success, true)
	})

	it('merges new outcomes into a pre-existing postedMap', () => {
		const path = writeState({ headSha: HEAD, postedMap: { f0: { success: true, threadId: 1 } } })
		recordOutcomes(path, [{ findingId: 'f1', success: true, threadId: 2, error: null }], null)
		const state = JSON.parse(readFileSync(path, 'utf8'))
		assert.equal(state.postedMap.f0.success, true)
		assert.equal(state.postedMap.f1.threadId, 2)
	})

	it('creates state.json when it does not exist (catches parse error)', () => {
		const path = join(tempDir(), 'state.json') // never written
		recordOutcomes(path, inlineResults, { success: true, threadId: 9, error: null })
		const state = JSON.parse(readFileSync(path, 'utf8'))
		assert.equal(state.postedMap.f1.threadId, 101)
		assert.equal(state.summaryPosted, true)
	})

	it('writes atomically via tmp + rename', () => {
		const writes = /** @type {string[]} */ ([])
		const renames = /** @type {[string, string][]} */ ([])
		recordOutcomes(
			'/state/state.json',
			[],
			{ success: true, threadId: 1, error: null },
			{
				readFile: () => JSON.stringify({ headSha: HEAD }),
				writeFile: (p) => writes.push(p),
				renameSync: (from, to) => renames.push([from, to]),
			}
		)
		assert.deepEqual(writes, ['/state/state.json.tmp'])
		assert.deepEqual(renames, [['/state/state.json.tmp', '/state/state.json']])
	})
})

describe('filterUnposted', () => {
	const findings = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }]

	it('returns all Findings when postedMap is empty (first-attempt no-op)', () => {
		assert.deepEqual(filterUnposted(findings, {}), findings)
	})

	it('returns all Findings when postedMap is undefined', () => {
		assert.deepEqual(filterUnposted(findings, undefined), findings)
	})

	it('filters out Findings with postedMap[id].success === true (retry reduces set)', () => {
		const postedMap = { f1: { success: true, threadId: 1 }, f2: { success: true, threadId: 2 } }
		assert.deepEqual(filterUnposted(findings, postedMap), [{ id: 'f3' }])
	})

	it('keeps Findings where postedMap[id].success === false (failed → retry)', () => {
		const postedMap = { f1: { success: false, threadId: null } }
		assert.deepEqual(filterUnposted(findings, postedMap), findings)
	})

	it('keeps Findings with no entry in postedMap (missing entry → un-posted)', () => {
		const postedMap = { f1: { success: true, threadId: 1 } }
		assert.deepEqual(filterUnposted(findings, postedMap), [{ id: 'f2' }, { id: 'f3' }])
	})
})
