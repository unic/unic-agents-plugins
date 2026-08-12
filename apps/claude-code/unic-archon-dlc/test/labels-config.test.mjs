// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PRIORITY_LABELS, STATE_LABELS, TYPE_LABELS } from '../lib/labels-config.mjs'

// Membership, not presence. The earlier tests asserted only that each expected role was `in` the
// mapping, so a ninth state passed CI unnoticed — and they were named per tracker as if the result
// varied by tracker, which it never did. A Canonical role is the protocol four Boxes share, so
// adding or removing one has to fail here until someone changes the list on purpose.

test('STATE_LABELS carries exactly the eight shipped state roles', () => {
	assert.deepEqual(STATE_LABELS, [
		'needs-triage',
		'needs-info',
		'needs-specs',
		'ready-for-agent',
		'ready-for-human',
		'resolved',
		'closed',
		'rejected',
	])
})

test('TYPE_LABELS carries exactly the five shipped type roles', () => {
	assert.deepEqual(TYPE_LABELS, ['feature', 'bug', 'spike', 'tech-debt', 'docs'])
})

test('PRIORITY_LABELS carries exactly the four shipped priority roles', () => {
	assert.deepEqual(PRIORITY_LABELS, ['p0', 'p1', 'p2', 'p3'])
})

test('the three tiers together are the seventeen roles /setup asks about', () => {
	assert.equal(STATE_LABELS.length + TYPE_LABELS.length + PRIORITY_LABELS.length, 17)
})
