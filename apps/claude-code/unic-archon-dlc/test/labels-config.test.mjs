// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDefaultLabels } from '../lib/labels-config.mjs'

test('local-markdown: canonical names equal tracker strings for all tiers', () => {
	const labels = getDefaultLabels('local-markdown')
	assert.equal(labels.state['needs-triage'], 'needs-triage')
	assert.equal(labels.state['ready-for-agent'], 'ready-for-agent')
	assert.equal(labels.state.rejected, 'rejected')
	assert.equal(labels.type.feature, 'feature')
	assert.equal(labels.type['tech-debt'], 'tech-debt')
	assert.equal(labels.priority.p0, 'p0')
	assert.equal(labels.priority.p3, 'p3')
})

test('github: default mapping has all canonical keys and uses canonical as tracker strings', () => {
	const labels = getDefaultLabels('github')
	// All state labels present
	for (const k of [
		'needs-triage',
		'needs-info',
		'needs-specs',
		'ready-for-agent',
		'ready-for-human',
		'resolved',
		'closed',
		'rejected',
	]) {
		assert.ok(k in labels.state, `state.${k} should be present`)
		assert.equal(labels.state[k], k, `github default: state.${k} should equal canonical key`)
	}
	// All type labels present
	for (const k of ['feature', 'bug', 'spike', 'tech-debt', 'docs']) {
		assert.ok(k in labels.type, `type.${k} should be present`)
	}
	// All priority labels present
	for (const k of ['p0', 'p1', 'p2', 'p3']) {
		assert.ok(k in labels.priority, `priority.${k} should be present`)
	}
})
