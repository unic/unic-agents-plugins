// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIssuesJson, sortByDependency, validateIssue } from '../lib/issues-schema.mjs'

// --- helpers ---

/** @returns {import('../lib/issues-schema.mjs').Issue} */
function makeIssue(overrides = {}) {
	return {
		id: 'issue-1',
		title: 'Implement login flow',
		type: 'feature',
		priority: 'p1',
		blocked_by: [],
		acceptance_criteria: ['User can log in with email and password'],
		summary: 'Builds the authentication login page and backend handler.',
		...overrides,
	}
}

// --- validateIssue ---

test('validateIssue: returns valid=true for a complete issue object', () => {
	const result = validateIssue(makeIssue())
	assert.equal(result.valid, true, 'a complete issue should be valid')
	assert.deepEqual(result.errors, [], 'no errors for a complete issue')
})

test('validateIssue: returns errors listing missing mandatory fields', () => {
	const incomplete = {
		id: 'issue-2',
		title: 'Missing several fields',
		// type, priority, blocked_by, acceptance_criteria, summary all missing
	}
	const result = validateIssue(incomplete)
	assert.equal(result.valid, false, 'incomplete issue should not be valid')
	assert.ok(result.errors.length > 0, 'should have at least one error')
	assert.ok(
		result.errors.some((e) => e.includes('type')),
		`errors should mention 'type', got: ${result.errors}`
	)
	assert.ok(
		result.errors.some((e) => e.includes('priority')),
		`errors should mention 'priority', got: ${result.errors}`
	)
	assert.ok(
		result.errors.some((e) => e.includes('blocked_by')),
		`errors should mention 'blocked_by', got: ${result.errors}`
	)
	assert.ok(
		result.errors.some((e) => e.includes('acceptance_criteria')),
		`errors should mention 'acceptance_criteria', got: ${result.errors}`
	)
	assert.ok(
		result.errors.some((e) => e.includes('summary')),
		`errors should mention 'summary', got: ${result.errors}`
	)
})

test('validateIssue: missing id is reported as an error', () => {
	const noId = makeIssue({ id: undefined })
	const result = validateIssue(noId)
	assert.equal(result.valid, false)
	assert.ok(
		result.errors.some((e) => e.includes('id')),
		`errors should mention 'id', got: ${result.errors}`
	)
})

test('validateIssue: missing title is reported as an error', () => {
	const noTitle = makeIssue({ title: undefined })
	const result = validateIssue(noTitle)
	assert.equal(result.valid, false)
	assert.ok(
		result.errors.some((e) => e.includes('title')),
		`errors should mention 'title', got: ${result.errors}`
	)
})

test('validateIssue: acceptance_criteria must be a non-empty array', () => {
	const emptyAc = makeIssue({ acceptance_criteria: [] })
	const result = validateIssue(emptyAc)
	assert.equal(result.valid, false, 'empty acceptance_criteria array should be invalid')
	assert.ok(
		result.errors.some((e) => e.includes('acceptance_criteria')),
		`errors should mention 'acceptance_criteria', got: ${result.errors}`
	)
})

// --- sortByDependency ---

test('sortByDependency: returns single-element array unchanged', () => {
	const issues = [makeIssue({ id: 'a', blocked_by: [] })]
	const sorted = sortByDependency(issues)
	assert.equal(sorted.length, 1)
	assert.equal(sorted[0].id, 'a')
})

test('sortByDependency: returns correct order for a simple linear chain [A←B←C] → [A, B, C]', () => {
	// B blocked_by A means A must come before B
	// C blocked_by B means B must come before C
	const issues = [
		makeIssue({ id: 'C', blocked_by: ['B'] }),
		makeIssue({ id: 'A', blocked_by: [] }),
		makeIssue({ id: 'B', blocked_by: ['A'] }),
	]
	const sorted = sortByDependency(issues)
	assert.equal(sorted.length, 3, 'all issues should be in result')

	const ids = sorted.map((i) => i.id)
	const idxA = ids.indexOf('A')
	const idxB = ids.indexOf('B')
	const idxC = ids.indexOf('C')

	assert.ok(idxA < idxB, `A must come before B, got order: ${ids}`)
	assert.ok(idxB < idxC, `B must come before C, got order: ${ids}`)
})

test('sortByDependency: handles independent issues with no dependencies', () => {
	const issues = [
		makeIssue({ id: 'X', blocked_by: [] }),
		makeIssue({ id: 'Y', blocked_by: [] }),
		makeIssue({ id: 'Z', blocked_by: [] }),
	]
	const sorted = sortByDependency(issues)
	assert.equal(sorted.length, 3, 'all independent issues should be returned')
	const ids = sorted.map((i) => i.id)
	assert.ok(ids.includes('X') && ids.includes('Y') && ids.includes('Z'), 'all IDs present')
})

test('sortByDependency: throws on circular dependency', () => {
	const issues = [makeIssue({ id: 'A', blocked_by: ['B'] }), makeIssue({ id: 'B', blocked_by: ['A'] })]
	assert.throws(() => sortByDependency(issues), /circular/i, 'should throw an error mentioning circular dependency')
})

test('sortByDependency: throws on self-referencing dependency', () => {
	const issues = [makeIssue({ id: 'A', blocked_by: ['A'] })]
	assert.throws(() => sortByDependency(issues), /circular/i, 'should throw an error mentioning circular dependency')
})

// --- buildIssuesJson ---

test('buildIssuesJson: produces valid JSON string', () => {
	const issues = [makeIssue(), makeIssue({ id: 'issue-2', title: 'Second issue' })]
	const json = buildIssuesJson(issues)
	assert.doesNotThrow(() => JSON.parse(json), 'output should be parseable JSON')
})

test('buildIssuesJson: uses 2-space indent', () => {
	const issues = [makeIssue()]
	const json = buildIssuesJson(issues)
	assert.ok(json.includes('\n  '), 'output should use 2-space indentation')
})

test('buildIssuesJson: round-trips an issues array correctly', () => {
	const issues = [
		makeIssue({ id: 'i1', title: 'First', blocked_by: [] }),
		makeIssue({ id: 'i2', title: 'Second', blocked_by: ['i1'] }),
	]
	const json = buildIssuesJson(issues)
	const parsed = JSON.parse(json)
	assert.equal(parsed.length, 2, 'should have 2 issues after round-trip')
	assert.equal(parsed[0].id, 'i1')
	assert.equal(parsed[1].id, 'i2')
	assert.deepEqual(parsed[1].blocked_by, ['i1'])
})
