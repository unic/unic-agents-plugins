// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { loadAtlassianCreds, loadAzureCreds } from '../scripts/lib/credentials.mjs'

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
})

describe('loadAzureCreds', () => {
	it('returns creds from env vars', () => {
		const env = { AZURE_DEVOPS_ORG_URL: 'https://dev.azure.com/org', AZURE_DEVOPS_PAT: 'pat123' }
		const r = loadAzureCreds(undefined, env)
		assert.ok(r)
		assert.equal(r.orgUrl, 'https://dev.azure.com/org')
		assert.equal(r.pat, 'pat123')
	})

	it('returns null when env is incomplete and file is absent', () => {
		assert.equal(loadAzureCreds(tempDir(), {}), null)
	})

	it('returns creds from file when env is not set', () => {
		const home = tempDir()
		writeFileSync(join(home, '.unic-azure.json'), JSON.stringify({ orgUrl: 'https://dev.azure.com/org', pat: 'p' }))
		const r = loadAzureCreds(home, {})
		assert.ok(r)
		assert.equal(r.pat, 'p')
	})

	it('returns null when file is present but missing required fields', () => {
		const home = tempDir()
		writeFileSync(join(home, '.unic-azure.json'), JSON.stringify({ orgUrl: 'https://dev.azure.com/org' }))
		assert.equal(loadAzureCreds(home, {}), null)
	})

	it('throws a descriptive error on malformed JSON', () => {
		const home = tempDir()
		writeFileSync(join(home, '.unic-azure.json'), 'not-valid-json')
		assert.throws(() => loadAzureCreds(home, {}), /invalid JSON/)
	})
})
