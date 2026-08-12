#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { derivePriority, PRIORITY_LABELS } from './priority.mjs'

describe('derivePriority', () => {
	for (const label of PRIORITY_LABELS) {
		it(`derives ${label}`, () => {
			assert.equal(derivePriority(['feature', label, 'repo']), label)
		})
	}

	it('returns null when no priority label is present', () => {
		assert.equal(derivePriority(['stream', 'repo']), null)
	})

	it('returns null for an issue with no labels at all', () => {
		assert.equal(derivePriority([]), null)
	})

	it('returns the most urgent when several are present', () => {
		assert.equal(derivePriority(['p3', 'p1']), 'p1')
	})
})
