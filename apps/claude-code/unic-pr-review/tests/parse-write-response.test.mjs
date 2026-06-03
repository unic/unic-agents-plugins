// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseWriteResponse } from '../scripts/lib/parse-write-response.mjs'

describe('parseWriteResponse', () => {
	it('returns failure when cmdOk is false', () => {
		const r = parseWriteResponse('', 'not authorised', false)
		assert.equal(r.success, false)
		assert.equal(r.threadId, null)
		assert.ok(r.error)
	})

	it('includes stderr in the error when cmdOk is false', () => {
		const r = parseWriteResponse('', 'TF401019: access denied', false)
		assert.equal(r.success, false)
		assert.match(r.error ?? '', /TF401019: access denied/)
	})

	it('falls back to stdout for the error when stderr is empty and cmdOk is false', () => {
		const r = parseWriteResponse('boom on stdout', '', false)
		assert.equal(r.success, false)
		assert.match(r.error ?? '', /boom on stdout/)
	})

	it('returns success with the numeric threadId for a valid response', () => {
		const r = parseWriteResponse(JSON.stringify({ id: 12345, status: 'active' }), '', true)
		assert.equal(r.success, true)
		assert.equal(r.threadId, 12345)
		assert.equal(r.error, null)
	})

	it('returns failure when stdout is not valid JSON', () => {
		const r = parseWriteResponse('not json at all', '', true)
		assert.equal(r.success, false)
		assert.equal(r.threadId, null)
		assert.match(r.error ?? '', /not valid JSON/)
		assert.match(r.error ?? '', /not json at all/)
	})

	it('returns failure when the JSON response has no id field', () => {
		const r = parseWriteResponse(JSON.stringify({ status: 'active' }), '', true)
		assert.equal(r.success, false)
		assert.equal(r.threadId, null)
		assert.match(r.error ?? '', /missing numeric id/)
	})

	it('returns failure when id is present but not a number', () => {
		const r = parseWriteResponse(JSON.stringify({ id: 'abc' }), '', true)
		assert.equal(r.success, false)
		assert.match(r.error ?? '', /missing numeric id/)
	})

	it('returns failure when cmdOk is true but stdout is empty (non-JSON)', () => {
		const r = parseWriteResponse('', '', true)
		assert.equal(r.success, false)
		assert.equal(r.threadId, null)
		assert.ok(r.error)
	})

	it('returns failure when the response parses to null', () => {
		const r = parseWriteResponse('null', '', true)
		assert.equal(r.success, false)
		assert.match(r.error ?? '', /Unexpected response type: null/)
	})
})
