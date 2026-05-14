// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchIterations } from '../scripts/ado/fetch-iterations.mjs'

const iter = (id, commitId) => ({
	id,
	sourceRefCommit: commitId != null ? { commitId } : null,
})

const okResponse = (iterations) => JSON.stringify({ value: iterations })

describe('fetchIterations', () => {
	it('single iteration → ok with its id and commit SHA', () => {
		const result = fetchIterations({ responseText: okResponse([iter(1, 'abc123')]), exitCode: 0 })
		assert.deepEqual(result, { ok: true, latestIterationId: 1, latestCommitSha: 'abc123' })
	})

	it('multiple iterations → ok with the max id and its commit SHA', () => {
		const result = fetchIterations({
			responseText: okResponse([iter(1, 'aaa'), iter(3, 'ccc'), iter(2, 'bbb')]),
			exitCode: 0,
		})
		assert.deepEqual(result, { ok: true, latestIterationId: 3, latestCommitSha: 'ccc' })
	})

	it('iteration with null sourceRefCommit → ok with empty commitSha', () => {
		const result = fetchIterations({ responseText: okResponse([iter(2, null)]), exitCode: 0 })
		assert.deepEqual(result, { ok: true, latestIterationId: 2, latestCommitSha: '' })
	})

	it('empty value array → empty-iterations failure', () => {
		const result = fetchIterations({ responseText: okResponse([]), exitCode: 0 })
		assert.equal(result.ok, false)
		assert.equal(result.reason, 'empty-iterations')
		assert.ok(result.message.length > 0)
	})

	it('non-zero exit with no body → transient failure (network)', () => {
		const result = fetchIterations({ responseText: '', exitCode: 1 })
		assert.equal(result.ok, false)
		assert.equal(result.reason, 'transient')
		assert.match(result.message, /exit 1/)
	})

	it('401 status in response body → auth failure', () => {
		const body = JSON.stringify({ statusCode: 401, message: 'Unauthorized' })
		const result = fetchIterations({ responseText: body, exitCode: 1 })
		assert.equal(result.ok, false)
		assert.equal(result.reason, 'auth')
		assert.match(result.message, /401/)
	})

	it('5xx status in response body → transient failure', () => {
		const body = JSON.stringify({ statusCode: 503, message: 'Service Unavailable' })
		const result = fetchIterations({ responseText: body, exitCode: 1 })
		assert.equal(result.ok, false)
		assert.equal(result.reason, 'transient')
		assert.match(result.message, /503/)
	})

	it('malformed JSON response with zero exit → malformed failure', () => {
		const result = fetchIterations({ responseText: 'not-valid-json', exitCode: 0 })
		assert.equal(result.ok, false)
		assert.equal(result.reason, 'malformed')
	})

	it('exitCode=0 but value key absent → { ok: false, reason: malformed }', () => {
		const r = fetchIterations({ responseText: JSON.stringify({ count: 0 }), exitCode: 0 })
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.reason, 'malformed')
	})

	it('HTTP 400 response → { ok: false, reason: malformed }', () => {
		const r = fetchIterations({
			responseText: JSON.stringify({ statusCode: 400, message: 'Bad Request' }),
			exitCode: 0,
		})
		assert.equal(r.ok, false)
		if (!r.ok) assert.equal(r.reason, 'malformed')
	})
})
