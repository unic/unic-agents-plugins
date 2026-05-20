// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkArchon, INCOMPATIBLE_ARCHON_VERSIONS } from '../lib/archon-check.mjs'

/** @typedef {import('../lib/archon-check.mjs').ExecFn} ExecFn */

test('returns ok with version when archon is on PATH', () => {
	/** @type {ExecFn} */
	const execFn = () => '0.9.2'
	const result = checkArchon(execFn)
	assert.ok(result.ok, 'should be ok')
	if (!result.ok) return
	assert.equal(result.version, '0.9.2')
})

test('returns enoent failure when archon is not on PATH', () => {
	/** @type {ExecFn} */
	const execFn = () => {
		throw Object.assign(new Error('spawn archon ENOENT'), { code: 'ENOENT' })
	}
	const result = checkArchon(execFn)
	assert.ok(!result.ok, 'should not be ok')
	if (result.ok) return
	assert.equal(result.code, 'enoent')
	assert.ok(result.message.includes('not found'), `message should mention "not found": ${result.message}`)
})

test('returns incompatible failure for known bad version', () => {
	INCOMPATIBLE_ARCHON_VERSIONS.push('0.0.1-bad')
	try {
		/** @type {ExecFn} */
		const execFn = () => '0.0.1-bad'
		const result = checkArchon(execFn)
		assert.ok(!result.ok, 'should not be ok')
		if (result.ok) return
		assert.equal(result.code, 'incompatible')
		assert.ok(result.message.includes('0.0.1-bad'), `message should include version: ${result.message}`)
	} finally {
		INCOMPATIBLE_ARCHON_VERSIONS.splice(INCOMPATIBLE_ARCHON_VERSIONS.indexOf('0.0.1-bad'), 1)
	}
})

test('returns other failure for unexpected errors', () => {
	/** @type {ExecFn} */
	const execFn = () => {
		throw new Error('permission denied')
	}
	const result = checkArchon(execFn)
	assert.ok(!result.ok, 'should not be ok')
	if (result.ok) return
	assert.equal(result.code, 'other')
	assert.ok(result.message.includes('permission denied'), `message should include original error: ${result.message}`)
})

test('INCOMPATIBLE_ARCHON_VERSIONS is exported and starts empty', () => {
	assert.ok(Array.isArray(INCOMPATIBLE_ARCHON_VERSIONS), 'should be an array')
})
