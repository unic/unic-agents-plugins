// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	checkConfluence,
	mapPingError,
	PING_TIMEOUT_MS,
	realPing,
	runSpecDoctorCredentials,
} from '../scripts/spec-doctor.mjs'

/** @import { Ping } from '../scripts/spec-doctor.mjs' */

/** @param {number} status @returns {Ping} */
const pingHttp = (status) => async () => ({ kind: 'http', status })

/** @param {string} error @returns {Ping} */
const pingError = (error) => async () => ({ kind: 'transport-error', error })

describe('checkConfluence', () => {
	it('returns ok:true on 200', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(200))
		assert.equal(r.ok, true)
		assert.match(r.detail, /example\.atlassian\.net/)
	})

	it('returns ok:false on 401', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 'bad', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(401))
		assert.equal(r.ok, false)
		assert.match(r.detail, /401/)
	})

	it('returns ok:true on 299 (inclusive upper bound of 2xx)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(299))
		assert.equal(r.ok, true)
	})

	it('returns ok:false on 199 (just below 2xx)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(199))
		assert.equal(r.ok, false)
		assert.match(r.detail, /199/)
	})

	it('returns ok:false on 300 (just above 2xx)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(300))
		assert.equal(r.ok, false)
		assert.match(r.detail, /300/)
	})

	it('returns ok:false when Confluence is unreachable (transport-error)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingError('ECONNREFUSED'))
		assert.equal(r.ok, false)
		assert.match(r.detail, /ECONNREFUSED/)
	})

	it('strips a trailing slash and pings the Confluence space endpoint with Basic auth', async () => {
		const creds = { url: 'https://example.atlassian.net/', username: 'u', token: 't', jiraUrl: undefined }
		/** @type {{ url?: string, headers?: Record<string, string> }} */
		const captured = {}
		/** @type {Ping} */
		const ping = async (url, headers) => {
			captured.url = url
			captured.headers = headers
			return { kind: 'http', status: 200 }
		}
		await checkConfluence(creds, ping)
		assert.equal(captured.url, 'https://example.atlassian.net/wiki/rest/api/space?limit=1')
		assert.match(captured.headers?.Authorization ?? '', /^Basic /)
		assert.equal(captured.headers?.Accept, 'application/json')
	})
})

describe('mapPingError', () => {
	it('maps AbortSignal TimeoutError to a friendly fixed message', () => {
		const err = new Error('aborted')
		err.name = 'TimeoutError'
		assert.equal(mapPingError(err), `Request timed out after ${PING_TIMEOUT_MS / 1000}s`)
	})

	it('uses the error message for non-timeout Errors', () => {
		assert.equal(mapPingError(new Error('ECONNREFUSED')), 'ECONNREFUSED')
	})

	it('stringifies non-Error rejections', () => {
		assert.equal(mapPingError('boom'), 'boom')
	})
})

describe('realPing', () => {
	it('resolves to a transport-error when given a malformed URL', async () => {
		const r = await realPing('not-a-valid-url', {})
		assert.equal(r.kind, 'transport-error')
		if (r.kind === 'transport-error') assert.ok(r.error.length > 0)
	})
})

describe('runSpecDoctorCredentials', () => {
	it('returns ok:true when credentials are present and Confluence is reachable (200)', async () => {
		const { ok, output } = await runSpecDoctorCredentials({
			ping: pingHttp(200),
			loadCreds: () => ({ url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }),
		})
		assert.equal(ok, true)
		assert.match(output, /Confluence reachable/)
	})

	it('returns ok:false with a missing-credentials message when loadCreds returns null', async () => {
		const { ok, output } = await runSpecDoctorCredentials({
			ping: pingHttp(200),
			loadCreds: () => null,
		})
		assert.equal(ok, false)
		assert.match(output, /Atlassian credentials/)
		assert.doesNotMatch(output, /Confluence/)
	})

	it('returns ok:false with an unreadable message when loadCreds throws', async () => {
		const { ok, output } = await runSpecDoctorCredentials({
			ping: pingHttp(200),
			loadCreds: () => {
				throw new Error('~/.unic-confluence.json contains invalid JSON: Unexpected token')
			},
		})
		assert.equal(ok, false)
		assert.match(output, /credential file unreadable/)
		assert.match(output, /invalid JSON/)
		assert.doesNotMatch(output, /Confluence/)
	})

	it('returns ok:false when Confluence is unreachable (transport-error)', async () => {
		const { ok, output } = await runSpecDoctorCredentials({
			ping: pingError('ECONNREFUSED'),
			loadCreds: () => ({ url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }),
		})
		assert.equal(ok, false)
		assert.match(output, /ECONNREFUSED/)
	})
})
