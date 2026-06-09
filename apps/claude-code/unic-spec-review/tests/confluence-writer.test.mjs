// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { postFinding } from '../scripts/lib/confluence-writer.mjs'

/** @import { AtlassianCreds } from '../scripts/lib/credentials.mjs' */

/** @type {AtlassianCreds} */
const CREDS = { url: 'https://unic.atlassian.net', username: 'u@unic.com', token: 'tok', jiraUrl: '' }

const FINDING = {
	title: 'Missing error state',
	body: 'The form has no error handling.',
	severity: 'important',
	confidence: 85,
	dimension: 'Gaps',
	hat: 'black',
	anchor: 'The form has no error handling',
}

// A page body containing the anchor text so resolveAnchor returns 'inline'.
const PAGE_HTML = '<p>The form has no error handling.</p>'

const CONTENT = '/wiki/rest/api/content/'
const INLINE = '/wiki/api/v2/inline-comments'
const FOOTER = '/wiki/api/v2/footer-comments'

/**
 * Build a stub fetch that dispatches by URL substring.
 * @param {Record<string, { status: number, json: any }>} routes
 * @returns {import('../scripts/atlassian-fetch.mjs').FetchLike}
 */
function routingFetch(routes) {
	return async (url) => {
		for (const [key, val] of Object.entries(routes)) {
			if (url.includes(key)) {
				return { ok: val.status >= 200 && val.status < 300, status: val.status, json: async () => val.json }
			}
		}
		throw new Error(`Unhandled URL in stub: ${url}`)
	}
}

const PAGE_OK = { status: 200, json: { body: { storage: { value: PAGE_HTML } } } }

describe('postFinding', () => {
	it('inline anchor resolves and inline post succeeds — returns type:inline reason:null', async () => {
		const fetch = routingFetch({
			[CONTENT]: PAGE_OK,
			[INLINE]: { status: 201, json: { id: 'inline-1', version: { createdAt: '' } } },
		})
		const result = await postFinding({ pageId: '123', finding: FINDING, creds: CREDS, fetch })
		assert.equal(result.type, 'inline')
		assert.equal(result.reason, null)
		assert.equal(result.id, 'inline-1')
	})

	it('inline-400 falls back to footer with type:footer and reason:inline-rejected', async () => {
		const fetch = routingFetch({
			[CONTENT]: PAGE_OK,
			[INLINE]: { status: 400, json: {} },
			[FOOTER]: { status: 201, json: { id: 'footer-1', version: { createdAt: '' } } },
		})
		const result = await postFinding({ pageId: '123', finding: FINDING, creds: CREDS, fetch })
		assert.equal(result.type, 'footer')
		assert.equal(result.reason, 'inline-rejected')
		assert.equal(result.id, 'footer-1')
	})

	it('inline-401 fails loud without calling the footer endpoint', async () => {
		let footerCalled = false
		const fetch = routingFetch({
			[CONTENT]: PAGE_OK,
			[INLINE]: { status: 401, json: {} },
		})
		/** @param {string} url @param {any} [opts] */
		const guardedFetch = async (url, opts) => {
			if (url.includes(FOOTER)) {
				footerCalled = true
				return { ok: true, status: 201, json: async () => ({ id: 'x', version: { createdAt: '' } }) }
			}
			return fetch(url, opts)
		}
		await assert.rejects(
			() => postFinding({ pageId: '123', finding: FINDING, creds: CREDS, fetch: guardedFetch }),
			(err) => /** @type {any} */ (err).kind === 'auth-error'
		)
		assert.equal(footerCalled, false)
	})

	it('inline network-throw fails loud without calling the footer endpoint', async () => {
		// postJson wraps a thrown fetch error as FetchError kind 'unreachable' (not
		// 'rejected'), so it is never retried as a footer.
		let footerCalled = false
		/** @param {string} url */
		const fetch = async (url) => {
			if (url.includes(CONTENT)) {
				return { ok: true, status: 200, json: async () => ({ body: { storage: { value: PAGE_HTML } } }) }
			}
			if (url.includes(INLINE)) throw new TypeError('network failure')
			footerCalled = true
			return { ok: true, status: 201, json: async () => ({ id: 'x', version: { createdAt: '' } }) }
		}
		await assert.rejects(
			() => postFinding({ pageId: '123', finding: FINDING, creds: CREDS, fetch }),
			(err) => /** @type {any} */ (err).kind === 'unreachable'
		)
		assert.equal(footerCalled, false)
	})

	it('inline-rejected + footer-500 fails loud with no phantom success', async () => {
		const fetch = routingFetch({
			[CONTENT]: PAGE_OK,
			[INLINE]: { status: 400, json: {} },
			[FOOTER]: { status: 500, json: {} },
		})
		await assert.rejects(
			() => postFinding({ pageId: '123', finding: FINDING, creds: CREDS, fetch }),
			(err) => /** @type {any} */ (err).kind === 'unreachable'
		)
	})

	it('resolver-footer (no anchor) hits only the footer endpoint, reason is no-anchor', async () => {
		let inlineCalled = false
		/** @param {string} url */
		const fetch = async (url) => {
			if (url.includes(CONTENT)) {
				return { ok: true, status: 200, json: async () => ({ body: { storage: { value: '<p>page</p>' } } }) }
			}
			if (url.includes(INLINE)) {
				inlineCalled = true
			}
			return { ok: true, status: 201, json: async () => ({ id: 'footer-2', version: { createdAt: '' } }) }
		}
		const noAnchorFinding = { ...FINDING, anchor: null }
		const result = await postFinding({ pageId: '123', finding: noAnchorFinding, creds: CREDS, fetch })
		assert.equal(result.type, 'footer')
		assert.equal(result.reason, 'no-anchor')
		assert.equal(inlineCalled, false)
	})
})
