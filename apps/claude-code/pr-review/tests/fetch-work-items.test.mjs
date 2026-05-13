// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchWorkItems } from '../scripts/ado/fetch-work-items.mjs'

describe('fetchWorkItems — OK results', () => {
	it('empty value array → { ok: true, ids: [] } (EMPTY-BY-DESIGN)', () => {
		const r = fetchWorkItems({ responseText: JSON.stringify({ value: [] }), exitCode: 0 })
		assert.deepEqual(r, { ok: true, ids: [] })
	})

	it('populated work items → { ok: true, ids: [...] }', () => {
		const r = fetchWorkItems({ responseText: JSON.stringify({ value: [{ id: 42 }, { id: 7 }] }), exitCode: 0 })
		assert.deepEqual(r, { ok: true, ids: [42, 7] })
	})

	it('preserves order of IDs', () => {
		const r = fetchWorkItems({
			responseText: JSON.stringify({ value: [{ id: 3 }, { id: 1 }, { id: 2 }] }),
			exitCode: 0,
		})
		assert.ok(r.ok)
		if (r.ok) assert.deepEqual(r.ids, [3, 1, 2])
	})
})

describe('fetchWorkItems — failure results', () => {
	it('non-zero exit code → { ok: false }', () => {
		const r = fetchWorkItems({ responseText: '', exitCode: 1 })
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.ok(typeof r.reason === 'string')
			assert.ok(typeof r.message === 'string')
		}
	})

	it('non-zero exit with body excerpt → message includes body excerpt', () => {
		const r = fetchWorkItems({ responseText: 'TF401349: OAuth token is not valid', exitCode: 1 })
		assert.equal(r.ok, false)
		if (!r.ok) assert.ok(r.message.includes('TF401349') || r.message.length > 0)
	})

	it('exitCode=0 but empty responseText → { ok: false }', () => {
		const r = fetchWorkItems({ responseText: '', exitCode: 0 })
		assert.equal(r.ok, false)
	})

	it('exitCode=0 but malformed JSON → { ok: false, reason: malformed }', () => {
		const r = fetchWorkItems({ responseText: '<<<not json>>>', exitCode: 0 })
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.reason, 'malformed')
	})

	it('exitCode=0 but response has no value key → { ok: false, reason: malformed }', () => {
		const r = fetchWorkItems({ responseText: JSON.stringify({ count: 0 }), exitCode: 0 })
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.reason, 'malformed')
	})

	it('ADO error response body (non-zero exit) → { ok: false }', () => {
		const errorBody = JSON.stringify({ $id: '1', message: 'VS403487: The client is unauthorized.', errorCode: 0 })
		const r = fetchWorkItems({ responseText: errorBody, exitCode: 1 })
		assert.equal(r.ok, false)
	})
})
