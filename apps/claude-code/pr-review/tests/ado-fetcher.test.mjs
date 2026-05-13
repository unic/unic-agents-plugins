// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/** Reads the ado-fetcher agent markdown for content assertions */
const agentContent = readFileSync(new URL('../.agents/ado-fetcher.md', import.meta.url), 'utf8')

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
		assert.deepEqual(suspectLines, [], `Agent contains write operations: ${suspectLines.join(' | ')}`)
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

	it('aborts on empty iterations (no iterationId=1 default)', () => {
		assert.ok(
			!agentContent.includes('defaulting to iteration 1') && !agentContent.includes('iterationId=1'),
			'Agent must not fall back to iterationId=1 — empty iterations must abort the run'
		)
		assert.ok(
			agentContent.includes('empty-iterations') ||
				agentContent.includes('fetch-iterations') ||
				agentContent.includes('fetchIterations'),
			'Agent must delegate iteration parsing to fetchIterations helper'
		)
	})

	it('documents that merged PRs are handled without error', () => {
		assert.ok(
			agentContent.includes('already merged') ||
				agentContent.includes('mergeStatus') ||
				agentContent.includes('continue without error'),
			'Agent must document handling of already-merged PRs'
		)
	})

	it('invokes the fetchIterations helper from scripts/ado/fetch-iterations.mjs', () => {
		assert.ok(
			agentContent.includes('fetchIterations') || agentContent.includes('fetch-iterations'),
			'Agent must delegate iteration parsing to fetchIterations helper'
		)
	})

	it('invokes the fetchWorkItems helper from scripts/ado/fetch-work-items.mjs', () => {
		assert.ok(
			agentContent.includes('fetchWorkItems') || agentContent.includes('fetch-work-items'),
			'Agent must delegate work-item fetching to fetchWorkItems helper'
		)
	})
})
