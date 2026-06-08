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
	mainFetchComments,
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
	/** @param {any[]} results @param {number} [size] */
	const makeCommentsJson = (results, size) => ({ results, size: size ?? results.length })

	/**
	 * @param {string} id
	 * @param {string} location
	 * @param {string} bodyHtml
	 * @param {string} displayName
	 */
	const makeRaw = (id, location, bodyHtml, displayName) => ({
		id,
		body: { storage: { value: bodyHtml } },
		extensions: { location },
		version: { by: { displayName } },
	})

	it('returns footer and inline comments with correct location field', async () => {
		const json = makeCommentsJson([
			makeRaw('1', 'footer', '<p>Footer note</p>', 'Alice'),
			makeRaw('2', 'inline', '<p>Inline note</p>', 'Bob'),
		])
		const result = await fetchConfluenceComments('99', CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments.length, 2)
		assert.equal(result.comments[0].location, 'footer')
		assert.equal(result.comments[0].author, 'Alice')
		assert.equal(result.comments[1].location, 'inline')
		assert.equal(result.comments[1].author, 'Bob')
	})

	it('strips HTML from comment body', async () => {
		const json = makeCommentsJson([makeRaw('1', 'footer', '<p>Hello <strong>world</strong></p>', 'Alice')])
		const result = await fetchConfluenceComments('99', CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments[0].body, 'Hello world')
	})

	it('caps comment body at 500 characters', async () => {
		const longText = 'x'.repeat(600)
		const json = makeCommentsJson([makeRaw('1', 'footer', longText, 'Alice')])
		const result = await fetchConfluenceComments('99', CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments[0].body.length, 500)
	})

	it('returns total from size field', async () => {
		const json = makeCommentsJson([makeRaw('1', 'footer', '<p>hi</p>', 'Alice')], 10)
		const result = await fetchConfluenceComments('99', CREDS, { fetch: fetchJson(json) })
		assert.equal(result.total, 10)
	})

	it('returns empty comments array when results is missing', async () => {
		const result = await fetchConfluenceComments('99', CREDS, { fetch: fetchJson({}) })
		assert.deepEqual(result.comments, [])
	})

	it('maps missing extensions.location to footer', async () => {
		const raw = { id: '1', body: { storage: { value: '<p>hi</p>' } }, version: { by: { displayName: 'X' } } }
		const json = makeCommentsJson([raw])
		const result = await fetchConfluenceComments('99', CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments[0].location, 'footer')
	})

	it('maps object-form extensions.location with type inline to inline', async () => {
		const raw = {
			id: '1',
			body: { storage: { value: '<p>hi</p>' } },
			extensions: { location: { type: 'inline', inlineMarkerRef: 'abc' } },
			version: { by: { displayName: 'X' } },
		}
		const json = makeCommentsJson([raw])
		const result = await fetchConfluenceComments('99', CREDS, { fetch: fetchJson(json) })
		assert.equal(result.comments[0].location, 'inline')
	})

	it('throws FetchError with kind auth-error on 401', async () => {
		await assert.rejects(
			() => fetchConfluenceComments('99', CREDS, { fetch: fetchStatus(401) }),
			(err) => /** @type {any} */ (err).kind === 'auth-error'
		)
	})

	it('throws FetchError with kind not-found on 404', async () => {
		await assert.rejects(
			() => fetchConfluenceComments('99', CREDS, { fetch: fetchStatus(404) }),
			(err) => /** @type {any} */ (err).kind === 'not-found'
		)
	})

	it('throws FetchError with kind unreachable on network failure', async () => {
		await assert.rejects(
			() => fetchConfluenceComments('99', CREDS, { fetch: fetchThrows(new TypeError('network down')) }),
			(err) => /** @type {any} */ (err).kind === 'unreachable'
		)
	})
})

describe('mainFetchComments', () => {
	/** @param {any[]} results */
	const makeCommentsJson = (results) => ({ results, size: results.length })
	/**
	 * @param {string} id
	 * @param {string} location
	 * @param {string} bodyHtml
	 * @param {string} displayName
	 */
	const makeRaw = (id, location, bodyHtml, displayName) => ({
		id,
		body: { storage: { value: bodyHtml } },
		extensions: { location },
		version: { by: { displayName } },
	})

	it('writes comments JSON to stdout and returns result', async () => {
		const chunks = /** @type {string[]} */ ([])
		const stdout = {
			write: (/** @type {string} */ s) => {
				chunks.push(s)
			},
		}
		const json = makeCommentsJson([makeRaw('1', 'footer', '<p>hi</p>', 'Alice')])
		const result = await mainFetchComments(['--fetch-comments', '12345'], {
			fetch: fetchJson(json),
			loadCreds: () => CREDS,
			stdout,
			stderr: { write: () => {} },
		})
		assert.equal(result.comments.length, 1)
		assert.equal(result.comments[0].author, 'Alice')
		const written = chunks.join('')
		assert.ok(written.includes('"comments"'))
		assert.ok(written.endsWith('\n'))
	})

	it('returns auth-error when credentials are missing', async () => {
		const chunks = /** @type {string[]} */ ([])
		const stdout = {
			write: (/** @type {string} */ s) => {
				chunks.push(s)
			},
		}
		const result = await mainFetchComments(['--fetch-comments', '12345'], {
			loadCreds: () => null,
			stdout,
			stderr: { write: () => {} },
		})
		assert.deepEqual(result.comments, [])
		assert.equal(result.error?.kind, 'auth-error')
	})

	it('returns auth-error when credential load throws', async () => {
		const chunks = /** @type {string[]} */ ([])
		const stdout = {
			write: (/** @type {string} */ s) => {
				chunks.push(s)
			},
		}
		const result = await mainFetchComments(['--fetch-comments', '12345'], {
			loadCreds: () => {
				throw new Error('bad JSON')
			},
			stdout,
			stderr: { write: () => {} },
		})
		assert.deepEqual(result.comments, [])
		assert.equal(result.error?.kind, 'auth-error')
	})

	it('throws when --fetch-comments is missing its page ID argument', async () => {
		await assert.rejects(
			() => mainFetchComments(['--fetch-comments'], { loadCreds: () => CREDS }),
			/requires a page ID/
		)
	})

	it('returns parse-error for a non-2xx response from the comments endpoint', async () => {
		const chunks = /** @type {string[]} */ ([])
		const stdout = {
			write: (/** @type {string} */ s) => {
				chunks.push(s)
			},
		}
		const result = await mainFetchComments(['--fetch-comments', '12345'], {
			fetch: fetchStatus(500),
			loadCreds: () => CREDS,
			stdout,
			stderr: { write: () => {} },
		})
		assert.deepEqual(result.comments, [])
		assert.ok(result.error !== undefined)
	})
})
