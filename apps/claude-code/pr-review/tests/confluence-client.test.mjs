// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { extractPageId, loadCredentials } from '../scripts/confluence-client.mjs'

const TEMP_DIR = path.join(os.tmpdir(), `confluence-client-test-${process.pid}`)

describe('loadCredentials', () => {
	/** @type {{ CONFLUENCE_URL?: string, CONFLUENCE_USER?: string, CONFLUENCE_TOKEN?: string }} */
	let savedEnv = {}

	before(() => {
		mkdirSync(TEMP_DIR, { recursive: true })
	})

	after(() => {
		rmSync(TEMP_DIR, { recursive: true, force: true })
	})

	beforeEach(() => {
		savedEnv = {
			CONFLUENCE_URL: process.env.CONFLUENCE_URL,
			CONFLUENCE_USER: process.env.CONFLUENCE_USER,
			CONFLUENCE_TOKEN: process.env.CONFLUENCE_TOKEN,
		}
		delete process.env.CONFLUENCE_URL
		delete process.env.CONFLUENCE_USER
		delete process.env.CONFLUENCE_TOKEN
	})

	afterEach(() => {
		if (savedEnv.CONFLUENCE_URL !== undefined) process.env.CONFLUENCE_URL = savedEnv.CONFLUENCE_URL
		else delete process.env.CONFLUENCE_URL
		if (savedEnv.CONFLUENCE_USER !== undefined) process.env.CONFLUENCE_USER = savedEnv.CONFLUENCE_USER
		else delete process.env.CONFLUENCE_USER
		if (savedEnv.CONFLUENCE_TOKEN !== undefined) process.env.CONFLUENCE_TOKEN = savedEnv.CONFLUENCE_TOKEN
		else delete process.env.CONFLUENCE_TOKEN
	})

	it('returns credentials from env vars when all three are set', () => {
		process.env.CONFLUENCE_URL = 'https://example.atlassian.net'
		process.env.CONFLUENCE_USER = 'user@example.com'
		process.env.CONFLUENCE_TOKEN = 'mytoken'
		const creds = loadCredentials('/nonexistent/path.json')
		assert.deepEqual(creds, {
			url: 'https://example.atlassian.net',
			username: 'user@example.com',
			token: 'mytoken',
		})
	})

	it('falls back to JSON file when env vars are absent', () => {
		const credFile = path.join(TEMP_DIR, 'creds.json')
		writeFileSync(
			credFile,
			JSON.stringify({ url: 'https://file.atlassian.net', username: 'fileuser', token: 'filetoken' })
		)
		const creds = loadCredentials(credFile)
		assert.deepEqual(creds, {
			url: 'https://file.atlassian.net',
			username: 'fileuser',
			token: 'filetoken',
		})
	})

	it('throws when env vars absent and file does not exist', () => {
		assert.throws(() => loadCredentials('/nonexistent/path.json'), /CONFLUENCE_URL|credentials|configure/i)
	})

	it('throws when file exists but is missing required fields', () => {
		const credFile = path.join(TEMP_DIR, 'partial.json')
		writeFileSync(credFile, JSON.stringify({ url: 'https://example.atlassian.net' }))
		assert.throws(() => loadCredentials(credFile), /CONFLUENCE_URL|credentials|configure/i)
	})

	it('throws when file contains invalid JSON', () => {
		const credFile = path.join(TEMP_DIR, 'bad.json')
		writeFileSync(credFile, 'not-json')
		assert.throws(() => loadCredentials(credFile), /CONFLUENCE_URL|credentials|configure/i)
	})
})

describe('extractPageId', () => {
	it('extracts numeric ID from /pages/{id}/ path with trailing slash', () => {
		assert.equal(extractPageId('https://example.atlassian.net/wiki/spaces/PROJ/pages/12345678/Page-Title'), '12345678')
	})

	it('extracts numeric ID from /pages/{id} without trailing path', () => {
		assert.equal(extractPageId('https://example.atlassian.net/wiki/spaces/PROJ/pages/87654321'), '87654321')
	})

	it('extracts numeric ID when URL ends with /', () => {
		assert.equal(extractPageId('https://example.atlassian.net/wiki/spaces/PROJ/pages/99999/'), '99999')
	})

	it('throws on URL with no /pages/ segment', () => {
		assert.throws(() => extractPageId('https://example.atlassian.net/wiki/spaces/PROJ'), /page.*id|url/i)
	})

	it('throws when /pages/ is followed by non-numeric segment', () => {
		assert.throws(() => extractPageId('https://example.atlassian.net/wiki/spaces/PROJ/pages/create'), /page.*id|url/i)
	})
})
