// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/render-summary.mjs', import.meta.url))

/**
 * Run render-summary.mjs in a child process with the given FINDINGS_JSON,
 * optional INTENT_CHECK_JSON, NOTICES_JSON, and optional ITERATION.
 *
 * @param {string | undefined} findingsJson
 * @param {string} [intentCheckJson]
 * @param {string} [noticesJson]
 * @param {number} [iteration]
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function run(findingsJson, intentCheckJson, noticesJson, iteration) {
	const env = { ...process.env }
	if (findingsJson === undefined) delete env.FINDINGS_JSON
	else env.FINDINGS_JSON = findingsJson
	if (intentCheckJson === undefined) delete env.INTENT_CHECK_JSON
	else env.INTENT_CHECK_JSON = intentCheckJson
	if (noticesJson === undefined) delete env.NOTICES_JSON
	else env.NOTICES_JSON = noticesJson
	if (iteration === undefined) delete env.ITERATION
	else env.ITERATION = String(iteration)
	const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env })
	return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

describe('render-summary CLI', () => {
	it('exits 1 with a stderr message when FINDINGS_JSON is missing', () => {
		const r = run(undefined)
		assert.equal(r.status, 1)
		assert.match(r.stderr, /FINDINGS_JSON environment variable is required/)
		assert.equal(r.stdout, '')
	})

	it('exits 1 with a stderr message when FINDINGS_JSON is not valid JSON', () => {
		const r = run('{not json}')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /not valid JSON/)
		assert.equal(r.stdout, '')
	})

	it('exits 1 when FINDINGS_JSON is not an object', () => {
		const r = run('"a string"')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /must be an object/)
		assert.equal(r.stdout, '')
	})

	it('renders an empty summary when findings and positiveObservations are absent', () => {
		const r = run('{}')
		assert.equal(r.status, 0)
		assert.match(r.stdout, /### ✅ What's good/)
		assert.match(r.stdout, /🤖 Reviewed by Claude Code — Iteration 1/)
	})

	it('renders findings from a well-formed payload', () => {
		const payload = {
			findings: [
				{
					confidence: 95,
					filePath: 'src/index.mjs',
					startLine: 42,
					title: 'Null pointer possible',
					body: 'Input may be undefined.',
				},
			],
			positiveObservations: ['Good error handling overall'],
		}
		const r = run(JSON.stringify(payload))
		assert.equal(r.status, 0)
		assert.match(r.stdout, /### 🔴 Critical \(1 found\)/)
		assert.match(r.stdout, /\*\*\[src\/index\.mjs:42\]\*\* Null pointer possible/)
		assert.match(r.stdout, /- Good error handling overall/)
	})

	it('drops malformed Findings and reports them on stderr (exit 0)', () => {
		const payload = {
			findings: [
				// valid
				{
					confidence: 90,
					filePath: 'src/a.mjs',
					startLine: 1,
					title: 'Good',
					body: 'reason',
				},
				// malformed — missing filePath
				{ confidence: 90, startLine: 2, title: 'Bad', body: 'reason' },
			],
		}
		const r = run(JSON.stringify(payload))
		assert.equal(r.status, 0, `Expected exit 0 with stderr; got status=${r.status} stderr=${r.stderr}`)
		assert.match(r.stderr, /dropped malformed Finding/)
		assert.match(r.stdout, /\*\*\[src\/a\.mjs:1\]\*\* Good/)
		assert.doesNotMatch(r.stdout, /Bad/)
	})

	it('drops sub-threshold confidence Findings silently (no stderr)', () => {
		const payload = {
			findings: [{ confidence: 50, filePath: 'src/x.mjs', startLine: 1, title: 'Low', body: 'low' }],
		}
		const r = run(JSON.stringify(payload))
		assert.equal(r.status, 0)
		assert.equal(r.stderr, '')
		assert.doesNotMatch(r.stdout, /Low/)
	})

	it('treats non-array findings as empty and still renders', () => {
		const r = run('{"findings":"not an array"}')
		assert.equal(r.status, 0)
		assert.match(r.stdout, /### ✅ What's good/)
	})
})

describe('render-summary CLI — INTENT_CHECK_JSON', () => {
	it('renders the Intent Check block above the Severity sections', () => {
		const intentCheck = JSON.stringify([
			{ id: 'PROJ-42', title: 'Login feature', verdicts: { 'AC 1': 'unaddressed', 'AC 2': 'addressed' } },
		])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stdout, /### Intent Check/)
		assert.match(r.stdout, /\*\*Login feature \(PROJ-42\)\*\*/)
		assert.match(r.stdout, /AC 1: unaddressed/)
		// Intent Check must precede the "What's good" section.
		assert.ok(r.stdout.indexOf('### Intent Check') < r.stdout.indexOf("### ✅ What's good"))
	})

	it('omits the Intent Check block when INTENT_CHECK_JSON is absent (AC-6)', () => {
		const r = run('{}')
		assert.equal(r.status, 0)
		assert.doesNotMatch(r.stdout, /### Intent Check/)
	})

	it('omits the Intent Check block when INTENT_CHECK_JSON is an empty array', () => {
		const r = run('{}', '[]')
		assert.equal(r.status, 0)
		assert.doesNotMatch(r.stdout, /### Intent Check/)
	})

	it('drops malformed IntentCheckItems and reports them on stderr (exit 0)', () => {
		const intentCheck = JSON.stringify([
			{ id: 'PROJ-1', title: 'Valid', verdicts: { 'AC 1': 'addressed' } },
			{ id: 'PROJ-2' }, // malformed — missing title and verdicts
		])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stderr, /dropped malformed IntentCheckItem/)
		assert.match(r.stdout, /\*\*Valid \(PROJ-1\)\*\*/)
		assert.doesNotMatch(r.stdout, /PROJ-2/)
	})

	it('drops an IntentCheckItem whose verdicts is null without crashing (exit 0)', () => {
		const intentCheck = JSON.stringify([
			{ id: 'PROJ-1', title: 'Valid', verdicts: { 'AC 1': 'addressed' } },
			{ id: 'PROJ-2', title: 'Null verdicts', verdicts: null }, // typeof null === 'object'
		])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stderr, /dropped malformed IntentCheckItem/)
		assert.match(r.stdout, /\*\*Valid \(PROJ-1\)\*\*/)
		assert.doesNotMatch(r.stdout, /PROJ-2/)
	})

	it('drops an IntentCheckItem whose verdicts is an array (exit 0)', () => {
		const intentCheck = JSON.stringify([{ id: 'PROJ-3', title: 'Array verdicts', verdicts: ['AC 1'] }])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stderr, /dropped malformed IntentCheckItem/)
		assert.doesNotMatch(r.stdout, /### Intent Check/)
	})

	it('drops an IntentCheckItem whose id or title is not a string (exit 0)', () => {
		const intentCheck = JSON.stringify([{ id: 42, title: 'Numeric id', verdicts: { 'AC 1': 'addressed' } }])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stderr, /dropped malformed IntentCheckItem/)
		assert.doesNotMatch(r.stdout, /### Intent Check/)
	})

	it('ignores a non-array INTENT_CHECK_JSON with a stderr note (exit 0)', () => {
		const r = run('{}', '{"not":"an array"}')
		assert.equal(r.status, 0)
		assert.match(r.stderr, /INTENT_CHECK_JSON must be an array/)
		assert.doesNotMatch(r.stdout, /### Intent Check/)
	})

	it('ignores invalid JSON in INTENT_CHECK_JSON with a stderr note (exit 0)', () => {
		const r = run('{}', '{not json}')
		assert.equal(r.status, 0)
		assert.match(r.stderr, /INTENT_CHECK_JSON is not valid JSON/)
		assert.doesNotMatch(r.stdout, /### Intent Check/)
	})

	it('names the offending id when dropping a malformed IntentCheckItem', () => {
		const intentCheck = JSON.stringify([{ id: 'PROJ-9', title: 'No verdicts' }])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stderr, /dropped malformed IntentCheckItem \(id=PROJ-9\)/)
	})

	it('drops an IntentCheckItem with an off-spec verdict value instead of rendering garbage (exit 0)', () => {
		const intentCheck = JSON.stringify([
			{ id: 'PROJ-1', title: 'Valid', verdicts: { 'AC 1': 'addressed' } },
			{ id: 'PROJ-2', title: 'Bad verdict', verdicts: { 'AC 1': 'maybe?' } },
			{ id: 'PROJ-3', title: 'Object verdict', verdicts: { 'AC 1': { nested: true } } },
		])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stderr, /invalid verdict value/)
		assert.match(r.stdout, /\*\*Valid \(PROJ-1\)\*\*/)
		assert.doesNotMatch(r.stdout, /PROJ-2/)
		assert.doesNotMatch(r.stdout, /PROJ-3/)
		assert.doesNotMatch(r.stdout, /\[object Object\]/)
	})

	it('accepts the "partially addressed" verdict value (PRD § Schema: Review Summary)', () => {
		const intentCheck = JSON.stringify([{ id: 'PROJ-1', title: 'Mixed', verdicts: { 'AC 1': 'partially addressed' } }])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stdout, /AC 1: partially addressed/)
	})

	it('renders an optional `note` for an item that could not be fetched', () => {
		const intentCheck = JSON.stringify([
			{ id: 'PROJ-7', title: 'Unfetchable', verdicts: { 'AC 1': 'unaddressed' }, note: 'Item could not be fetched.' },
		])
		const r = run('{}', intentCheck)
		assert.equal(r.status, 0)
		assert.match(r.stdout, /_Item could not be fetched\._/)
	})
})

describe('render-summary CLI — NOTICES_JSON', () => {
	it('renders the unassessed-intent-check notice when NOTICES_JSON contains unassessedIntentCheck: true', () => {
		const r = run('{}', undefined, JSON.stringify({ unassessedIntentCheck: true }))
		assert.equal(r.status, 0)
		assert.match(r.stdout, /Intent Check block/)
	})

	it('emits no notice when NOTICES_JSON is absent', () => {
		const r = run('{}')
		assert.equal(r.status, 0)
		assert.doesNotMatch(r.stdout, /Intent Check block/)
	})

	it('ignores invalid JSON in NOTICES_JSON with a stderr note (exit 0)', () => {
		const r = run('{}', undefined, '{not json}')
		assert.equal(r.status, 0)
		assert.match(r.stderr, /NOTICES_JSON is not valid JSON/)
		assert.doesNotMatch(r.stdout, /Intent Check block/)
	})

	it('ignores a non-object NOTICES_JSON with a stderr note (exit 0)', () => {
		const r = run('{}', undefined, '["array"]')
		assert.equal(r.status, 0)
		assert.match(r.stderr, /NOTICES_JSON must be a plain object/)
		assert.doesNotMatch(r.stdout, /Intent Check block/)
	})
})

describe('render-summary CLI — ITERATION', () => {
	it('stamps the given ITERATION in the Bot Signature footer', () => {
		const r = run(JSON.stringify({ findings: [], positiveObservations: [] }), undefined, undefined, 3)
		assert.equal(r.status, 0)
		assert.ok(r.stdout.includes('Iteration 3'), `Expected "Iteration 3" in stdout; got: ${r.stdout.slice(0, 200)}`)
	})

	it('defaults to Iteration 1 when ITERATION is absent', () => {
		const r = run(JSON.stringify({ findings: [], positiveObservations: [] }))
		assert.equal(r.status, 0)
		assert.match(r.stdout, /Iteration 1/)
	})

	it('falls back to Iteration 1 when ITERATION is non-numeric', () => {
		const env = { ...process.env, FINDINGS_JSON: '{}', ITERATION: 'not-a-number' }
		const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env })
		assert.equal(r.status ?? -1, 0)
		assert.match(r.stdout ?? '', /Iteration 1/)
	})
})
