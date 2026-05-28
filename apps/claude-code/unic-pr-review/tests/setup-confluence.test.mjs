// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { isEnvConfigured, writeConfluenceCreds } from '../scripts/setup-confluence.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `setup-confluence-test-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

describe('writeConfluenceCreds', () => {
	it('happy path — writes correct JSON to temp home and chmods 600 on linux', () => {
		const home = tempDir()
		/** @type {{ p: string, m: number }[]} */
		const chmodCalls = []
		const { path } = writeConfluenceCreds('https://x.atlassian.net', 'u', 'tok', {
			homedir: home,
			platform: 'linux',
			chmod: (p, m) => chmodCalls.push({ p, m }),
		})
		const content = JSON.parse(readFileSync(path, 'utf8'))
		assert.equal(content.url, 'https://x.atlassian.net')
		assert.equal(content.username, 'u')
		assert.equal(content.token, 'tok')
		assert.equal(chmodCalls.length, 1)
		assert.equal(chmodCalls[0].p, `${path}.tmp`)
		assert.equal(chmodCalls[0].m, 0o600)
	})

	it('writes atomically via tmp + rename', () => {
		const home = tempDir()
		/** @type {string[]} */
		const writeOrder = []
		writeConfluenceCreds('https://x.atlassian.net', 'u', 'tok', {
			homedir: home,
			platform: 'linux',
			writeFile: (p) => writeOrder.push(`write:${p}`),
			rename: (from, to) => writeOrder.push(`rename:${from}->${to}`),
			chmod: (p) => writeOrder.push(`chmod:${p}`),
		})
		const target = join(home, '.unic-confluence.json')
		assert.deepEqual(writeOrder, [`write:${target}.tmp`, `chmod:${target}.tmp`, `rename:${target}.tmp->${target}`])
	})

	it('idempotent re-run — same file, no error on second call', () => {
		const home = tempDir()
		const opts = { homedir: home, platform: 'linux', chmod: () => {} }
		writeConfluenceCreds('https://x.atlassian.net', 'u', 'tok', opts)
		assert.doesNotThrow(() => writeConfluenceCreds('https://x.atlassian.net', 'u', 'tok', opts))
		const content = JSON.parse(readFileSync(join(home, '.unic-confluence.json'), 'utf8'))
		assert.equal(content.url, 'https://x.atlassian.net')
	})

	it('preserves jiraUrl and other existing fields when re-running to rotate credentials', () => {
		const home = tempDir()
		const opts = { homedir: home, platform: 'linux', chmod: () => {} }
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({
				url: 'https://x.atlassian.net',
				username: 'u',
				token: 'old',
				jiraUrl: 'https://jira.atlassian.net',
				bitbucketUrl: 'https://bitbucket.example.com',
			})
		)
		writeConfluenceCreds('https://x.atlassian.net', 'u', 'new-tok', opts)
		const content = JSON.parse(readFileSync(join(home, '.unic-confluence.json'), 'utf8'))
		assert.equal(content.token, 'new-tok')
		assert.equal(content.jiraUrl, 'https://jira.atlassian.net')
		assert.equal(content.bitbucketUrl, 'https://bitbucket.example.com')
	})

	it('warns and overwrites when the existing file contains invalid JSON', () => {
		const home = tempDir()
		writeFileSync(join(home, '.unic-confluence.json'), 'not-valid-json')
		/** @type {string[]} */
		const warns = []
		writeConfluenceCreds('https://x.atlassian.net', 'u', 'tok', {
			homedir: home,
			platform: 'linux',
			chmod: () => {},
			warn: (m) => warns.push(m),
		})
		assert.equal(warns.length, 1)
		assert.match(warns[0], /invalid JSON/)
		const content = JSON.parse(readFileSync(join(home, '.unic-confluence.json'), 'utf8'))
		assert.equal(content.token, 'tok')
		assert.equal(content.jiraUrl, undefined)
	})

	it('rethrows non-syntax read errors (e.g. EACCES) instead of silently dropping data', () => {
		const home = tempDir()
		assert.throws(
			() =>
				writeConfluenceCreds('https://x.atlassian.net', 'u', 'tok', {
					homedir: home,
					platform: 'linux',
					exists: () => true,
					readFile: () => {
						const err = /** @type {Error & { code?: string }} */ (new Error('EACCES: permission denied'))
						err.code = 'EACCES'
						throw err
					},
					writeFile: () => {
						throw new Error('write must not be called when read fails')
					},
					chmod: () => {},
				}),
			/EACCES/
		)
	})

	it('Windows chmod warning branch — warn called with icacls hint, chmod skipped', () => {
		const home = tempDir()
		/** @type {string[]} */
		const warns = []
		/** @type {boolean[]} */
		const chmodCalled = []
		writeConfluenceCreds('https://x.atlassian.net', 'u', 'tok', {
			homedir: home,
			platform: 'win32',
			warn: (msg) => warns.push(msg),
			chmod: () => chmodCalled.push(true),
		})
		assert.equal(chmodCalled.length, 0)
		assert.equal(warns.length, 1)
		assert.match(warns[0], /Windows/)
		assert.match(warns[0], /icacls/)
	})

	it('throws when home cannot be determined', () => {
		assert.throws(
			() => writeConfluenceCreds('https://x', 'u', 't', { homedir: '', platform: 'linux', chmod: () => {} }),
			/could not determine home directory/
		)
	})
})

describe('isEnvConfigured', () => {
	it('returns true when CONFLUENCE_URL, CONFLUENCE_USER and CONFLUENCE_TOKEN are all set', () => {
		assert.equal(
			isEnvConfigured({
				CONFLUENCE_URL: 'https://x.atlassian.net',
				CONFLUENCE_USER: 'u',
				CONFLUENCE_TOKEN: 't',
			}),
			true
		)
	})

	it('returns false when any of the three is missing', () => {
		assert.equal(isEnvConfigured({ CONFLUENCE_URL: 'x', CONFLUENCE_USER: 'u' }), false)
		assert.equal(isEnvConfigured({ CONFLUENCE_URL: 'x', CONFLUENCE_TOKEN: 't' }), false)
		assert.equal(isEnvConfigured({ CONFLUENCE_USER: 'u', CONFLUENCE_TOKEN: 't' }), false)
		assert.equal(isEnvConfigured({}), false)
	})
})
