// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
	buildBasicAuth,
	collectIntent,
	extractConfluenceLinks,
	extractConfluencePageId,
	FETCH_TIMEOUT_MS,
	fetchConfluenceComments,
	fetchConfluencePage,
	mapFetchError,
	routeUrl,
} from '../scripts/atlassian-fetch.mjs'

/** @import { FetchLike } from '../scripts/atlassian-fetch.mjs' */
/** @import { AtlassianCreds } from '../scripts/lib/credentials.mjs' */

/** @type {AtlassianCreds} */
const CREDS = {
	url: 'https://unic.atlassian.net',
	username: 'u@unic.com',
	token: 'tok',
	jiraUrl: 'https://unic.atlassian.net',
}

/**
 * Build a stub fetch that resolves to a 2xx JSON response.
 * @param {any} json
 * @returns {FetchLike}
 */
const fetchJson = (json) => async () => ({ ok: true, status: 200, json: async () => json })

/**
 * Build a stub fetch that resolves to a non-2xx response.
 * @param {number} status
 * @returns {FetchLike}
 */
const fetchStatus = (status) => async () => ({
	ok: false,
	status,
	json: async () => ({}),
})

/**
 * Build a stub fetch that rejects (network failure).
 * @param {Error} err
 * @returns {FetchLike}
 */
const fetchThrows = (err) => async () => {
	throw err
}

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `atlassian-fetch-test-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

describe('routeUrl', () => {
	it('returns confluence for a /wiki/ path', () => {
		assert.equal(routeUrl('https://unic.atlassian.net/wiki/spaces/X/pages/123'), 'confluence')
	})

	it('returns null for an unknown path', () => {
		assert.equal(routeUrl('https://example.com/something'), null)
	})

	it('returns null for an invalid URL', () => {
		assert.equal(routeUrl('not-a-url'), null)
	})
})

describe('extractConfluencePageId', () => {
	it('extracts a numeric id from a modern /pages/123456/ URL', () => {
		assert.equal(extractConfluencePageId('https://x.atlassian.net/wiki/spaces/X/pages/123456/Title'), '123456')
	})

	it('extracts pageId from a legacy viewpage.action query string', () => {
		assert.equal(extractConfluencePageId('https://x.atlassian.net/wiki/pages/viewpage.action?pageId=789'), '789')
	})

	it('returns null when no id is found', () => {
		assert.equal(extractConfluencePageId('https://example.com/wiki/something'), null)
	})
})

describe('buildBasicAuth', () => {
	it('returns base64 of user:token', () => {
		assert.equal(buildBasicAuth('u@unic.com', 'tok'), Buffer.from('u@unic.com:tok').toString('base64'))
	})
})

describe('extractConfluenceLinks', () => {
	it('extracts a wiki href from an HTML body', () => {
		assert.deepEqual(extractConfluenceLinks('<a href="/wiki/spaces/X/pages/123">link</a>'), [
			'/wiki/spaces/X/pages/123',
		])
	})

	it('deduplicates repeated links', () => {
		const html = '<a href="/wiki/p/1">a</a><a href="/wiki/p/1">b</a>'
		assert.deepEqual(extractConfluenceLinks(html), ['/wiki/p/1'])
	})

	it('ignores non-wiki hrefs', () => {
		assert.deepEqual(extractConfluenceLinks('<a href="/other/page">link</a>'), [])
	})

	it('returns an empty array for a non-string body', () => {
		assert.deepEqual(extractConfluenceLinks(null), [])
	})
})

describe('fetchConfluencePage', () => {
	it('returns title, excerpt, and linkedUrls', async () => {
		const page = {
			id: '123456',
			title: 'Design Doc',
			body: { storage: { value: '<p>Hello world</p><a href="/wiki/spaces/Y/pages/9">y</a>' } },
		}
		const item = await fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/123456/Title', CREDS, {
			fetch: fetchJson(page),
		})
		assert.equal(item.title, 'Design Doc')
		assert.equal(item.id, '123456')
		assert.match(item.excerpt, /Hello world/)
		assert.deepEqual(item.linkedUrls, ['https://unic.atlassian.net/wiki/spaces/Y/pages/9'])
	})

	it('strips HTML tags from the excerpt', async () => {
		const page = { id: '1', title: 'T', body: { storage: { value: '<p>Hello <strong>world</strong></p>' } } }
		const item = await fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/1', CREDS, {
			fetch: fetchJson(page),
		})
		assert.equal(item.excerpt, 'Hello world')
	})

	it('caps the excerpt at 800 characters', async () => {
		const longBody = 'word '.repeat(400)
		const page = { id: '2', title: 'Long', body: { storage: { value: longBody } } }
		const item = await fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/2', CREDS, {
			fetch: fetchJson(page),
		})
		assert.equal(item.excerpt.length, 800)
	})

	it('throws FetchError with kind unreachable on network error', async () => {
		await assert.rejects(
			() =>
				fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/1', CREDS, {
					fetch: fetchThrows(new TypeError('boom')),
				}),
			(err) => /** @type {any} */ (err).kind === 'unreachable'
		)
	})

	it('throws FetchError with kind auth-error on 401', async () => {
		await assert.rejects(
			() =>
				fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/1', CREDS, {
					fetch: fetchStatus(401),
				}),
			(err) => /** @type {any} */ (err).kind === 'auth-error'
		)
	})

	it('throws FetchError with kind auth-error on 403', async () => {
		await assert.rejects(
			() =>
				fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/1', CREDS, {
					fetch: fetchStatus(403),
				}),
			(err) => /** @type {any} */ (err).kind === 'auth-error'
		)
	})

	it('throws FetchError with kind not-found on 404', async () => {
		await assert.rejects(
			() =>
				fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/1', CREDS, {
					fetch: fetchStatus(404),
				}),
			(err) => /** @type {any} */ (err).kind === 'not-found'
		)
	})

	it('resolves relative wiki hrefs to absolute URLs using the credentials base', async () => {
		const page = {
			id: '999',
			title: 'With Relative Link',
			body: { storage: { value: '<a href="/wiki/spaces/Y/pages/9">link</a>' } },
		}
		const item = await fetchConfluencePage('https://unic.atlassian.net/wiki/spaces/X/pages/999', CREDS, {
			fetch: fetchJson(page),
		})
		assert.deepEqual(item.linkedUrls, ['https://unic.atlassian.net/wiki/spaces/Y/pages/9'])
	})
})

describe('collectIntent - credential resolution', () => {
	it('reports a credential error when neither env vars nor file are present', async () => {
		const result = await collectIntent(['https://x.atlassian.net/wiki/spaces/X/pages/1'], {
			homedir: tempDir(),
			env: {},
		})
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'auth-error')
		assert.equal(result.errors[0].url, '')
	})

	it('reads creds from ~/.unic-confluence.json and routes a Confluence URL', async () => {
		const home = tempDir()
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({ url: 'https://x.atlassian.net', username: 'u', token: 't' })
		)
		const page = { id: '5', title: 'P', body: { storage: { value: '<p>body</p>' } } }
		const result = await collectIntent(['https://x.atlassian.net/wiki/spaces/X/pages/5'], {
			homedir: home,
			env: {},
			fetch: fetchJson(page),
		})
		assert.equal(result.items.length, 1)
		assert.equal(result.items[0].id, '5')
		assert.deepEqual(result.errors, [])
	})

	it('resolves creds from env vars and routes a Confluence URL', async () => {
		const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }
		const page = { id: '7', title: 'P', body: { storage: { value: '<p>body</p>' } } }
		const result = await collectIntent(['https://x.atlassian.net/wiki/spaces/X/pages/7'], {
			env,
			fetch: fetchJson(page),
		})
		assert.equal(result.items.length, 1)
		assert.equal(result.items[0].id, '7')
		assert.deepEqual(result.errors, [])
	})

	it('collects a 404 FetchError into the errors array without throwing', async () => {
		const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }
		const result = await collectIntent(['https://x.atlassian.net/wiki/spaces/X/pages/1'], {
			env,
			fetch: fetchStatus(404),
		})
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'not-found')
		assert.equal(result.errors[0].url, 'https://x.atlassian.net/wiki/spaces/X/pages/1')
	})

	it('maps a 5xx response to a hard-stop `unreachable` error', async () => {
		const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }
		const result = await collectIntent(['https://x.atlassian.net/wiki/spaces/X/pages/1'], {
			env,
			fetch: fetchStatus(500),
		})
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'unreachable')
	})

	it('records an unsupported error for an unrecognised URL without throwing', async () => {
		const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }
		const result = await collectIntent(['https://dev.azure.com/org/proj/_workitems/edit/123'], { env })
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'unsupported')
		assert.equal(result.errors[0].url, 'https://dev.azure.com/org/proj/_workitems/edit/123')
	})

	it('converts a credential load exception into a global auth-error', async () => {
		const result = await collectIntent(['https://x.atlassian.net/wiki/spaces/X/pages/1'], {
			loadCreds: () => {
				throw new Error('invalid JSON')
			},
		})
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'auth-error')
		assert.equal(result.errors[0].url, '')
		assert.match(result.errors[0].message, /could not be read/)
	})
})

describe('mapFetchError', () => {
	it('returns a human-readable message for TimeoutError', () => {
		const err = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' })
		assert.match(mapFetchError(err), /timed out/)
	})

	it('includes the configured timeout seconds in the message', () => {
		const err = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' })
		assert.match(mapFetchError(err), new RegExp(`${FETCH_TIMEOUT_MS / 1000}s`))
	})

	it('returns err.message for a generic Error', () => {
		assert.equal(mapFetchError(new Error('network failure')), 'network failure')
	})

	it('stringifies a non-Error value', () => {
		assert.equal(mapFetchError('oops'), 'oops')
	})
})

describe('fetchConfluenceComments', () => {
	const PAGE_URL = 'https://unic.atlassian.net/wiki/spaces/X/pages/123'

	it('returns a footer comment with body, author, and created', async () => {
		const json = {
			results: [
				{
					id: 'comment-1',
					body: { storage: { value: '<p>This is a comment</p>' } },
					extensions: { location: 'footer', inlineProperties: null },
					history: { createdBy: { displayName: 'Jane Doe' }, createdDate: '2026-01-15T10:00:00.000Z' },
				},
			],
			_links: {},
		}
		const result = await fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments.length, 1)
		const c = result.comments[0]
		assert.equal(c.id, 'comment-1')
		assert.equal(c.type, 'footer')
		assert.equal(c.body, 'This is a comment')
		assert.equal(c.author, 'Jane Doe')
		assert.equal(c.created, '2026-01-15T10:00:00.000Z')
		assert.equal(c.anchor, undefined)
	})

	it('returns an inline comment with type=inline and anchor text', async () => {
		const json = {
			results: [
				{
					id: 'comment-2',
					body: { storage: { value: '<p>Inline note</p>' } },
					extensions: {
						location: 'inline',
						inlineProperties: { selection: { originalSelection: 'The user clicks Submit' } },
					},
					history: { createdBy: { displayName: 'John Doe' }, createdDate: '2026-01-16T14:00:00.000Z' },
				},
			],
			_links: {},
		}
		const result = await fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments.length, 1)
		const c = result.comments[0]
		assert.equal(c.type, 'inline')
		assert.equal(c.anchor, 'The user clicks Submit')
	})

	it('returns empty comments array when the page has no comments', async () => {
		const result = await fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchJson({ results: [], _links: {} }) })
		assert.deepEqual(result.comments, [])
	})

	it('falls back to accountId then empty string when createdBy lacks a display name', async () => {
		const json = {
			results: [
				{
					id: 'c-acct',
					body: { storage: { value: '<p>x</p>' } },
					extensions: { location: 'footer', inlineProperties: null },
					history: { createdBy: { accountId: 'acc-42' }, createdDate: '' },
				},
				{
					id: 'c-null',
					body: { storage: { value: '<p>y</p>' } },
					extensions: { location: 'footer', inlineProperties: null },
					history: { createdBy: null, createdDate: '' },
				},
			],
			_links: {},
		}
		const result = await fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments[0].author, 'acc-42')
		assert.equal(result.comments[1].author, '')
	})

	it('follows _links.next pagination to fetch all pages', async () => {
		let call = 0
		const pagingFetch = async () => {
			call++
			if (call === 1) {
				return {
					ok: true,
					status: 200,
					json: async () => ({
						results: [
							{
								id: 'c1',
								body: { storage: { value: 'p1' } },
								extensions: { location: 'footer', inlineProperties: null },
								history: { createdBy: { displayName: 'A' }, createdDate: '' },
							},
						],
						_links: { next: '/wiki/rest/api/content/123/child/comment?start=100&limit=100' },
					}),
				}
			}
			return {
				ok: true,
				status: 200,
				json: async () => ({
					results: [
						{
							id: 'c2',
							body: { storage: { value: 'p2' } },
							extensions: { location: 'footer', inlineProperties: null },
							history: { createdBy: { displayName: 'B' }, createdDate: '' },
						},
					],
					_links: {},
				}),
			}
		}
		const result = await fetchConfluenceComments(PAGE_URL, CREDS, { fetch: pagingFetch })
		assert.equal(result.comments.length, 2)
		assert.equal(result.comments[0].id, 'c1')
		assert.equal(result.comments[1].id, 'c2')
		assert.equal(call, 2)
	})

	it('strips HTML tags from the comment body', async () => {
		const json = {
			results: [
				{
					id: 'c-html',
					body: { storage: { value: '<p>Hello <strong>world</strong></p>' } },
					extensions: { location: 'footer', inlineProperties: null },
					history: { createdBy: { displayName: 'A' }, createdDate: '' },
				},
			],
			_links: {},
		}
		const result = await fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments[0].body, 'Hello world')
	})

	it('throws FetchError with kind not-found on 404', async () => {
		await assert.rejects(
			() => fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchStatus(404) }),
			(err) => /** @type {any} */ (err).kind === 'not-found'
		)
	})

	it('throws FetchError with kind auth-error on 401', async () => {
		await assert.rejects(
			() => fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchStatus(401) }),
			(err) => /** @type {any} */ (err).kind === 'auth-error'
		)
	})

	it('throws FetchError with kind not-found when URL has no page ID', async () => {
		await assert.rejects(
			() =>
				fetchConfluenceComments('https://example.com/wiki/something', CREDS, {
					fetch: fetchThrows(new Error('unused')),
				}),
			(err) => /** @type {any} */ (err).kind === 'not-found'
		)
	})

	it('throws FetchError with kind unreachable on transport error', async () => {
		await assert.rejects(
			() => fetchConfluenceComments(PAGE_URL, CREDS, { fetch: fetchThrows(new TypeError('fetch failed')) }),
			(err) => /** @type {any} */ (err).kind === 'unreachable'
		)
	})
})
