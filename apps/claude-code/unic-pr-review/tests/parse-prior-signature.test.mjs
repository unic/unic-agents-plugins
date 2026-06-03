// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { renderFooter } from '../scripts/lib/signature.mjs'

describe('parse-prior-signature.mjs (subprocess)', () => {
	const scriptPath = new URL('../scripts/parse-prior-signature.mjs', import.meta.url).pathname

	it('returns null JSON for empty thread array', () => {
		const out = execFileSync(process.execPath, [scriptPath], { input: '[]', encoding: 'utf8' })
		assert.equal(JSON.parse(out), null)
	})

	it('returns parsed signature for a thread with a matching footer', () => {
		const threads = [{ comments: [{ content: renderFooter(3), author: { id: 'bot-1' } }] }]
		const out = execFileSync(process.execPath, [scriptPath], {
			input: JSON.stringify(threads),
			encoding: 'utf8',
		})
		const result = JSON.parse(out)
		assert.equal(result?.priorIteration, 3)
		assert.equal(result?.priorRevisionId, 3)
	})

	it('exits with code 1 and writes to stderr on invalid JSON', () => {
		let threw = false
		try {
			execFileSync(process.execPath, [scriptPath], { input: 'not-json', encoding: 'utf8' })
		} catch (err) {
			threw = true
			const e = /** @type {any} */ (err)
			assert.equal(e.status, 1)
			assert.ok(
				typeof e.stderr === 'string' && e.stderr.includes('parse-prior-signature'),
				`Expected descriptive error on stderr, got: ${e.stderr}`
			)
		}
		assert.ok(threw, 'Expected execFileSync to throw on invalid JSON input')
	})

	it('exits with code 1 and writes to stderr when input is a non-array JSON value', () => {
		let threw = false
		try {
			execFileSync(process.execPath, [scriptPath], { input: 'null', encoding: 'utf8' })
		} catch (err) {
			threw = true
			const e = /** @type {any} */ (err)
			assert.equal(e.status, 1)
			assert.ok(
				typeof e.stderr === 'string' && e.stderr.includes('parse-prior-signature'),
				`Expected descriptive error on stderr, got: ${e.stderr}`
			)
		}
		assert.ok(threw, 'Expected execFileSync to throw on non-array JSON input')
	})
})
