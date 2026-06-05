// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { loadAtlassianCreds } from '../scripts/lib/credentials.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `creds-test-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

describe('loadAtlassianCreds', () => {
	it('returns creds from env vars when all three are set', () => {
		const env = { CONFLUENCE_URL: 'https://x.atlassian.net', CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }
		const r = loadAtlassianCreds(undefined, env)
		assert.ok(r)
		assert.equal(r.url, 'https://x.atlassian.net')
		assert.equal(r.jiraUrl, undefined)
	})

	it('includes jiraUrl from env when JIRA_URL is set', () => {
		const env = {
			CONFLUENCE_URL: 'https://x.atlassian.net',
			CONFLUENCE_USER: 'u',
			CONFLUENCE_TOKEN: 't',
			JIRA_URL: 'https://jira.atlassian.net',
		}
		const r = loadAtlassianCreds(undefined, env)
		assert.ok(r)
		assert.equal(r.jiraUrl, 'https://jira.atlassian.net')
	})

	it('returns null when env is incomplete and file is absent', () => {
		assert.equal(loadAtlassianCreds(tempDir(), {}), null)
	})

	it('returns creds from file when env is not set', () => {
		const home = tempDir()
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({ url: 'https://x.atlassian.net', username: 'u', token: 't' })
		)
		const r = loadAtlassianCreds(home, {})
		assert.ok(r)
		assert.equal(r.url, 'https://x.atlassian.net')
	})

	it('returns null when file is present but missing required fields', () => {
		const home = tempDir()
		writeFileSync(join(home, '.unic-confluence.json'), JSON.stringify({ url: 'https://x.atlassian.net' }))
		assert.equal(loadAtlassianCreds(home, {}), null)
	})

	it('throws a descriptive error on malformed JSON', () => {
		const home = tempDir()
		writeFileSync(join(home, '.unic-confluence.json'), 'not-valid-json')
		assert.throws(() => loadAtlassianCreds(home, {}), /invalid JSON/)
	})

	it('prefers env vars over a present file when both are configured', () => {
		const home = tempDir()
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({ url: 'https://file.example.com', username: 'fileuser', token: 'filetoken' })
		)
		const env = {
			CONFLUENCE_URL: 'https://env.example.com',
			CONFLUENCE_USER: 'envuser',
			CONFLUENCE_TOKEN: 'envtoken',
		}
		const r = loadAtlassianCreds(home, env)
		assert.ok(r)
		assert.equal(r.url, 'https://env.example.com')
	})

	it('includes jiraUrl from file when present', () => {
		const home = tempDir()
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({
				url: 'https://x.atlassian.net',
				username: 'u',
				token: 't',
				jiraUrl: 'https://jira.atlassian.net',
			})
		)
		const r = loadAtlassianCreds(home, {})
		assert.ok(r)
		assert.equal(r.jiraUrl, 'https://jira.atlassian.net')
	})
})
