// @ts-check

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
	checkAzCli,
	checkAzDevopsLogin,
	checkAzDevopsUserShow,
	checkAzureDevopsExtension,
	checkConfluenceReachable,
	checkJiraReachable,
	runDoctor,
} from '../scripts/doctor.mjs'

/** @type {import('../scripts/doctor.mjs').SpawnFn} */
const okSpawn = () => ({ status: 0 })
/** @type {import('../scripts/doctor.mjs').SpawnFn} */
const failSpawn = () => ({ status: 1 })

/** @type {import('../scripts/doctor.mjs').PingFn} */
const okPing = async () => ({ ok: true, status: 200 })
/** @type {import('../scripts/doctor.mjs').PingFn} */
const failPing = async () => ({ ok: false })

// ── checkAzCli ─────────────────────────────────────────────────────────────────

test('checkAzCli returns true when az exits 0', () => {
	assert.equal(checkAzCli(okSpawn), true)
})

test('checkAzCli returns false when az exits non-zero', () => {
	assert.equal(checkAzCli(failSpawn), false)
})

// ── checkAzureDevopsExtension ──────────────────────────────────────────────────

test('checkAzureDevopsExtension returns true when extension present', () => {
	assert.equal(checkAzureDevopsExtension(okSpawn), true)
})

test('checkAzureDevopsExtension returns false when extension absent', () => {
	assert.equal(checkAzureDevopsExtension(failSpawn), false)
})

// ── checkAzDevopsLogin ─────────────────────────────────────────────────────────

test('checkAzDevopsLogin returns true when account show succeeds', () => {
	assert.equal(checkAzDevopsLogin(okSpawn), true)
})

test('checkAzDevopsLogin returns false when account show fails', () => {
	assert.equal(checkAzDevopsLogin(failSpawn), false)
})

// ── checkAzDevopsUserShow ─────────────────────────────────────────────────────

test('checkAzDevopsUserShow returns true when user show succeeds', () => {
	assert.equal(checkAzDevopsUserShow(okSpawn), true)
})

test('checkAzDevopsUserShow returns false when user show fails', () => {
	assert.equal(checkAzDevopsUserShow(failSpawn), false)
})

// ── checkConfluenceReachable ──────────────────────────────────────────────────

test('checkConfluenceReachable returns true when ping ok', async () => {
	assert.equal(await checkConfluenceReachable(okPing, 'https://example.atlassian.net'), true)
})

test('checkConfluenceReachable returns false when ping fails', async () => {
	assert.equal(await checkConfluenceReachable(failPing, 'https://example.atlassian.net'), false)
})

// ── checkJiraReachable ────────────────────────────────────────────────────────

test('checkJiraReachable returns true silently when jiraUrl is null', async () => {
	assert.equal(await checkJiraReachable(failPing, null), true)
})

test('checkJiraReachable returns true when jira is reachable', async () => {
	assert.equal(await checkJiraReachable(okPing, 'https://example.atlassian.net'), true)
})

test('checkJiraReachable returns false when jira is configured but unreachable', async () => {
	assert.equal(await checkJiraReachable(failPing, 'https://example.atlassian.net'), false)
})

// ── runDoctor integration ──────────────────────────────────────────────────────

test('runDoctor returns true when all checks pass', async () => {
	const result = await runDoctor({
		spawn: okSpawn,
		ping: okPing,
		loadCreds: () => ({
			confluence: { url: 'https://example.atlassian.net', username: 'u', token: 't' },
			azure: { orgUrl: 'https://dev.azure.com/org', pat: 'p' },
			jira: null,
		}),
	})
	assert.equal(result, true)
})

test('runDoctor returns false when az CLI missing', async () => {
	const result = await runDoctor({
		spawn: failSpawn,
		ping: okPing,
		loadCreds: () => ({
			confluence: { url: 'https://example.atlassian.net', username: 'u', token: 't' },
			azure: { orgUrl: 'https://dev.azure.com/org', pat: 'p' },
			jira: null,
		}),
	})
	assert.equal(result, false)
})

test('runDoctor returns false when Confluence credentials missing', async () => {
	const result = await runDoctor({
		spawn: okSpawn,
		ping: okPing,
		loadCreds: () => ({ confluence: null, azure: null, jira: null }),
	})
	assert.equal(result, false)
})

test('runDoctor returns true and Jira is silent when jira not configured', async () => {
	const result = await runDoctor({
		spawn: okSpawn,
		ping: okPing,
		loadCreds: () => ({
			confluence: { url: 'https://example.atlassian.net', username: 'u', token: 't' },
			azure: null,
			jira: null,
		}),
	})
	assert.equal(result, true)
})

test('runDoctor returns false when Jira is configured but unreachable', async () => {
	const result = await runDoctor({
		spawn: okSpawn,
		ping: failPing,
		loadCreds: () => ({
			confluence: { url: 'https://example.atlassian.net', username: 'u', token: 't' },
			azure: null,
			jira: { url: 'https://example.atlassian.net' },
		}),
	})
	assert.equal(result, false)
})
