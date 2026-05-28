// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	checkAzCli,
	checkAzExtension,
	checkAzIdentity,
	checkAzLogin,
	checkConfluence,
	checkJira,
} from '../scripts/doctor.mjs'

/** @import { Exec, Ping } from '../scripts/doctor.mjs' */

/**
 * @param {{ok?: boolean, stdout?: string, stderr?: string}} r
 * @returns {Exec}
 */
const execReturning = (r) => () => ({ ok: r.ok ?? true, stdout: r.stdout ?? '', stderr: r.stderr ?? '' })

/**
 * @param {{ok?: boolean, status?: number}} r
 * @returns {Ping}
 */
const pingReturning = (r) => async () => ({ ok: r.ok ?? true, status: r.status ?? 200 })

describe('checkAzCli', () => {
	it('returns ok:true when az --version exits 0', () => {
		const exec = execReturning({ ok: true, stdout: 'azure-cli 2.60.0\n' })
		const r = checkAzCli(exec)
		assert.equal(r.ok, true)
		assert.match(r.detail, /azure-cli/)
	})

	it('returns ok:false when az is not on PATH', () => {
		const exec = execReturning({ ok: false, stderr: 'command not found: az' })
		assert.equal(checkAzCli(exec).ok, false)
	})
})

describe('checkAzExtension', () => {
	it('returns ok:true when azure-devops is in the extension list', () => {
		const exec = execReturning({
			ok: true,
			stdout: JSON.stringify([{ name: 'azure-devops', version: '0.26.0' }]),
		})
		const r = checkAzExtension(exec)
		assert.equal(r.ok, true)
		assert.match(r.detail, /azure-devops/)
	})

	it('returns ok:false when azure-devops is absent from the list', () => {
		const exec = execReturning({ ok: true, stdout: JSON.stringify([{ name: 'other-ext' }]) })
		assert.equal(checkAzExtension(exec).ok, false)
	})

	it('returns ok:false when extension list returns invalid JSON', () => {
		const exec = execReturning({ ok: true, stdout: 'not-json' })
		assert.equal(checkAzExtension(exec).ok, false)
	})
})

describe('checkAzLogin', () => {
	it('returns ok:true when devops project list exits 0', () => {
		const exec = execReturning({ ok: true, stdout: '[]' })
		assert.equal(checkAzLogin(exec).ok, true)
	})

	it('returns ok:false on non-zero exit (no cached login)', () => {
		const exec = execReturning({ ok: false, stderr: 'Please run az devops login' })
		assert.equal(checkAzLogin(exec).ok, false)
	})
})

describe('checkAzIdentity', () => {
	it('returns ok:true when user show resolves with an id', () => {
		const exec = execReturning({
			ok: true,
			stdout: JSON.stringify({ id: 'abc-123', emailAddress: 'user@unic.com' }),
		})
		const r = checkAzIdentity(exec)
		assert.equal(r.ok, true)
		assert.match(r.detail, /user@unic\.com/)
	})

	it('returns ok:false when user show exits non-zero', () => {
		const exec = execReturning({ ok: false, stderr: 'not logged in' })
		assert.equal(checkAzIdentity(exec).ok, false)
	})

	it('returns ok:false when user show succeeds but JSON has no id', () => {
		const exec = execReturning({ ok: true, stdout: JSON.stringify({ emailAddress: 'x@y.com' }) })
		assert.equal(checkAzIdentity(exec).ok, false)
	})
})

describe('checkConfluence', () => {
	it('returns ok:true on 200', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingReturning({ ok: true, status: 200 }))
		assert.equal(r.ok, true)
		assert.match(r.detail, /example\.atlassian\.net/)
	})

	it('returns ok:false on 401', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 'bad', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingReturning({ ok: false, status: 401 }))
		assert.equal(r.ok, false)
		assert.match(r.detail, /401/)
	})
})

describe('checkJira', () => {
	it('returns ok:true with skipped:true when jiraUrl is not configured', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const ping = async () => {
			throw new Error('ping must not be called when jiraUrl is unset')
		}
		const r = await checkJira(creds, ping)
		assert.equal(r.ok, true)
		assert.equal(r.skipped, true)
		assert.match(r.detail, /skipped/)
	})

	it('pings Jira when jiraUrl is configured and returns ok:true on 200', async () => {
		const creds = {
			url: 'https://example.atlassian.net',
			username: 'u',
			token: 't',
			jiraUrl: 'https://example.atlassian.net',
		}
		const r = await checkJira(creds, pingReturning({ ok: true, status: 200 }))
		assert.equal(r.ok, true)
	})

	it('returns ok:false when Jira responds with non-2xx', async () => {
		const creds = {
			url: 'https://example.atlassian.net',
			username: 'u',
			token: 't',
			jiraUrl: 'https://example.atlassian.net',
		}
		const r = await checkJira(creds, pingReturning({ ok: false, status: 403 }))
		assert.equal(r.ok, false)
		assert.match(r.detail, /403/)
	})
})
