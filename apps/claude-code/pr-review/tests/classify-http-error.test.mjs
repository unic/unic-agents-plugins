// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyHttpError } from '../scripts/ado/classify-http-error.mjs'

describe('classifyHttpError — OK tier', () => {
	it('HTTP 200 → ok', () => {
		const r = classifyHttpError({ status: 200, body: '{"id":1}', exitCode: 0 })
		assert.equal(r.tier, 'ok')
	})

	it('HTTP 201 → ok', () => {
		const r = classifyHttpError({ status: 201, body: '{"id":2}', exitCode: 0 })
		assert.equal(r.tier, 'ok')
	})

	it('HTTP 404 → ok (domain: thing already gone)', () => {
		const r = classifyHttpError({ status: 404, body: '', exitCode: 0 })
		assert.equal(r.tier, 'ok')
	})

	it('HTTP 409 → ok (domain: state already changed)', () => {
		const r = classifyHttpError({ status: 409, body: '', exitCode: 0 })
		assert.equal(r.tier, 'ok')
	})
})

describe('classifyHttpError — ABORTED tier', () => {
	it('HTTP 401 → aborted with kind=auth', () => {
		const r = classifyHttpError({ status: 401, body: 'Unauthorized', exitCode: 1 })
		assert.equal(r.tier, 'aborted')
		assert.equal(r.kind, 'auth')
		assert.ok(r.message.length > 0)
	})

	it('HTTP 403 → aborted with kind=auth', () => {
		const r = classifyHttpError({ status: 403, body: 'Forbidden', exitCode: 1 })
		assert.equal(r.tier, 'aborted')
		assert.equal(r.kind, 'auth')
	})
})

describe('classifyHttpError — DEGRADED tier', () => {
	it('HTTP 500 → degraded with kind=transient', () => {
		const r = classifyHttpError({ status: 500, body: 'Internal Server Error', exitCode: 1 })
		assert.equal(r.tier, 'degraded')
		assert.equal(r.kind, 'transient')
	})

	it('HTTP 503 → degraded with kind=transient', () => {
		const r = classifyHttpError({ status: 503, body: 'Service Unavailable', exitCode: 1 })
		assert.equal(r.tier, 'degraded')
		assert.equal(r.kind, 'transient')
	})

	it('HTTP 400 → degraded with kind=malformed-request', () => {
		const r = classifyHttpError({ status: 400, body: 'Bad Request', exitCode: 1 })
		assert.equal(r.tier, 'degraded')
		assert.equal(r.kind, 'malformed-request')
	})

	it('HTTP 422 → degraded with kind=malformed-request', () => {
		const r = classifyHttpError({ status: 422, body: 'Unprocessable Entity', exitCode: 1 })
		assert.equal(r.tier, 'degraded')
		assert.equal(r.kind, 'malformed-request')
	})

	it('network error (exitCode=1, no status) → degraded with kind=network', () => {
		const r = classifyHttpError({ status: 0, body: '', exitCode: 1 })
		assert.equal(r.tier, 'degraded')
		assert.equal(r.kind, 'network')
	})

	it('network error (exitCode=2, no status) → degraded with kind=network', () => {
		const r = classifyHttpError({ status: 0, body: 'connection refused', exitCode: 2 })
		assert.equal(r.tier, 'degraded')
		assert.equal(r.kind, 'network')
		assert.ok(r.message.includes('connection refused') || r.message.includes('2'))
	})
})

describe('classifyHttpError — message content', () => {
	it('includes the HTTP status in the message for 5xx errors', () => {
		const r = classifyHttpError({ status: 503, body: 'Service Unavailable', exitCode: 1 })
		assert.ok(r.message.includes('503'), `expected message to contain "503", got: ${r.message}`)
	})

	it('includes body excerpt in message for 4xx errors', () => {
		const body = 'Invalid parameter: filePath must start with /'
		const r = classifyHttpError({ status: 400, body, exitCode: 1 })
		assert.ok(r.message.includes('400'), `expected message to contain "400", got: ${r.message}`)
	})

	it('malformed JSON body does not crash — uses status to determine tier', () => {
		const r = classifyHttpError({ status: 401, body: '<<<not json>>>', exitCode: 1 })
		assert.equal(r.tier, 'aborted')
		assert.equal(r.kind, 'auth')
	})

	it('ok tier returns empty message', () => {
		const r = classifyHttpError({ status: 200, body: '{"id":1}', exitCode: 0 })
		assert.equal(r.message, '')
	})
})
