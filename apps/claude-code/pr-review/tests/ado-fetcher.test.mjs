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

	it('fetches PR threads via az devops invoke --resource pullRequestThreads', () => {
		assert.ok(
			/az devops invoke[\s\S]*?--resource pullRequestThreads/.test(agentContent),
			'Fetcher must call az devops invoke with --resource pullRequestThreads (folded in from orchestrator)'
		)
	})

	it('invokes the detectMode helper from scripts/mode-detection.mjs', () => {
		assert.ok(
			agentContent.includes('detectMode') && agentContent.includes('mode-detection'),
			'Fetcher must invoke detectMode from scripts/mode-detection.mjs after fetching threads'
		)
	})

	it('does not call az repos pr show — metadata is now passed in from the orchestrator', () => {
		assert.ok(
			!/az repos pr show/.test(agentContent),
			'Fetcher must accept REPO_ID/PROJECT/branches/title/description as inputs, not call `az repos pr show` itself'
		)
	})

	it('accepts REPO_ID, PROJECT, branch refs, PR_TITLE and PR_DESCRIPTION as literal-string inputs', () => {
		const requiredInputs = ['REPO_ID', 'SOURCE_BRANCH', 'TARGET_BRANCH', 'PR_TITLE', 'PR_DESCRIPTION']
		const inputsSection = agentContent.split('## Inputs')[1] ?? ''
		for (const field of requiredInputs) {
			assert.ok(inputsSection.includes(field), `Inputs section must list ${field}`)
		}
	})

	it('emits RAW_THREADS_JSON, MODE, IS_REREVIEW, PRIOR_ITERATION_ID, SUMMARY_THREAD_ID in the result block', () => {
		const required = ['RAW_THREADS_JSON', 'MODE', 'IS_REREVIEW', 'PRIOR_ITERATION_ID', 'SUMMARY_THREAD_ID']
		const blockMatch = agentContent.match(/ADO_FETCHER_RESULT_START\r?\n([\s\S]*?)\r?\nADO_FETCHER_RESULT_END/)
		assert.ok(blockMatch, 'Fetcher must contain an ADO_FETCHER_RESULT_START/END block')
		const block = blockMatch[1]
		for (const field of required) {
			assert.ok(block.includes(field), `Result block must emit ${field} between ADO_FETCHER_RESULT_START and _END`)
		}
	})

	it('aborts with `az devops login` hint when threads endpoint returns 401/403', () => {
		assert.ok(
			/thread.*?(401|403|auth)[\s\S]*?az devops login/i.test(agentContent) ||
				/(401|403|auth)[\s\S]*?az devops login[\s\S]*?thread/i.test(agentContent),
			'Fetcher must abort on threads 401/403 with an az devops login hint'
		)
	})

	it('treats 404 on the threads endpoint as empty threads (value:[])', () => {
		assert.ok(
			/404[\s\S]*?\{"value":\s*\[\]\}/.test(agentContent) || /\{"value":\s*\[\]\}[\s\S]*?404/.test(agentContent),
			'Fetcher must treat 404 on threads as RAW_THREADS_JSON={"value":[]}'
		)
	})

	it('emits a warning Notice with kind: thread-fetch on 5xx / network failure', () => {
		assert.ok(
			agentContent.includes('thread-fetch'),
			'Fetcher must emit a warning Notice with kind: thread-fetch on 5xx / network on the threads endpoint'
		)
	})

	it('applies HTTP-tier classification via classify-http-error helper', () => {
		assert.ok(
			agentContent.includes('classify-http-error') || agentContent.includes('classifyHttpError'),
			'Fetcher must use the classifyHttpError helper from scripts/ado/classify-http-error.mjs for the threads endpoint'
		)
	})
})
