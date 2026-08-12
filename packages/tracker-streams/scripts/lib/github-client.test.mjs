#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { listBlockersFor, listMembersByStream } from './github-client.mjs'

process.env.GITHUB_TOKEN = 'x'

afterEach(() => mock.restoreAll())

/** @param {number} status @param {Record<string, string>} [responseHeaders] */
const stubFetch = (status, responseHeaders = {}) =>
	mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify([]), { status, headers: responseHeaders }))

/** @param {Promise<unknown>} promise @returns {Promise<Error>} */
const rejection = async (promise) => {
	const err = await promise.catch((caught) => caught)
	assert.ok(err instanceof Error, `expected a rejection, got ${err}`)
	return err
}

describe('listMembersByStream — fail-loud on a relation read the token cannot make', () => {
	it('reports the relation, the status, and the "do not substitute a credential" instruction', async () => {
		stubFetch(403)
		const err = await rejection(listMembersByStream('unic', 'unic-agents-plugins', [313]))
		assert.match(err.message, /cannot read sub_issues/)
		assert.match(err.message, /Do not substitute a personal access token/)
	})

	it('falls back to a generic message for a non-relation failure', async () => {
		stubFetch(500)
		const err = await rejection(listMembersByStream('unic', 'unic-agents-plugins', [313]))
		assert.doesNotMatch(err.message, /Do not substitute/)
	})

	it('reports a rate-limit hit, not a permission failure, when retry-after is set', async () => {
		stubFetch(403, { 'retry-after': '30' })
		const err = await rejection(listMembersByStream('unic', 'unic-agents-plugins', [313]))
		assert.match(err.message, /rate limit/)
		assert.match(err.message, /retry after 30s/)
		assert.doesNotMatch(err.message, /Do not substitute/)
	})

	it('reports a rate-limit hit when the quota header reads zero remaining', async () => {
		stubFetch(403, { 'x-ratelimit-remaining': '0' })
		const err = await rejection(listMembersByStream('unic', 'unic-agents-plugins', [313]))
		assert.match(err.message, /rate limit/)
	})

	it('never runs more than 8 requests at once', async () => {
		let inFlight = 0
		let maxInFlight = 0
		mock.method(globalThis, 'fetch', async () => {
			inFlight += 1
			maxInFlight = Math.max(maxInFlight, inFlight)
			await new Promise((resolve) => setTimeout(resolve, 5))
			inFlight -= 1
			return new Response(JSON.stringify([]), { status: 200 })
		})

		await listMembersByStream(
			'unic',
			'unic-agents-plugins',
			Array.from({ length: 20 }, (_, i) => i)
		)
		assert.ok(maxInFlight <= 8, `saw ${maxInFlight} concurrent requests`)
	})
})

describe('listBlockersFor', () => {
	it('drops pull requests from the blocker list, like every sibling relation reader', async () => {
		mock.method(
			globalThis,
			'fetch',
			async () =>
				new Response(
					JSON.stringify([
						{ number: 1, title: 'an issue', state: 'open', labels: [] },
						{ number: 2, title: 'a pull request', state: 'open', labels: [], pull_request: {} },
					]),
					{ status: 200 }
				)
		)

		const blockers = await listBlockersFor('unic', 'unic-agents-plugins', [313])
		assert.deepEqual(
			blockers.get(313)?.map((blocker) => blocker.number),
			[1]
		)
	})
})
