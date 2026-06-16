// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/lib/human-thread-matcher.mjs', import.meta.url))

/**
 * @param {string | undefined} findingsJson
 * @param {string | undefined} threadsJson
 */
function run(findingsJson, threadsJson) {
	const env = { ...process.env }
	if (findingsJson === undefined) delete env.FINDINGS_JSON
	else env.FINDINGS_JSON = findingsJson
	if (threadsJson === undefined) delete env.HUMAN_THREADS_JSON
	else env.HUMAN_THREADS_JSON = threadsJson
	const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env })
	return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

describe('human-thread-matcher CLI', () => {
	it('exits 0 with valid JSON output when both env vars are omitted (defaults to [])', () => {
		const r = run(undefined, undefined)
		assert.equal(r.status, 0)
		const out = JSON.parse(r.stdout)
		assert.deepEqual(out.annotatedFindings, [])
		assert.deepEqual(out.unmatchedUnresolved, [])
	})

	it('exits 1 with stderr when FINDINGS_JSON is not valid JSON', () => {
		const r = run('{not json}', '[]')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /JSON parse error/)
		assert.equal(r.stdout, '')
	})

	it('exits 1 with stderr when HUMAN_THREADS_JSON is not valid JSON', () => {
		const r = run('[]', '{bad}')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /JSON parse error/)
	})

	it('exits 1 when FINDINGS_JSON is not an array', () => {
		const r = run('"a string"', '[]')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /FINDINGS_JSON must be a JSON array/)
	})

	it('exits 1 when HUMAN_THREADS_JSON is not an array', () => {
		const r = run('[]', 'null')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /HUMAN_THREADS_JSON must be a JSON array/)
	})

	it('exits 0 and writes annotated result for a matched finding + thread', () => {
		const findings = [
			{ severity: 'important', confidence: 80, filePath: 'src/a.ts', startLine: 10, title: 'T', body: 'B' },
		]
		const threads = [{ threadId: 1, filePath: 'src/a.ts', startLine: 10, status: 'active', excerpt: 'e' }]
		const r = run(JSON.stringify(findings), JSON.stringify(threads))
		assert.equal(r.status, 0)
		const out = JSON.parse(r.stdout)
		assert.ok(out.annotatedFindings[0].body.includes('Overlaps open Human Thread #1'))
		assert.equal(out.unmatchedUnresolved.length, 0)
	})
})
