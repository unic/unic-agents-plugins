// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	normalizeFinding,
	VALID_DIMENSIONS,
	VALID_HATS,
	VALID_SEVERITIES,
	validateFinding,
} from '../scripts/lib/finding.mjs'

/** @returns {Record<string, unknown>} */
function validRaw() {
	return {
		hat: 'black',
		dimension: 'gaps',
		title: 'x',
		body: 'y',
		severity: 'critical',
		confidence: 85,
		anchor: null,
	}
}

describe('validateFinding', () => {
	it('returns an error string for null', () => {
		assert.equal(typeof validateFinding(null), 'string')
	})

	it('returns missing title for an empty object', () => {
		assert.match(/** @type {string} */ (validateFinding({})), /title/)
	})

	it('returns null for a valid finding', () => {
		assert.equal(validateFinding(validRaw()), null)
	})

	it('returns an error when body is missing', () => {
		const f = validRaw()
		delete f.body
		assert.match(/** @type {string} */ (validateFinding(f)), /body/)
	})

	it('returns an error for an unknown severity', () => {
		assert.match(/** @type {string} */ (validateFinding({ ...validRaw(), severity: 'unknown' })), /severity/)
	})

	it('returns out of range for confidence 150', () => {
		assert.match(/** @type {string} */ (validateFinding({ ...validRaw(), confidence: 150 })), /range/)
	})

	it('returns out of range for confidence -1', () => {
		assert.match(/** @type {string} */ (validateFinding({ ...validRaw(), confidence: -1 })), /range/)
	})

	it('returns an error for NaN confidence', () => {
		assert.match(/** @type {string} */ (validateFinding({ ...validRaw(), confidence: NaN })), /finite/)
	})

	it('returns an error for an invalid hat', () => {
		assert.match(/** @type {string} */ (validateFinding({ ...validRaw(), hat: 'purple' })), /hat/)
	})

	it('returns an error for an invalid dimension', () => {
		assert.match(/** @type {string} */ (validateFinding({ ...validRaw(), dimension: 'unknown' })), /dimension/)
	})

	it('returns an error when anchor is not a string or null', () => {
		assert.match(/** @type {string} */ (validateFinding({ ...validRaw(), anchor: 123 })), /anchor/)
	})

	it('accepts a string anchor', () => {
		assert.equal(validateFinding({ ...validRaw(), anchor: 'the user clicks submit' }), null)
	})
})

describe('normalizeFinding', () => {
	it('maps raw.description to body when body is absent', () => {
		const f = normalizeFinding(
			{ title: 't', description: 'desc text', severity: 'minor', confidence: 70 },
			'black',
			'gaps'
		)
		assert.equal(f.body, 'desc text')
	})

	it('prefers raw.body over raw.description', () => {
		const f = normalizeFinding({ title: 't', body: 'body text', description: 'desc text' }, 'black', 'gaps')
		assert.equal(f.body, 'body text')
	})

	it('uses the provided hat arg when raw.hat is absent', () => {
		const f = normalizeFinding({ title: 't', body: 'b' }, 'green', 'green')
		assert.equal(f.hat, 'green')
	})

	it('uses the provided dimension arg when raw.dimension is absent', () => {
		const f = normalizeFinding({ title: 't', body: 'b' }, 'black', 'ambiguity')
		assert.equal(f.dimension, 'ambiguity')
	})

	it('keeps a valid hat present in raw', () => {
		const f = normalizeFinding({ title: 't', body: 'b', hat: 'red' }, 'black', 'gaps')
		assert.equal(f.hat, 'red')
	})

	it('preserves anchor null', () => {
		const f = normalizeFinding({ title: 't', body: 'b', anchor: null }, 'black', 'gaps')
		assert.equal(f.anchor, null)
	})

	it('preserves a string anchor', () => {
		const f = normalizeFinding({ title: 't', body: 'b', anchor: 'some text' }, 'black', 'gaps')
		assert.equal(f.anchor, 'some text')
	})

	it('defaults severity to minor and confidence to 0 when absent', () => {
		const f = normalizeFinding({ title: 't', body: 'b' }, 'black', 'gaps')
		assert.equal(f.severity, 'minor')
		assert.equal(f.confidence, 0)
	})

	it('defaults body to empty string when neither body nor description present', () => {
		const f = normalizeFinding({ title: 't' }, 'black', 'gaps')
		assert.equal(f.body, '')
	})

	it('falls back to provided hat when raw.hat is invalid', () => {
		const f = normalizeFinding({ title: 't', body: 'b', hat: 'purple' }, 'black', 'gaps')
		assert.equal(f.hat, 'black')
	})

	it('falls back to provided dimension when raw.dimension is invalid', () => {
		const f = normalizeFinding({ title: 't', body: 'b', dimension: 'unknown' }, 'black', 'ambiguity')
		assert.equal(f.dimension, 'ambiguity')
	})

	it('falls back to minor when raw.severity is invalid', () => {
		const f = normalizeFinding({ title: 't', body: 'b', severity: 'blocker' }, 'black', 'gaps')
		assert.equal(f.severity, 'minor')
	})

	it('uses (untitled) when title is absent', () => {
		const f = normalizeFinding({ body: 'b' }, 'black', 'gaps')
		assert.equal(f.title, '(untitled)')
	})
})

describe('schema constants', () => {
	it('exposes the expected hats, dimensions, and severities', () => {
		assert.ok(VALID_HATS.includes('black'))
		assert.equal(VALID_DIMENSIONS.length, 11)
		assert.deepEqual([...VALID_SEVERITIES], ['critical', 'important', 'minor'])
	})
})
