// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectStubs } from '../lib/stub-detector.mjs'

// --- Positive cases (should be flagged as stubs) ---

test('detectStubs: flags TODO comment', () => {
	const result = detectStubs('const x = 1 // TODO: implement this')
	assert.equal(result.length, 1)
	assert.ok(result[0].pattern === 'TODO', `expected TODO, got ${result[0].pattern}`)
})

test('detectStubs: flags FIXME comment', () => {
	const result = detectStubs('// FIXME: broken\nconst y = 2')
	assert.equal(result.length, 1)
	assert.equal(result[0].pattern, 'FIXME')
})

test('detectStubs: flags empty function body (only return with no value)', () => {
	const src = `function doWork() {\n  return\n}`
	const result = detectStubs(src)
	assert.equal(result.length, 1)
	assert.ok(result[0].pattern.includes('empty-return'), `expected empty-return, got ${result[0].pattern}`)
})

test('detectStubs: flags hardcoded sentinel (return null as only body statement)', () => {
	const src = `function getUser() {\n  return null\n}`
	const result = detectStubs(src)
	assert.equal(result.length, 1)
	assert.ok(result[0].pattern.includes('sentinel'), `expected sentinel, got ${result[0].pattern}`)
})

test('detectStubs: flags hardcoded sentinel (return undefined as only body)', () => {
	const src = `function init() {\n  return undefined\n}`
	const result = detectStubs(src)
	assert.equal(result.length, 1)
	assert.ok(result[0].pattern.includes('sentinel'), `expected sentinel, got ${result[0].pattern}`)
})

test('detectStubs: flags pass (Python stub)', () => {
	const src = `def do_work():\n    pass`
	const result = detectStubs(src)
	assert.equal(result.length, 1)
	assert.ok(result[0].pattern.includes('pass'), `expected pass, got ${result[0].pattern}`)
})

// --- Negative cases (should NOT be flagged) ---

test('detectStubs: does not flag a function with real logic', () => {
	const src = `function add(a, b) {\n  return a + b\n}`
	const result = detectStubs(src)
	assert.equal(result.length, 0)
})

test('detectStubs: does not flag return true (non-sentinel)', () => {
	const src = `function isReady() {\n  return true\n}`
	const result = detectStubs(src)
	assert.equal(result.length, 0)
})

test('detectStubs: does not flag return with a real expression', () => {
	const src = `function count(arr) {\n  return arr.length\n}`
	const result = detectStubs(src)
	assert.equal(result.length, 0)
})

test('detectStubs: returns line number for each finding', () => {
	const src = `// TODO: fix me\nconst x = 1`
	const result = detectStubs(src)
	assert.equal(result.length, 1)
	assert.equal(result[0].line, 1)
})

test('detectStubs: detects multiple stubs in one file', () => {
	const src = `// TODO: first\nconst a = 1\n// FIXME: second`
	const result = detectStubs(src)
	assert.equal(result.length, 2)
})

test('detectStubs: returns empty array for empty string', () => {
	assert.deepEqual(detectStubs(''), [])
})
