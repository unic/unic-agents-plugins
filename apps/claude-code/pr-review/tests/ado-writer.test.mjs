// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { parseAdoWriterResult } from '../scripts/ado-writer.mjs'

/** Reads the ado-writer agent markdown for content assertions */
const agentContent = readFileSync(new URL('../.agents/ado-writer.md', import.meta.url), 'utf8')

describe('ado-writer agent content', () => {
	it('declares allowed-tools in frontmatter', () => {
		assert.ok(agentContent.startsWith('---'), 'Missing YAML frontmatter')
		assert.ok(agentContent.includes('allowed-tools:'), 'Missing allowed-tools key')
	})

	it('contains no ADO read-only operations (GET)', () => {
		const lines = agentContent.split('\n')
		const suspectLines = lines.filter((line) => {
			const trimmed = line.trim()
			if (trimmed.startsWith('#')) return false
			return /--http-method\s+GET/i.test(trimmed)
		})
		assert.deepEqual(
			suspectLines,
			[],
			`Agent contains GET operations (reads should stay in ado-fetcher): ${suspectLines.join(' | ')}`
		)
	})

	it('accepts all required input fields', () => {
		const requiredInputs = [
			'ORG_URL',
			'PROJECT',
			'REPO_ID',
			'PR_ID',
			'LATEST_ITERATION_ID',
			'SUMMARY_THREAD_ID',
			'MODE',
		]
		for (const field of requiredInputs) {
			assert.ok(agentContent.includes(field), `Missing required input field: ${field}`)
		}
	})

	it('accepts a findings list with the compact finding schema', () => {
		const requiredFindingFields = ['severity', 'filePath', 'startLine', 'endLine', 'title', 'body']
		for (const field of requiredFindingFields) {
			assert.ok(agentContent.includes(field), `Missing compact finding field: ${field}`)
		}
	})

	it('posts inline comment threads using POST to pullRequestThreads', () => {
		assert.ok(
			agentContent.includes('pullRequestThreads') && agentContent.includes('--http-method POST'),
			'Agent must POST to pullRequestThreads for inline comments'
		)
	})

	it('includes threadContext with filePath and line range in inline comments', () => {
		assert.ok(agentContent.includes('threadContext'), 'Agent must use threadContext for inline comments')
		assert.ok(agentContent.includes('rightFileStart'), 'Agent must set rightFileStart in threadContext')
		assert.ok(agentContent.includes('rightFileEnd'), 'Agent must set rightFileEnd in threadContext')
	})

	it('appends canonical Bot Signature to every comment', () => {
		assert.ok(agentContent.includes('🤖 *Reviewed by Claude Code*'), 'Agent must include the canonical Bot Signature')
		assert.ok(agentContent.includes('LATEST_ITERATION_ID'), 'Agent must include LATEST_ITERATION_ID in the signature')
	})

	it('posts full Review Summary on first-review mode', () => {
		assert.ok(
			agentContent.includes('first-review') ||
				agentContent.includes('first_review') ||
				agentContent.includes('IS_REREVIEW=false'),
			'Agent must handle first-review mode'
		)
		assert.ok(agentContent.includes('PR Review Summary'), 'Agent must post PR Review Summary on first-review')
	})

	it('posts delta reply to existing summary thread on re-review with findings', () => {
		assert.ok(
			agentContent.includes('re-review') || agentContent.includes('IS_REREVIEW=true'),
			'Agent must handle re-review mode'
		)
		assert.ok(
			agentContent.includes('pullRequestThreadComments'),
			'Agent must POST to pullRequestThreadComments for delta reply'
		)
	})

	it('skips summary reply on re-review with zero new findings', () => {
		assert.ok(
			agentContent.includes('zero') ||
				agentContent.includes('no new findings') ||
				agentContent.includes('FINDINGS_POSTED=0') ||
				agentContent.includes('nothing to report') ||
				agentContent.includes('skip'),
			'Agent must document skipping summary reply when there are no new findings'
		)
	})

	it('retries without threadContext on ADO rejection', () => {
		assert.ok(
			agentContent.includes('threadContext') &&
				(agentContent.includes('retry') ||
					agentContent.includes('without') ||
					agentContent.includes('fallback') ||
					agentContent.includes('fall back') ||
					agentContent.includes('general comment')),
			'Agent must retry without threadContext when ADO rejects the inline placement'
		)
	})

	it('posts completion marker as final action', () => {
		assert.ok(agentContent.includes('✅ Review complete'), 'Agent must post completion marker reply')
		assert.ok(
			agentContent.includes('completion marker') ||
				agentContent.includes('Completion marker') ||
				agentContent.includes('final action'),
			'Agent must document completion marker as final action'
		)
	})

	it('returns structured output block with SUMMARY_THREAD_ID and FINDINGS_POSTED', () => {
		const requiredOutputFields = [
			'ADO_WRITER_RESULT_START',
			'ADO_WRITER_RESULT_END',
			'SUMMARY_THREAD_ID',
			'FINDINGS_POSTED',
		]
		for (const field of requiredOutputFields) {
			assert.ok(agentContent.includes(field), `Missing required output field: ${field}`)
		}
	})

	it('invokes parseAdoWriterResult helper from ado-writer.mjs', () => {
		assert.ok(
			agentContent.includes('parseAdoWriterResult'),
			'Agent must delegate output parsing to parseAdoWriterResult helper'
		)
	})
})

describe('parseAdoWriterResult', () => {
	it('parses a valid result block into summaryThreadId and findingsPosted', () => {
		const output = `
ADO_WRITER_RESULT_START
SUMMARY_THREAD_ID: 42
FINDINGS_POSTED: 5
NOTICES: []
ADO_WRITER_RESULT_END
`.trim()
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, true)
		assert.equal(result.summaryThreadId, 42)
		assert.equal(result.findingsPosted, 5)
		assert.deepEqual(result.notices, [])
	})

	it('returns summaryThreadId=null when SUMMARY_THREAD_ID is empty', () => {
		const output = `
ADO_WRITER_RESULT_START
SUMMARY_THREAD_ID:
FINDINGS_POSTED: 0
NOTICES: []
ADO_WRITER_RESULT_END
`.trim()
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, true)
		assert.equal(result.summaryThreadId, null)
		assert.equal(result.findingsPosted, 0)
		assert.deepEqual(result.notices, [])
	})

	it('returns { ok: false, reason: "missing-block" } when no result block is present', () => {
		const result = parseAdoWriterResult('No result block here')
		assert.equal(result.ok, false)
		assert.equal(result.reason, 'missing-block')
	})

	it('returns { ok: false, reason: "malformed" } when block is present but FINDINGS_POSTED is absent', () => {
		const output = `ADO_WRITER_RESULT_START\nSUMMARY_THREAD_ID: 5\nNOTICES: []\nADO_WRITER_RESULT_END`
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, false)
		assert.equal(result.reason, 'malformed')
	})

	it('handles FINDINGS_POSTED=0 explicitly', () => {
		const output = `ADO_WRITER_RESULT_START\nSUMMARY_THREAD_ID: 7\nFINDINGS_POSTED: 0\nNOTICES: []\nADO_WRITER_RESULT_END`
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, true)
		assert.equal(result.summaryThreadId, 7)
		assert.equal(result.findingsPosted, 0)
	})

	it('handles output with extra content around the result block', () => {
		const output = [
			'Posting inline comments...',
			'ADO_WRITER_RESULT_START',
			'SUMMARY_THREAD_ID: 99',
			'FINDINGS_POSTED: 3',
			'NOTICES: []',
			'ADO_WRITER_RESULT_END',
			'Done.',
		].join('\n')
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, true)
		assert.equal(result.summaryThreadId, 99)
		assert.equal(result.findingsPosted, 3)
	})

	it('parses NOTICES array from result block', () => {
		const notices = [
			{
				severity: 'warning',
				kind: 'inline-post',
				message: 'Failed to post inline thread at /src/foo.ts:42 (HTTP 503).',
			},
		]
		const output = [
			'ADO_WRITER_RESULT_START',
			'SUMMARY_THREAD_ID: 10',
			'FINDINGS_POSTED: 2',
			`NOTICES: ${JSON.stringify(notices)}`,
			'ADO_WRITER_RESULT_END',
		].join('\n')
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, true)
		assert.deepEqual(result.notices, notices)
	})

	it('returns empty notices when NOTICES field is absent (legacy block)', () => {
		const output = `ADO_WRITER_RESULT_START\nSUMMARY_THREAD_ID: 5\nFINDINGS_POSTED: 1\nADO_WRITER_RESULT_END`
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, true)
		assert.deepEqual(result.notices, [])
	})

	it('returns empty notices when NOTICES field is malformed JSON', () => {
		const output = `ADO_WRITER_RESULT_START\nSUMMARY_THREAD_ID: 5\nFINDINGS_POSTED: 1\nNOTICES: [broken\nADO_WRITER_RESULT_END`
		const result = parseAdoWriterResult(output)
		assert.equal(result.ok, true)
		assert.deepEqual(result.notices, [])
	})
})

describe('ado-writer agent uses parse-write-response helper', () => {
	it('references parse-write-response.mjs in the agent prompt', () => {
		assert.ok(
			agentContent.includes('parse-write-response.mjs') || agentContent.includes('parseWriteResponse'),
			'Agent must delegate write-response parsing to parse-write-response helper'
		)
	})

	it('emits a NOTICES array in the result block', () => {
		assert.ok(agentContent.includes('NOTICES:'), 'Agent result block must include a NOTICES field')
	})

	it('initialises a NOTICES array before posting begins', () => {
		assert.ok(
			agentContent.includes('NOTICES=') ||
				agentContent.includes('NOTICES =(') ||
				agentContent.includes("NOTICES='[]'") ||
				agentContent.includes('NOTICES="[]"'),
			'Agent must initialise a NOTICES array before writing begins'
		)
	})
})
