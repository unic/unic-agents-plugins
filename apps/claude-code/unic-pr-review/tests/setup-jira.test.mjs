// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { isJiraEnvConfigured, writeJiraUrl } from '../scripts/setup-jira.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `setup-jira-test-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

describe('writeJiraUrl', () => {
	it('happy path — adds jiraUrl to existing file, preserves other fields', () => {
		const home = tempDir()
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({ url: 'https://x.atlassian.net', username: 'u', token: 't' })
		)
		const { path, noOp } = writeJiraUrl('https://jira.atlassian.net', {
			homedir: home,
			platform: 'linux',
			chmod: () => {},
		})
		assert.equal(noOp, false)
		const content = JSON.parse(readFileSync(path, 'utf8'))
		assert.equal(content.url, 'https://x.atlassian.net')
		assert.equal(content.username, 'u')
		assert.equal(content.token, 't')
		assert.equal(content.jiraUrl, 'https://jira.atlassian.net')
	})

	it('writes atomically via tmp + rename', () => {
		const home = tempDir()
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({ url: 'https://x.atlassian.net', username: 'u', token: 't' })
		)
		/** @type {string[]} */
		const order = []
		writeJiraUrl('https://jira.atlassian.net', {
			homedir: home,
			platform: 'linux',
			writeFile: (p) => order.push(`write:${p}`),
			rename: (from, to) => order.push(`rename:${from}->${to}`),
			chmod: (p) => order.push(`chmod:${p}`),
		})
		const target = join(home, '.unic-confluence.json')
		assert.deepEqual(order, [`write:${target}.tmp`, `chmod:${target}.tmp`, `rename:${target}.tmp->${target}`])
	})

	it('idempotent re-run — same jiraUrl returns noOp:true and does not rewrite the file', () => {
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
		/** @type {boolean[]} */
		const writeCalls = []
		const { noOp } = writeJiraUrl('https://jira.atlassian.net', {
			homedir: home,
			platform: 'linux',
			writeFile: () => writeCalls.push(true),
			chmod: () => {},
		})
		assert.equal(noOp, true)
		assert.equal(writeCalls.length, 0)
	})

	it('Windows chmod warning branch — warn called with icacls hint, chmod skipped', () => {
		const home = tempDir()
		writeFileSync(
			join(home, '.unic-confluence.json'),
			JSON.stringify({ url: 'https://x.atlassian.net', username: 'u', token: 't' })
		)
		/** @type {string[]} */
		const warns = []
		/** @type {boolean[]} */
		const chmodCalled = []
		writeJiraUrl('https://jira.atlassian.net', {
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
			() => writeJiraUrl('https://jira.atlassian.net', { homedir: '', platform: 'linux', chmod: () => {} }),
			/could not determine home directory/
		)
	})

	it('throws a descriptive error when the source file is missing', () => {
		const home = tempDir()
		assert.throws(
			() => writeJiraUrl('https://jira.atlassian.net', { homedir: home, platform: 'linux' }),
			/not found|setup-confluence/
		)
	})

	it('throws a descriptive error when the existing file contains invalid JSON', () => {
		const home = tempDir()
		writeFileSync(join(home, '.unic-confluence.json'), 'not-valid-json')
		assert.throws(
			() => writeJiraUrl('https://jira.atlassian.net', { homedir: home, platform: 'linux' }),
			/invalid JSON/
		)
	})
})

describe('isJiraEnvConfigured', () => {
	it('returns true when JIRA_URL is set', () => {
		assert.equal(isJiraEnvConfigured({ JIRA_URL: 'https://jira.atlassian.net' }), true)
	})

	it('returns false when JIRA_URL is unset', () => {
		assert.equal(isJiraEnvConfigured({}), false)
		assert.equal(isJiraEnvConfigured({ JIRA_URL: '' }), false)
	})
})
