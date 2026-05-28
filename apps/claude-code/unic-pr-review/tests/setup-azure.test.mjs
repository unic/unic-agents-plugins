// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { isAzureEnvConfigured, writeAzureCreds } from '../scripts/setup-azure.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `setup-azure-test-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

describe('writeAzureCreds', () => {
	it('happy path — writes correct JSON to temp home and chmods 600 on linux', () => {
		const home = tempDir()
		/** @type {{ p: string, m: number }[]} */
		const chmodCalls = []
		const { path } = writeAzureCreds('https://dev.azure.com/org', 'pat123', {
			homedir: home,
			platform: 'linux',
			chmod: (p, m) => chmodCalls.push({ p, m }),
		})
		const content = JSON.parse(readFileSync(path, 'utf8'))
		assert.equal(content.orgUrl, 'https://dev.azure.com/org')
		assert.equal(content.pat, 'pat123')
		assert.equal(chmodCalls.length, 1)
		assert.equal(chmodCalls[0].p, `${path}.tmp`)
		assert.equal(chmodCalls[0].m, 0o600)
	})

	it('writes atomically via tmp + rename', () => {
		const home = tempDir()
		/** @type {string[]} */
		const order = []
		writeAzureCreds('https://dev.azure.com/org', 'pat123', {
			homedir: home,
			platform: 'linux',
			writeFile: (p) => order.push(`write:${p}`),
			rename: (from, to) => order.push(`rename:${from}->${to}`),
			chmod: (p) => order.push(`chmod:${p}`),
		})
		const target = join(home, '.unic-azure.json')
		assert.deepEqual(order, [`write:${target}.tmp`, `chmod:${target}.tmp`, `rename:${target}.tmp->${target}`])
	})

	it('idempotent re-run — same file, no error on second call', () => {
		const home = tempDir()
		const opts = { homedir: home, platform: 'linux', chmod: () => {} }
		writeAzureCreds('https://dev.azure.com/org', 'pat123', opts)
		assert.doesNotThrow(() => writeAzureCreds('https://dev.azure.com/org', 'pat123', opts))
		const content = JSON.parse(readFileSync(join(home, '.unic-azure.json'), 'utf8'))
		assert.equal(content.orgUrl, 'https://dev.azure.com/org')
	})

	it('Windows chmod warning branch — warn called with icacls hint, chmod skipped', () => {
		const home = tempDir()
		/** @type {string[]} */
		const warns = []
		/** @type {boolean[]} */
		const chmodCalled = []
		writeAzureCreds('https://dev.azure.com/org', 'pat123', {
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
			() => writeAzureCreds('https://dev.azure.com/org', 'pat', { homedir: '', platform: 'linux', chmod: () => {} }),
			/could not determine home directory/
		)
	})
})

describe('isAzureEnvConfigured', () => {
	it('returns true when AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PAT are both set', () => {
		assert.equal(
			isAzureEnvConfigured({
				AZURE_DEVOPS_ORG_URL: 'https://dev.azure.com/org',
				AZURE_DEVOPS_PAT: 'pat',
			}),
			true
		)
	})

	it('returns false when either is missing', () => {
		assert.equal(isAzureEnvConfigured({ AZURE_DEVOPS_ORG_URL: 'x' }), false)
		assert.equal(isAzureEnvConfigured({ AZURE_DEVOPS_PAT: 'p' }), false)
		assert.equal(isAzureEnvConfigured({}), false)
	})
})
