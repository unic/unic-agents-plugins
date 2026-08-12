#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildLaneIndex, groupIntoLanes, isCrossStreamEdge } from './graph.mjs'

/**
 * @param {number} number
 * @param {string} [title]
 * @returns {{ number: number, title: string, state: string, labels: string[] }}
 */
const stream = (number, title = `stream: ${number}`) => ({ number, title, state: 'open', labels: ['stream'] })

describe('isCrossStreamEdge', () => {
	it('flags two endpoints in different streams', () => {
		assert.equal(isCrossStreamEdge(313, 316), true)
	})

	it('does not flag two endpoints in the same stream', () => {
		assert.equal(isCrossStreamEdge(313, 313), false)
	})

	it('does not flag an edge whose source is outside every stream', () => {
		assert.equal(isCrossStreamEdge(null, 316), false)
	})

	it('does not flag an edge whose target is outside every stream', () => {
		assert.equal(isCrossStreamEdge(313, undefined), false)
	})

	it('does not flag an edge with both endpoints outside every stream', () => {
		assert.equal(isCrossStreamEdge(null, null), false)
	})
})

describe('buildLaneIndex', () => {
	it('maps every member to its owning stream', () => {
		const index = buildLaneIndex(
			new Map([
				[313, [{ number: 280 }, { number: 281 }]],
				[316, [{ number: 290 }]],
			])
		)
		assert.equal(index.get(280), 313)
		assert.equal(index.get(281), 313)
		assert.equal(index.get(290), 316)
	})

	it('returns undefined for an issue outside every stream', () => {
		const index = buildLaneIndex(new Map([[313, [{ number: 280 }]]]))
		assert.equal(index.get(999), undefined)
	})

	it('keeps the first stream when an issue somehow appears in two', () => {
		const index = buildLaneIndex(
			new Map([
				[313, [{ number: 280 }]],
				[316, [{ number: 280 }]],
			])
		)
		assert.equal(index.get(280), 313)
	})

	it('handles an empty map', () => {
		assert.equal(buildLaneIndex(new Map()).size, 0)
	})
})

describe('groupIntoLanes', () => {
	it('sorts lanes by member count, descending', () => {
		const lanes = groupIntoLanes(
			[stream(313), stream(316), stream(317)],
			new Map([
				[313, [{ number: 1 }]],
				[316, [{ number: 2 }, { number: 3 }, { number: 4 }]],
				[317, [{ number: 5 }, { number: 6 }]],
			])
		)
		assert.deepEqual(
			lanes.map((lane) => lane.streamNumber),
			[316, 317, 313]
		)
	})

	it('keeps a stream ticket with no members as an empty lane', () => {
		const lanes = groupIntoLanes([stream(313), stream(316)], new Map([[313, [{ number: 1 }]]]))
		assert.equal(lanes.length, 2)
		assert.deepEqual(lanes[1], {
			streamNumber: 316,
			streamTitle: 'stream: 316',
			streamState: 'open',
			members: [],
		})
	})

	it('carries the stream title and state onto the lane', () => {
		const lanes = groupIntoLanes([stream(313, 'stream: Matt Pocock skills migration')], new Map())
		assert.equal(lanes[0].streamTitle, 'stream: Matt Pocock skills migration')
		assert.equal(lanes[0].streamState, 'open')
	})

	it('returns no lanes when no stream ticket exists', () => {
		assert.deepEqual(groupIntoLanes([], new Map([[313, [{ number: 1 }]]])), [])
	})

	it('renders both lanes when two are tied on member count', () => {
		const lanes = groupIntoLanes(
			[stream(313), stream(316)],
			new Map([
				[313, [{ number: 1 }]],
				[316, [{ number: 2 }]],
			])
		)
		assert.equal(lanes.length, 2)
	})
})
