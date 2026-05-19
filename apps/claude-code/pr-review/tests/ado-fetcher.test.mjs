// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/** Reads the ado-fetcher agent markdown for content assertions */
const agentContent = readFileSync(new URL('../agents/ado-fetcher.md', import.meta.url), 'utf8')

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
			'DIFF_RANGE',
			'WORK_ITEM_IDS',
			'CHANGED_FILES',
			'RAW_DIFF',
		]
		for (const field of requiredFields) {
			assert.ok(agentContent.includes(field), `Missing required output field: ${field}`)
		}
	})

	it('emits DIFF_RANGE=incremental on successful incremental diff and DIFF_RANGE=full on fallback', () => {
		assert.ok(agentContent.includes('DIFF_RANGE=incremental'), 'Missing DIFF_RANGE=incremental assignment')
		assert.ok(agentContent.includes('DIFF_RANGE=full'), 'Missing DIFF_RANGE=full assignment')
	})

	it('sets DIFF_RANGE_FALLBACK=true when prior commit is unreachable', () => {
		assert.ok(
			agentContent.includes('DIFF_RANGE_FALLBACK=true'),
			'Fallback branch must set DIFF_RANGE_FALLBACK=true so Step 6 can emit the diff-range Notice'
		)
	})

	it('emits a warning diff-range Notice when DIFF_RANGE_FALLBACK is set', () => {
		assert.ok(
			agentContent.includes('diff-range'),
			'Step 6 must check DIFF_RANGE_FALLBACK and emit a warning Notice with kind: diff-range'
		)
		assert.ok(
			agentContent.includes('DIFF_RANGE_FB') || agentContent.includes('DIFF_RANGE_FALLBACK'),
			'Step 6 must pass the fallback flag into the Notice-building script'
		)
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
