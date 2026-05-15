// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildYaml, detectCircular } from '../lib/dag-builder.mjs'

/**
 * @param {string} id
 * @param {string[]} blocked_by
 * @returns {import('../lib/issues-schema.mjs').Issue}
 */
function issue(id, blocked_by = []) {
	return {
		id,
		title: `Issue ${id}`,
		type: 'feature',
		priority: 'p1',
		blocked_by,
		acceptance_criteria: ['done'],
		summary: 'x',
	}
}

test('detectCircular: returns null for issues with no dependencies', () => {
	const issues = [issue('a'), issue('b'), issue('c')]
	assert.equal(detectCircular(issues), null)
})

test('detectCircular: returns null for a valid linear chain', () => {
	const issues = [issue('a'), issue('b', ['a']), issue('c', ['b'])]
	assert.equal(detectCircular(issues), null)
})

test('detectCircular: returns null for a diamond dependency', () => {
	// a → b, a → c, b → d, c → d
	const issues = [issue('a'), issue('b', ['a']), issue('c', ['a']), issue('d', ['b', 'c'])]
	assert.equal(detectCircular(issues), null)
})

test('detectCircular: detects a direct cycle', () => {
	const issues = [issue('a', ['b']), issue('b', ['a'])]
	const result = detectCircular(issues)
	assert.notEqual(result, null, 'should detect cycle')
})

test('detectCircular: detects a self-reference cycle', () => {
	const issues = [issue('a', ['a'])]
	const result = detectCircular(issues)
	assert.notEqual(result, null, 'should detect self-reference')
})

test('detectCircular: detects a longer cycle (a→b→c→a)', () => {
	const issues = [issue('a', ['c']), issue('b', ['a']), issue('c', ['b'])]
	const result = detectCircular(issues)
	assert.notEqual(result, null, 'should detect 3-node cycle')
})

test('buildYaml: throws on circular dependencies', () => {
	const issues = [issue('a', ['b']), issue('b', ['a'])]
	assert.throws(() => buildYaml('my-slug', issues), /circular/i)
})

test('buildYaml: produces valid YAML string', () => {
	const issues = [issue('a'), issue('b')]
	const yaml = buildYaml('my-slug', issues)
	assert.ok(typeof yaml === 'string', 'should return a string')
	assert.ok(yaml.includes('name:') || yaml.includes('id:'), 'should contain YAML node fields')
})

test('buildYaml: independent issues produce parallel code-red nodes (no shared depends_on)', () => {
	const issues = [issue('x'), issue('y')]
	const yaml = buildYaml('test', issues)
	// Both code-red nodes should have empty depends_on
	const redXMatch = yaml.match(/id: code-red-x[\s\S]*?depends_on: \[\]/)
	const redYMatch = yaml.match(/id: code-red-y[\s\S]*?depends_on: \[\]/)
	assert.ok(redXMatch, 'code-red-x should have empty depends_on')
	assert.ok(redYMatch, 'code-red-y should have empty depends_on')
})

test('buildYaml: code-green depends on code-red for same issue', () => {
	const issues = [issue('a')]
	const yaml = buildYaml('test', issues)
	assert.ok(yaml.includes('code-red-a'), 'should reference code-red-a')
	assert.ok(yaml.includes('code-green-a'), 'should reference code-green-a')
	// code-green-a must depend on code-red-a
	const greenSection = yaml.slice(yaml.indexOf('id: code-green-a'))
	assert.ok(greenSection.includes('code-red-a'), 'code-green-a depends_on must include code-red-a')
})

test('buildYaml: chained issues produce serial code-red nodes', () => {
	// b blocked_by a → code-red-b must depend on code-green-a
	const issues = [issue('a'), issue('b', ['a'])]
	const yaml = buildYaml('test', issues)
	const redBSection = yaml.slice(yaml.indexOf('id: code-red-b'))
	assert.ok(redBSection.includes('code-green-a'), 'code-red-b must depend on code-green-a')
})

test('buildYaml: diamond dependency produces correct depends_on on leaf', () => {
	// a → b, a → c, b+c → d
	// code-red-d must depend on code-green-b AND code-green-c
	const issues = [issue('a'), issue('b', ['a']), issue('c', ['a']), issue('d', ['b', 'c'])]
	const yaml = buildYaml('test', issues)
	const redDSection = yaml.slice(yaml.indexOf('id: code-red-d'))
	assert.ok(redDSection.includes('code-green-b'), 'code-red-d depends on code-green-b')
	assert.ok(redDSection.includes('code-green-c'), 'code-red-d depends on code-green-c')
})

test('buildYaml: output includes workflow name derived from slug', () => {
	const issues = [issue('a')]
	const yaml = buildYaml('my-feature', issues)
	assert.ok(yaml.includes('my-feature'), 'slug should appear in workflow YAML')
})
