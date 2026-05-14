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

	it('null elements in value array are skipped silently', () => {
		const r = fetchWorkItems({
			responseText: JSON.stringify({ value: [null, { id: 5 }, null, { id: 9 }] }),
			exitCode: 0,
		})
		assert.ok(r.ok)
		if (r.ok) assert.deepEqual(r.ids, [5, 9])
	})

	it('non-object elements in value array are skipped', () => {
		const r = fetchWorkItems({
			responseText: JSON.stringify({ value: [{ id: 1 }, 'stray-string', { id: 2 }] }),
			exitCode: 0,
		})
		assert.ok(r.ok)
		if (r.ok) assert.deepEqual(r.ids, [1, 2])
	})
})

describe('fetchWorkItems — failure results', () => {
	it('non-zero exit code (auth body) → { ok: false, reason: "auth" }', () => {
		const r = fetchWorkItems({
			responseText: JSON.stringify({ statusCode: 401, message: 'TF400813: unauthorized' }),
			exitCode: 1,
		})
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.reason, 'auth')
			assert.ok(typeof r.message === 'string')
		}
	})

	it('non-zero exit code (5xx body) → { ok: false, reason: "transient" }', () => {
		const r = fetchWorkItems({
			responseText: JSON.stringify({ statusCode: 503, message: 'Service unavailable' }),
			exitCode: 1,
		})
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.reason, 'transient')
	})

	it('non-zero exit code (4xx non-auth body) → { ok: false, reason: "malformed" }', () => {
		const r = fetchWorkItems({
			responseText: JSON.stringify({ statusCode: 400, message: 'Bad request' }),
			exitCode: 1,
		})
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.reason, 'malformed')
	})

	it('non-zero exit with no parseable body → { ok: false, reason: "transient" }', () => {
		const r = fetchWorkItems({ responseText: '', exitCode: 1 })
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.reason, 'transient')
			assert.ok(typeof r.message === 'string')
		}
	})

	it('non-zero exit with auth body excerpt → message includes auth-related text', () => {
		const r = fetchWorkItems({ responseText: 'TF401349: OAuth token is not valid', exitCode: 1 })
		assert.equal(r.ok, false)
		if (!r.ok) assert.ok(r.message.includes('TF401349'))
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

	it('ADO error response body (non-zero exit, 401 status) → { ok: false, reason: "auth" }', () => {
		const errorBody = JSON.stringify({
			statusCode: 401,
			message: 'VS403487: The client is unauthorized.',
			errorCode: 0,
		})
		const r = fetchWorkItems({ responseText: errorBody, exitCode: 1 })
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.reason, 'auth')
	})
})
