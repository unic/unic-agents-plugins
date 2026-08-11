#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyReadiness, STATE_LABELS, UNLABELLED } from './readiness.mjs'

describe('classifyReadiness', () => {
	for (const label of STATE_LABELS) {
		it(`classifies ${label}`, () => {
			assert.deepEqual(classifyReadiness(['feature', label, 'p1']), {
				state: label,
				className: `state-${label}`,
			})
		})
	}

	it('falls back to unlabelled when no state label is present', () => {
		assert.deepEqual(classifyReadiness(['feature', 'p1', 'repo']), {
			state: UNLABELLED,
			className: `state-${UNLABELLED}`,
		})
	})

	it('falls back to unlabelled for an issue with no labels at all', () => {
		assert.equal(classifyReadiness([]).state, UNLABELLED)
	})

	it('picks the earliest lifecycle state when several are present', () => {
		assert.equal(classifyReadiness(['resolved', 'needs-specs']).state, 'needs-specs')
	})

	it('ignores a label that merely contains a state name', () => {
		assert.equal(classifyReadiness(['wayfinder:needs-triage-ish']).state, UNLABELLED)
	})
})
