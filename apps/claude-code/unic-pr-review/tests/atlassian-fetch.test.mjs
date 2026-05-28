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
	extractJiraKey,
	FETCH_TIMEOUT_MS,
	fetchConfluencePage,
	fetchJiraIssue,
	main,
	mapFetchError,
	parseJiraACs,
	parseJiraBug,
	parseUrlsArg,
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
	it('returns jira for a /browse/ path', () => {
		assert.equal(routeUrl('https://unic.atlassian.net/browse/PROJ-42'), 'jira')
	})

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

describe('extractJiraKey', () => {
	it('extracts the key from a standard browse URL', () => {
		assert.equal(extractJiraKey('https://x.atlassian.net/browse/PROJ-42'), 'PROJ-42')
	})

	it('extracts a key with a short project code', () => {
		assert.equal(extractJiraKey('https://x.atlassian.net/browse/AB-1'), 'AB-1')
	})

	it('returns null when there is no /browse/ segment', () => {
		assert.equal(extractJiraKey('https://example.com/something'), null)
	})

	it('returns null for an invalid URL', () => {
		assert.equal(extractJiraKey('PROJ-42'), null)
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

describe('parseJiraACs', () => {
	it('extracts ACs from an ADF description with an acceptance criteria heading', () => {
		const description = {
			type: 'doc',
			content: [
				{ type: 'heading', content: [{ type: 'text', text: 'Acceptance Criteria' }] },
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'User can log in' }] }],
						},
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Error is displayed on failure' }] }],
						},
					],
				},
			],
		}
		assert.deepEqual(parseJiraACs(description), ['User can log in', 'Error is displayed on failure'])
	})

	it('stops collecting at the next heading', () => {
		const description = {
			type: 'doc',
			content: [
				{ type: 'heading', content: [{ type: 'text', text: 'Acceptance Criteria' }] },
				{
					type: 'bulletList',
					content: [
						{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC one' }] }] },
					],
				},
				{ type: 'heading', content: [{ type: 'text', text: 'Notes' }] },
				{
					type: 'bulletList',
					content: [
						{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'not an AC' }] }] },
					],
				},
			],
		}
		assert.deepEqual(parseJiraACs(description), ['AC one'])
	})

	it('returns an empty array when there is no acceptance criteria section', () => {
		const description = {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'just a description' }] }],
		}
		assert.deepEqual(parseJiraACs(description), [])
	})

	it('handles a plain string description', () => {
		assert.deepEqual(parseJiraACs('Acceptance Criteria:\n- AC 1\n- AC 2'), ['AC 1', 'AC 2'])
	})

	it('returns an empty array for null/undefined', () => {
		assert.deepEqual(parseJiraACs(null), [])
		assert.deepEqual(parseJiraACs(undefined), [])
	})

	it('extracts ACs from an orderedList as well as bulletList', () => {
		const description = {
			type: 'doc',
			content: [
				{ type: 'heading', content: [{ type: 'text', text: 'Acceptance Criteria' }] },
				{
					type: 'orderedList',
					content: [
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC from ordered list' }] }],
						},
					],
				},
			],
		}
		assert.deepEqual(parseJiraACs(description), ['AC from ordered list'])
	})
})

describe('parseJiraBug', () => {
	it('extracts repro, expected, actual from custom fields', () => {
		const fields = {
			customfield_10300: 'Open the app and click Save',
			customfield_10301: 'File is saved',
			customfield_10302: 'Nothing happens',
		}
		assert.deepEqual(parseJiraBug(fields), {
			repro: 'Open the app and click Save',
			expected: 'File is saved',
			actual: 'Nothing happens',
		})
	})

	it('falls back to ADF description headings when custom fields are absent', () => {
		const fields = {
			description: {
				type: 'doc',
				content: [
					{ type: 'heading', content: [{ type: 'text', text: 'Steps to Reproduce' }] },
					{ type: 'paragraph', content: [{ type: 'text', text: 'Do the thing' }] },
					{ type: 'heading', content: [{ type: 'text', text: 'Expected' }] },
					{ type: 'paragraph', content: [{ type: 'text', text: 'It works' }] },
					{ type: 'heading', content: [{ type: 'text', text: 'Actual' }] },
					{ type: 'paragraph', content: [{ type: 'text', text: 'It breaks' }] },
				],
			},
		}
		assert.deepEqual(parseJiraBug(fields), { repro: 'Do the thing', expected: 'It works', actual: 'It breaks' })
	})

	it('returns empty strings when nothing is present', () => {
		assert.deepEqual(parseJiraBug({}), { repro: '', expected: '', actual: '' })
		assert.deepEqual(parseJiraBug(null), { repro: '', expected: '', actual: '' })
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

describe('fetchJiraIssue', () => {
	it('fetches a story and returns the acs array', async () => {
		const story = {
			key: 'PROJ-42',
			fields: {
				summary: 'Login feature',
				issuetype: { name: 'Story' },
				description: {
					type: 'doc',
					content: [
						{ type: 'heading', content: [{ type: 'text', text: 'Acceptance Criteria' }] },
						{
							type: 'bulletList',
							content: [
								{
									type: 'listItem',
									content: [{ type: 'paragraph', content: [{ type: 'text', text: 'User can log in' }] }],
								},
							],
						},
					],
				},
			},
		}
		const item = await fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-42', CREDS, { fetch: fetchJson(story) })
		assert.equal(item.type, 'story')
		assert.equal(item.id, 'PROJ-42')
		assert.deepEqual(item.acs, ['User can log in'])
	})

	it('fetches a bug and returns repro/expected/actual', async () => {
		const bug = {
			key: 'PROJ-7',
			fields: {
				summary: 'Crash on save',
				issuetype: { name: 'Bug' },
				customfield_10300: 'Click save',
				customfield_10301: 'Saved',
				customfield_10302: 'Crash',
			},
		}
		const item = await fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-7', CREDS, { fetch: fetchJson(bug) })
		assert.equal(item.type, 'bug')
		assert.equal(item.repro, 'Click save')
		assert.equal(item.expected, 'Saved')
		assert.equal(item.actual, 'Crash')
	})

	it('extracts absolute Confluence links from the issue body', async () => {
		const story = {
			key: 'PROJ-9',
			fields: {
				summary: 'Has a doc link',
				issuetype: { name: 'Story' },
				description: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [
								{
									type: 'text',
									text: 'see docs',
									marks: [{ type: 'link', attrs: { href: 'https://unic.atlassian.net/wiki/spaces/X/pages/55' } }],
								},
							],
						},
					],
				},
			},
		}
		const item = await fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-9', CREDS, { fetch: fetchJson(story) })
		assert.deepEqual(item.confluenceLinks, ['https://unic.atlassian.net/wiki/spaces/X/pages/55'])
	})

	it('throws FetchError with kind unreachable on network failure', async () => {
		await assert.rejects(
			() =>
				fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-1', CREDS, {
					fetch: fetchThrows(new TypeError('fetch failed')),
				}),
			(err) => /** @type {any} */ (err).kind === 'unreachable'
		)
	})

	it('throws FetchError with kind auth-error on 401', async () => {
		await assert.rejects(
			() => fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-1', CREDS, { fetch: fetchStatus(401) }),
			(err) => /** @type {any} */ (err).kind === 'auth-error'
		)
	})

	it('throws FetchError with kind not-found on 404', async () => {
		await assert.rejects(
			() => fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-1', CREDS, { fetch: fetchStatus(404) }),
			(err) => /** @type {any} */ (err).kind === 'not-found'
		)
	})

	it('classifies an Epic as a story (returns acs, not bug fields)', async () => {
		const epic = {
			key: 'PROJ-10',
			fields: { summary: 'Epic story', issuetype: { name: 'Epic' }, description: {} },
		}
		const item = await fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-10', CREDS, { fetch: fetchJson(epic) })
		assert.equal(item.type, 'story')
		assert.deepEqual(item.acs, [])
	})

	it('classifies a Defect as a bug', async () => {
		const defect = {
			key: 'PROJ-11',
			fields: {
				summary: 'A defect',
				issuetype: { name: 'Defect' },
				customfield_10300: 'repro',
				customfield_10301: 'expected',
				customfield_10302: 'actual',
			},
		}
		const item = await fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-11', CREDS, { fetch: fetchJson(defect) })
		assert.equal(item.type, 'bug')
		assert.equal(item.repro, 'repro')
	})

	it('classifies a Task as other (no acs, no bug fields)', async () => {
		const task = {
			key: 'PROJ-12',
			fields: { summary: 'A task', issuetype: { name: 'Task' }, description: {} },
		}
		const item = await fetchJiraIssue('https://unic.atlassian.net/browse/PROJ-12', CREDS, { fetch: fetchJson(task) })
		assert.equal(item.type, 'other')
		assert.deepEqual(item.acs, [])
		assert.equal(item.repro, '')
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

describe('parseUrlsArg', () => {
	it('splits a comma-separated --urls value, trimming and dropping empties', () => {
		assert.deepEqual(parseUrlsArg(['--urls', ' a , b ,, c ']), ['a', 'b', 'c'])
	})

	it('returns an empty array when --urls is absent', () => {
		assert.deepEqual(parseUrlsArg([]), [])
	})

	it('returns an empty array for an empty --urls value', () => {
		assert.deepEqual(parseUrlsArg(['--urls', '']), [])
	})
})

describe('collectIntent — credential resolution', () => {
	it('reports a credential error when neither env vars nor file are present', async () => {
		const result = await collectIntent(['https://x.atlassian.net/browse/A-1'], { homedir: tempDir(), env: {} })
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'auth-error')
		assert.equal(result.errors[0].url, '')
	})

	it('resolves creds from env vars and routes a Jira URL', async () => {
		const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }
		const story = { key: 'A-1', fields: { summary: 's', issuetype: { name: 'Story' }, description: {} } }
		const result = await collectIntent(['https://x.atlassian.net/browse/A-1'], { env, fetch: fetchJson(story) })
		assert.equal(result.items.length, 1)
		assert.equal(result.items[0].id, 'A-1')
		assert.deepEqual(result.errors, [])
	})

	it('reads creds from ~/.unic-confluence.json when env vars are absent', async () => {
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
	})
})

describe('collectIntent — routing and errors', () => {
	const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }

	it('records unrecognised URLs as a soft `unsupported` error plus a stderr warning', async () => {
		/** @type {string[]} */
		const warnings = []
		const adoUrl = 'https://dev.azure.com/org/proj/_workitems/edit/9'
		const result = await collectIntent([adoUrl], {
			env,
			stderr: { write: (s) => warnings.push(s) },
		})
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'unsupported')
		assert.equal(result.errors[0].url, adoUrl)
		assert.match(warnings.join(''), /unrecognised URL/)
	})

	it('collects a FetchError into the errors array without throwing', async () => {
		const result = await collectIntent(['https://x.atlassian.net/wiki/spaces/X/pages/1'], {
			env,
			fetch: fetchStatus(404),
		})
		assert.deepEqual(result.items, [])
		assert.equal(result.errors.length, 1)
		assert.equal(result.errors[0].kind, 'not-found')
		assert.equal(result.errors[0].url, 'https://x.atlassian.net/wiki/spaces/X/pages/1')
	})
})

describe('main', () => {
	it('writes the FetchOutput as JSON to the injected stdout', async () => {
		const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }
		const story = { key: 'A-1', fields: { summary: 's', issuetype: { name: 'Story' }, description: {} } }
		let out = ''
		const result = await main(['--urls', 'https://x.atlassian.net/browse/A-1'], {
			env,
			fetch: fetchJson(story),
			stdout: { write: (s) => (out += s) },
		})
		const parsed = JSON.parse(out)
		assert.equal(parsed.items.length, 1)
		assert.equal(parsed.items[0].id, 'A-1')
		assert.deepEqual(parsed, result)
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
