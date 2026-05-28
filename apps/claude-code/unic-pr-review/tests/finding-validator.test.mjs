// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseFinding } from '../scripts/lib/finding-validator.mjs'

const valid = {
	confidence: 95,
	filePath: 'src/index.mjs',
	startLine: 42,
	title: 'Null pointer possible',
	body: 'Input may be undefined.',
}

describe('parseFinding', () => {
	it('returns a normalised Finding with derived severity for valid input', () => {
		const r = parseFinding(valid)
		assert.ok(r)
		assert.equal(r.severity, 'critical')
		assert.equal(r.confidence, 95)
		assert.equal(r.filePath, 'src/index.mjs')
		assert.equal(r.startLine, 42)
	})

	it('returns null when confidence is below the drop threshold', () => {
		assert.equal(parseFinding({ ...valid, confidence: 59 }), null)
	})

	it('preserves suggestion when present and non-empty', () => {
		const r = parseFinding({ ...valid, suggestion: 'const x = y ?? 0' })
		assert.equal(r?.suggestion, 'const x = y ?? 0')
	})

	it('drops suggestion when whitespace-only', () => {
		const r = parseFinding({ ...valid, suggestion: '   \n' })
		assert.equal(r?.suggestion, undefined)
	})

	it('throws on non-object input', () => {
		assert.throws(() => parseFinding(null), /expected object/)
		assert.throws(() => parseFinding('finding'), /expected object/)
	})

	it('throws when filePath is missing or empty', () => {
		assert.throws(() => parseFinding({ ...valid, filePath: '' }), /filePath/)
		assert.throws(() => parseFinding({ ...valid, filePath: undefined }), /filePath/)
	})

	it('throws when startLine is not a positive integer', () => {
		assert.throws(() => parseFinding({ ...valid, startLine: 0 }), /startLine/)
		assert.throws(() => parseFinding({ ...valid, startLine: -1 }), /startLine/)
		assert.throws(() => parseFinding({ ...valid, startLine: 1.5 }), /startLine/)
	})

	it('throws when title or body is missing', () => {
		assert.throws(() => parseFinding({ ...valid, title: '' }), /title/)
		assert.throws(() => parseFinding({ ...valid, body: '' }), /body/)
	})

	it('throws when confidence is not a number', () => {
		assert.throws(() => parseFinding({ ...valid, confidence: '95' }), /confidence/)
	})

	it('throws when confidence is out of range (via bucketBySeverity)', () => {
		assert.throws(() => parseFinding({ ...valid, confidence: 101 }), /finite number in 0-100/)
	})
})
