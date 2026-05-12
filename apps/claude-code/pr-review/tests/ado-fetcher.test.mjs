// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { parseIterations, parseWorkItemIds } from '../scripts/ado-fetcher.mjs'

/** Reads the ado-fetcher agent markdown for content assertions */
const agentContent = readFileSync(
	new URL('../.agents/ado-fetcher.md', import.meta.url),
	'utf8',
)

describe('ado-fetcher agent content', () => {
	it('contains no ADO write HTTP methods (POST/PATCH/DELETE)', () => {
		// Allow POST only in comments/explanatory text preceded by 'no' or 'Never'
		// The guard: strip lines that are clearly explanatory (contain "Never" or "no write")
		const lines = agentContent.split('\n')
		const suspectLines = lines.filter((line) => {
			const trimmed = line.trim()
			// Skip comment lines and the "Never add" instruction line itself
			if (trimmed.startsWith('#')) return false
			if (trimmed.toLowerCase().includes('never add')) return false
			if (trimmed.toLowerCase().includes('no write')) return false
			// Flag --http-method POST/PATCH/DELETE
			return /--http-method\s+(POST|PATCH|DELETE)/i.test(trimmed)
		})
		assert.deepEqual(
			suspectLines,
			[],
			`Agent contains write operations: ${suspectLines.join(' | ')}`,
		)
	})

	it('declares allowed-tools in frontmatter', () => {
		assert.ok(agentContent.startsWith('---'), 'Missing YAML frontmatter')
		assert.ok(agentContent.includes('allowed-tools:'), 'Missing allowed-tools key')
	})

	it('outputs a structured context block with required fields', () => {
		const requiredFields = [
			'ADO_FETCHER_RESULT_START',
			'ADO_FETCHER_RESULT_END',
			'REPO_ID',
			'PR_TITLE',
			'LATEST_ITERATION_ID',
			'LATEST_COMMIT_SHA',
			'WORK_ITEM_IDS',
			'CHANGED_FILES',
			'RAW_DIFF',
		]
		for (const field of requiredFields) {
			assert.ok(agentContent.includes(field), `Missing required output field: ${field}`)
		}
	})

	it('documents graceful handling of zero-iteration PRs', () => {
		assert.ok(
			agentContent.includes('no iterations returned') ||
				agentContent.includes('zero-iteration') ||
				agentContent.includes('defaulting to iteration 1'),
			'Agent must document zero-iteration fallback behaviour',
		)
	})

	it('documents that merged PRs are handled without error', () => {
		assert.ok(
			agentContent.includes('already merged') ||
				agentContent.includes('mergeStatus') ||
				agentContent.includes('continue without error'),
			'Agent must document handling of already-merged PRs',
		)
	})

	it('invokes the parseIterations helper from ado-fetcher.mjs', () => {
		assert.ok(
			agentContent.includes('parseIterations'),
			'Agent must delegate iteration parsing to parseIterations helper',
		)
	})

	it('invokes the parseWorkItemIds helper from ado-fetcher.mjs', () => {
		assert.ok(
			agentContent.includes('parseWorkItemIds'),
			'Agent must delegate work-item ID parsing to parseWorkItemIds helper',
		)
	})
})

describe('parseIterations', () => {
	it('zero iterations → defaults to id=1, commitSha=""', () => {
		const result = parseIterations([])
		assert.equal(result.latestIterationId, 1)
		assert.equal(result.latestCommitSha, '')
	})

	it('single iteration → returns its id and commit SHA', () => {
		const iterations = [
			{ id: 1, sourceRefCommit: { commitId: 'abc123' } },
		]
		const result = parseIterations(iterations)
		assert.equal(result.latestIterationId, 1)
		assert.equal(result.latestCommitSha, 'abc123')
	})

	it('multiple iterations → returns the max id and its commit SHA', () => {
		const iterations = [
			{ id: 1, sourceRefCommit: { commitId: 'aaa' } },
			{ id: 3, sourceRefCommit: { commitId: 'ccc' } },
			{ id: 2, sourceRefCommit: { commitId: 'bbb' } },
		]
		const result = parseIterations(iterations)
		assert.equal(result.latestIterationId, 3)
		assert.equal(result.latestCommitSha, 'ccc')
	})

	it('iteration with null sourceRefCommit → commitSha defaults to ""', () => {
		const iterations = [{ id: 2, sourceRefCommit: null }]
		const result = parseIterations(iterations)
		assert.equal(result.latestIterationId, 2)
		assert.equal(result.latestCommitSha, '')
	})

	it('iteration with missing commitId field → commitSha defaults to ""', () => {
		const iterations = [{ id: 4, sourceRefCommit: {} }]
		const result = parseIterations(iterations)
		assert.equal(result.latestIterationId, 4)
		assert.equal(result.latestCommitSha, '')
	})
})

describe('parseWorkItemIds', () => {
	it('no work items linked → returns empty array', () => {
		const result = parseWorkItemIds({ value: [] })
		assert.deepEqual(result, [])
	})

	it('work items present → returns array of numeric IDs', () => {
		const result = parseWorkItemIds({ value: [{ id: 42 }, { id: 7 }] })
		assert.deepEqual(result, [42, 7])
	})

	it('null response (command failed) → returns empty array', () => {
		const result = parseWorkItemIds(null)
		assert.deepEqual(result, [])
	})

	it('response with no value key → returns empty array', () => {
		const result = parseWorkItemIds({})
		assert.deepEqual(result, [])
	})
})
