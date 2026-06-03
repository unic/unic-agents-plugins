// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/render-inline-comment.mjs', import.meta.url))

/**
 * Run render-inline-comment.mjs in a child process with the given INLINE_COMMENT_JSON.
 *
 * @param {string | undefined} inlineCommentJson
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function run(inlineCommentJson) {
	const env = { ...process.env }
	if (inlineCommentJson === undefined) delete env.INLINE_COMMENT_JSON
	else env.INLINE_COMMENT_JSON = inlineCommentJson
	const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env })
	return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

describe('render-inline-comment CLI', () => {
	it('exits 1 with a stderr message when INLINE_COMMENT_JSON is missing', () => {
		const r = run(undefined)
		assert.equal(r.status, 1)
		assert.match(r.stderr, /INLINE_COMMENT_JSON environment variable is required/)
		assert.equal(r.stdout, '')
	})

	it('exits 1 when INLINE_COMMENT_JSON is not valid JSON', () => {
		const r = run('{not json}')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /not valid JSON/)
		assert.equal(r.stdout, '')
	})

	it('exits 1 when INLINE_COMMENT_JSON is not an object', () => {
		const r = run('"a string"')
		assert.equal(r.status, 1)
		assert.match(r.stderr, /must be an object/)
		assert.equal(r.stdout, '')
	})

	it('exits 1 with the missing field name when a required field is absent', () => {
		const r = run(JSON.stringify({ severity: 'critical', title: 'T', iteration: 1 }))
		assert.equal(r.status, 1)
		assert.match(r.stderr, /missing required field "body"/)
		assert.equal(r.stdout, '')
	})

	it('renders the inline comment with severity emoji, title, body and footer', () => {
		const r = run(JSON.stringify({ severity: 'critical', title: 'Null deref', body: 'Add a guard.', iteration: 1 }))
		assert.equal(r.status, 0)
		assert.ok(r.stdout.startsWith('🔴 Null deref'))
		assert.match(r.stdout, /Add a guard\./)
		assert.match(r.stdout, /🤖 Reviewed by Claude Code — Iteration 1/)
	})

	it('includes a suggestion block only when suggestion is present and non-empty', () => {
		const withSuggestion = run(
			JSON.stringify({ severity: 'minor', title: 'Tidy', body: 'B', suggestion: 'const x = 1', iteration: 2 })
		)
		assert.equal(withSuggestion.status, 0)
		assert.match(withSuggestion.stdout, /```suggestion\nconst x = 1\n```/)

		const withoutSuggestion = run(JSON.stringify({ severity: 'minor', title: 'Tidy', body: 'B', iteration: 2 }))
		assert.equal(withoutSuggestion.status, 0)
		assert.ok(!withoutSuggestion.stdout.includes('```suggestion'))
	})
})
