// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseWriteResponse } from '../scripts/ado/parse-write-response.mjs'

describe('parseWriteResponse — OK tier', () => {
	it('HTTP 200 with numeric id → { ok: true, id: N }', () => {
		const r = parseWriteResponse({ httpExit: 0, responseText: '{"id":123,"url":"https://dev.azure.com/..."}' })
		assert.deepEqual(r, { ok: true, id: 123 })
	})

	it('HTTP 201 with numeric id → { ok: true, id: N }', () => {
		const r = parseWriteResponse({ httpExit: 0, responseText: '{"id":42}' })
		assert.deepEqual(r, { ok: true, id: 42 })
	})

	it('HTTP 404 (domain ok — thread deleted) → { ok: true, id: null }', () => {
		const r = parseWriteResponse({
			httpExit: 1,
			responseText: '{"statusCode":404,"message":"Thread not found"}',
		})
		assert.deepEqual(r, { ok: true, id: null })
	})

	it('HTTP 409 (domain ok — state already changed) → { ok: true, id: null }', () => {
		const r = parseWriteResponse({
			httpExit: 1,
			responseText: '{"statusCode":409,"message":"Status already fixed"}',
		})
		assert.deepEqual(r, { ok: true, id: null })
	})
})

describe('parseWriteResponse — ABORTED tier', () => {
	it('HTTP 401 → { ok: false, tier: aborted, kind: auth }', () => {
		const r = parseWriteResponse({
			httpExit: 1,
			responseText: '{"statusCode":401,"message":"Unauthorized"}',
		})
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'aborted')
			assert.equal(r.kind, 'auth')
			assert.ok(r.message.length > 0)
		}
	})

	it('HTTP 403 → { ok: false, tier: aborted, kind: auth }', () => {
		const r = parseWriteResponse({
			httpExit: 1,
			responseText: '{"statusCode":403,"message":"Forbidden"}',
		})
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'aborted')
			assert.equal(r.kind, 'auth')
		}
	})
})

describe('parseWriteResponse — DEGRADED tier', () => {
	it('HTTP 500 → { ok: false, tier: degraded, kind: transient }', () => {
		const r = parseWriteResponse({
			httpExit: 1,
			responseText: '{"statusCode":500,"message":"Internal Server Error"}',
		})
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'degraded')
			assert.equal(r.kind, 'transient')
		}
	})

	it('HTTP 503 → { ok: false, tier: degraded, kind: transient }', () => {
		const r = parseWriteResponse({
			httpExit: 1,
			responseText: '{"statusCode":503,"message":"Service Unavailable"}',
		})
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'degraded')
			assert.equal(r.kind, 'transient')
		}
	})

	it('network error (exitCode=1, no body) → { ok: false, tier: degraded, kind: network }', () => {
		const r = parseWriteResponse({ httpExit: 1, responseText: '' })
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'degraded')
			assert.equal(r.kind, 'network')
		}
	})

	it('network error (exitCode=2, plain text body) → { ok: false, tier: degraded, kind: network }', () => {
		const r = parseWriteResponse({ httpExit: 2, responseText: 'connection refused' })
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'degraded')
			assert.equal(r.kind, 'network')
		}
	})

	it('malformed JSON body with non-zero exit → { ok: false, tier: degraded }', () => {
		const r = parseWriteResponse({ httpExit: 1, responseText: '<<<not json>>>' })
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.tier, 'degraded')
	})

	it('malformed JSON body with zero exit → { ok: false, tier: degraded, kind: malformed-response }', () => {
		const r = parseWriteResponse({ httpExit: 0, responseText: '<<<not json>>>' })
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'degraded')
			assert.equal(r.kind, 'malformed-response')
		}
	})

	it('missing id field on 200 response → { ok: false, tier: degraded, kind: malformed-response }', () => {
		const r = parseWriteResponse({
			httpExit: 0,
			responseText: '{"result":"ok","type":"comment"}',
		})
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.tier, 'degraded')
			assert.equal(r.kind, 'malformed-response')
		}
	})

	it('errStream content appears in malformed-response message', () => {
		const r = parseWriteResponse({
			httpExit: 0,
			responseText: '{"result":"ok"}',
			errStream: 'az: error: something went wrong',
		})
		assert.equal(r.ok, false)
		if (!r.ok) {
			assert.equal(r.kind, 'malformed-response')
			assert.ok(r.message.includes('az: error: something went wrong'))
		}
	})
})
