#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOutsideEveryStream, toCard } from './fetch-streams.mjs'

describe('isOutsideEveryStream', () => {
	it('excludes a stream ticket itself', () => {
		const issue = { number: 313, title: '', state: 'open', labels: ['stream'] }
		assert.equal(isOutsideEveryStream(issue, new Map()), false)
	})

	it('excludes an issue already in a lane', () => {
		const issue = { number: 281, title: '', state: 'open', labels: [] }
		assert.equal(isOutsideEveryStream(issue, new Map([[281, 313]])), false)
	})

	it('excludes a wayfinder artefact', () => {
		const issue = { number: 400, title: '', state: 'open', labels: ['wayfinder:map'] }
		assert.equal(isOutsideEveryStream(issue, new Map()), false)
	})

	it('includes an open issue in no lane with no wayfinder label', () => {
		const issue = { number: 500, title: '', state: 'open', labels: ['bug'] }
		assert.equal(isOutsideEveryStream(issue, new Map()), true)
	})
})

describe('toCard', () => {
	it('builds a card with priority, readiness, and its blockers', () => {
		const issue = { number: 500, title: 'feat: add widget', state: 'open', labels: ['feature', 'ready-for-agent'] }
		const blocker = { number: 200, title: 'blocker', state: 'open', labels: [] }
		const card = toCard(
			issue,
			[blocker],
			new Map([
				[500, 313],
				[200, 316],
			])
		)
		assert.equal(card.number, 500)
		assert.equal(card.issueState, 'open')
		assert.deepEqual(card.blockers, [{ number: 200, state: 'open', crossesStream: true }])
	})

	it('marks a blocker in the same lane as not crossing streams', () => {
		const issue = { number: 500, title: 'feat: add widget', state: 'open', labels: [] }
		const blocker = { number: 200, title: 'blocker', state: 'open', labels: [] }
		const card = toCard(
			issue,
			[blocker],
			new Map([
				[500, 313],
				[200, 313],
			])
		)
		assert.equal(card.blockers[0].crossesStream, false)
	})

	it('builds a card with no blockers', () => {
		const issue = { number: 500, title: 'feat: add widget', state: 'closed', labels: [] }
		const card = toCard(issue, [], new Map())
		assert.deepEqual(card.blockers, [])
	})
})
