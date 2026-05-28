// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/render-summary.mjs', import.meta.url))

/**
 * Run render-summary.mjs in a child process with the given FINDINGS_JSON.
 *
 * @param {string | undefined} findingsJson
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function run(findingsJson) {
	const env = { ...process.env }
	if (findingsJson === undefined) delete env.FINDINGS_JSON
	else env.FINDINGS_JSON = findingsJson
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
