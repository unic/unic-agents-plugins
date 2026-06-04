// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	AZ,
	checkAzCli,
	checkAzExtension,
	checkAzLogin,
	checkConfluence,
	checkJira,
	mapPingError,
	PING_TIMEOUT_MS,
	realPing,
	runDoctor,
} from '../scripts/doctor.mjs'

/** @import { Ping } from '../scripts/doctor.mjs' */
/** @import { Exec } from '../scripts/lib/exec.mjs' */

/**
 * @param {{ok?: boolean, stdout?: string, stderr?: string}} r
 * @returns {Exec}
 */
const execReturning = (r) => () => ({ ok: r.ok ?? true, stdout: r.stdout ?? '', stderr: r.stderr ?? '' })

/** @param {number} status @returns {Ping} */
const pingHttp = (status) => async () => ({ kind: 'http', status })

/** @param {string} error @returns {Ping} */
const pingError = (error) => async () => ({ kind: 'transport-error', error })

/** @type {Exec} */
const allOkExec = (_cmd, args) => {
	if (args.includes('extension')) {
		return { ok: true, stdout: JSON.stringify([{ name: 'azure-devops', version: '0.26.0' }]), stderr: '' }
	}
	return { ok: true, stdout: '[]', stderr: '' }
}

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

	it('returns ok:false when extension list command exits non-zero', () => {
		const exec = execReturning({ ok: false, stderr: 'permission denied' })
		assert.equal(checkAzExtension(exec).ok, false)
	})

	it('returns ok:false when extension list returns a non-array', () => {
		const exec = execReturning({ ok: true, stdout: JSON.stringify({ extensions: [] }) })
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

describe('checkConfluence', () => {
	it('returns ok:true on 200', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(200))
		assert.equal(r.ok, true)
		assert.match(r.detail, /example\.atlassian\.net/)
	})

	it('returns ok:false on 401', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 'bad', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(401))
		assert.equal(r.ok, false)
		assert.match(r.detail, /401/)
	})

	it('returns ok:true on 299 (inclusive upper bound of 2xx)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(299))
		assert.equal(r.ok, true)
	})

	it('returns ok:false on 199 (just below 2xx)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(199))
		assert.equal(r.ok, false)
		assert.match(r.detail, /199/)
	})

	it('returns ok:false on 300 (just above 2xx)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingHttp(300))
		assert.equal(r.ok, false)
		assert.match(r.detail, /300/)
	})

	it('returns ok:false when Confluence is unreachable (transport-error)', async () => {
		const creds = { url: 'https://example.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }
		const r = await checkConfluence(creds, pingError('ECONNREFUSED'))
		assert.equal(r.ok, false)
		assert.match(r.detail, /ECONNREFUSED/)
	})

	it('strips a trailing slash and pings the Confluence space endpoint with Basic auth', async () => {
		const creds = { url: 'https://example.atlassian.net/', username: 'u', token: 't', jiraUrl: undefined }
		/** @type {{ url?: string, headers?: Record<string, string> }} */
		const captured = {}
		/** @type {Ping} */
		const ping = async (url, headers) => {
			captured.url = url
			captured.headers = headers
			return { kind: 'http', status: 200 }
		}
		await checkConfluence(creds, ping)
		assert.equal(captured.url, 'https://example.atlassian.net/wiki/rest/api/space?limit=1')
		assert.match(captured.headers?.Authorization ?? '', /^Basic /)
		assert.equal(captured.headers?.Accept, 'application/json')
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
		const r = await checkJira(creds, pingHttp(200))
		assert.equal(r.ok, true)
	})

	it('returns ok:false when Jira responds with non-2xx', async () => {
		const creds = {
			url: 'https://example.atlassian.net',
			username: 'u',
			token: 't',
			jiraUrl: 'https://example.atlassian.net',
		}
		const r = await checkJira(creds, pingHttp(403))
		assert.equal(r.ok, false)
		assert.match(r.detail, /403/)
	})

	it('returns ok:false when Jira is unreachable (transport-error)', async () => {
		const creds = {
			url: 'https://example.atlassian.net',
			username: 'u',
			token: 't',
			jiraUrl: 'https://jira.atlassian.net',
		}
		const r = await checkJira(creds, pingError('ETIMEDOUT'))
		assert.equal(r.ok, false)
		assert.match(r.detail, /ETIMEDOUT/)
	})

	it('strips a trailing slash and pings the Jira /myself endpoint with Basic auth', async () => {
		const creds = {
			url: 'https://example.atlassian.net',
			username: 'u',
			token: 't',
			jiraUrl: 'https://jira.atlassian.net/',
		}
		/** @type {{ url?: string, headers?: Record<string, string> }} */
		const captured = {}
		/** @type {Ping} */
		const ping = async (url, headers) => {
			captured.url = url
			captured.headers = headers
			return { kind: 'http', status: 200 }
		}
		await checkJira(creds, ping)
		assert.equal(captured.url, 'https://jira.atlassian.net/rest/api/3/myself')
		assert.match(captured.headers?.Authorization ?? '', /^Basic /)
		assert.equal(captured.headers?.Accept, 'application/json')
	})
})

describe('runDoctor — Jira silence (US-35)', () => {
	it('emits no Jira line when jiraUrl is not configured', async () => {
		const { ok, output } = await runDoctor({
			exec: allOkExec,
			ping: pingHttp(200),
			loadCreds: () => ({
				url: 'https://example.atlassian.net',
				username: 'u',
				token: 't',
				jiraUrl: undefined,
			}),
		})
		assert.equal(ok, true)
		assert.doesNotMatch(output, /Jira/)
		assert.doesNotMatch(output, /skipped/)
		assert.match(output, /Confluence reachable/)
		assert.match(output, /All checks passed/)
	})

	it('emits a Jira line when jiraUrl is configured', async () => {
		const { output } = await runDoctor({
			exec: allOkExec,
			ping: pingHttp(200),
			loadCreds: () => ({
				url: 'https://example.atlassian.net',
				username: 'u',
				token: 't',
				jiraUrl: 'https://jira.atlassian.net',
			}),
		})
		assert.match(output, /Jira reachable/)
	})
})

describe('runDoctor — waterfall short-circuits', () => {
	it('skips extension/login when az CLI is missing', async () => {
		const { ok, output } = await runDoctor({
			exec: execReturning({ ok: false }),
			ping: pingHttp(200),
			loadCreds: () => ({ url: 'https://x.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }),
		})
		assert.equal(ok, false)
		assert.doesNotMatch(output, /azure-devops extension/)
		assert.doesNotMatch(output, /az devops session/)
	})

	it('skips login when extension is missing', async () => {
		/** @type {Exec} */
		const exec = (_cmd, args) => {
			if (args.includes('--version')) return { ok: true, stdout: 'azure-cli 2.60.0', stderr: '' }
			if (args.includes('extension')) return { ok: true, stdout: JSON.stringify([]), stderr: '' }
			return { ok: true, stdout: '[]', stderr: '' }
		}
		const { output } = await runDoctor({
			exec,
			ping: pingHttp(200),
			loadCreds: () => ({ url: 'https://x.atlassian.net', username: 'u', token: 't', jiraUrl: undefined }),
		})
		assert.doesNotMatch(output, /az devops session/)
	})
})

describe('realPing', () => {
	it('resolves to a transport-error when given a malformed URL', async () => {
		const r = await realPing('not-a-valid-url', {})
		assert.equal(r.kind, 'transport-error')
		if (r.kind === 'transport-error') assert.ok(r.error.length > 0)
	})
})

describe('mapPingError', () => {
	it('maps AbortSignal TimeoutError to a friendly fixed message', () => {
		const err = new Error('aborted')
		err.name = 'TimeoutError'
		assert.equal(mapPingError(err), `Request timed out after ${PING_TIMEOUT_MS / 1000}s`)
	})

	it('uses the error message for non-timeout Errors', () => {
		assert.equal(mapPingError(new Error('ECONNREFUSED')), 'ECONNREFUSED')
	})

	it('stringifies non-Error rejections', () => {
		assert.equal(mapPingError('boom'), 'boom')
	})
})

describe('AZ binary selector', () => {
	it('uses az.cmd on Windows and az elsewhere', () => {
		const expected = process.platform === 'win32' ? 'az.cmd' : 'az'
		assert.equal(AZ, expected)
	})
})

describe('runDoctor — credential errors', () => {
	it('reports missing credentials and returns ok:false when loadCreds returns null', async () => {
		const { ok, output } = await runDoctor({
			exec: allOkExec,
			ping: pingHttp(200),
			loadCreds: () => null,
		})
		assert.equal(ok, false)
		assert.match(output, /Atlassian credentials/)
		assert.match(output, /One or more checks failed/)
		assert.doesNotMatch(output, /Confluence/)
		assert.doesNotMatch(output, /Jira/)
	})

	it('reports unreadable credential file and returns ok:false when loadCreds throws', async () => {
		const { ok, output } = await runDoctor({
			exec: allOkExec,
			ping: pingHttp(200),
			loadCreds: () => {
				throw new Error('~/.unic-confluence.json contains invalid JSON: Unexpected token')
			},
		})
		assert.equal(ok, false)
		assert.match(output, /credential file unreadable/)
		assert.match(output, /invalid JSON/)
		assert.match(output, /One or more checks failed/)
		assert.doesNotMatch(output, /Confluence/)
		assert.doesNotMatch(output, /Jira/)
	})
})
