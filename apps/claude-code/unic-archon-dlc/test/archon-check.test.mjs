// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkArchon, INCOMPATIBLE_ARCHON_VERSIONS, MIN_ARCHON_VERSION, parseVersion } from '../lib/archon-check.mjs'

/** @typedef {import('../lib/archon-check.mjs').ExecFn} ExecFn */

test('returns ok with version when archon is on PATH and meets the floor', () => {
	/** @type {ExecFn} */
	const execFn = () => '0.9.2'
	const result = checkArchon(execFn)
	assert.ok(result.ok, 'should be ok')
	if (!result.ok) return
	assert.equal(result.version, '0.9.2')
})

test('accepts exactly the min-floor version', () => {
	const result = checkArchon(() => MIN_ARCHON_VERSION)
	assert.ok(result.ok, 'min-floor version should be accepted')
})

test('rejects a version below the min-floor', () => {
	const result = checkArchon(() => '0.4.9')
	assert.ok(!result.ok, 'should not be ok')
	if (result.ok) return
	assert.equal(result.code, 'incompatible')
	assert.ok(result.message.includes('0.4.9'), `message should include the found version: ${result.message}`)
	assert.ok(result.message.includes(MIN_ARCHON_VERSION), `message should include the floor: ${result.message}`)
})

test('rejects a version that satisfied the OLD 0.5.0 floor but not the NEW 0.7.0 floor', () => {
	// AC 1 (#290): proves the floor actually moved, not just that some floor is enforced.
	const result = checkArchon(() => '0.6.9')
	assert.ok(!result.ok, 'a pre-0.7.0 version must now fail')
	if (result.ok) return
	assert.equal(result.code, 'incompatible')
	assert.ok(result.message.includes('0.6.9'), `message should include the found version: ${result.message}`)
	assert.ok(result.message.includes('0.7.0'), `message should include the new floor: ${result.message}`)
})

test('parses a version string with a program-name / v prefix', () => {
	assert.ok(checkArchon(() => 'archon v0.7.1').ok, 'prefixed version >= floor should be ok')
	assert.ok(!checkArchon(() => 'archon v0.3.0').ok, 'prefixed version < floor should fail')
})

test('unparseable version is non-blocking (warn-and-degrade)', () => {
	const result = checkArchon(() => 'dev-build')
	assert.ok(result.ok, 'unparseable version should not block')
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

test('returns incompatible failure for an explicitly listed bad version (bare-array back-compat)', () => {
	/** @type {ExecFn} */
	const execFn = () => '9.9.9-bad'
	const result = checkArchon(execFn, ['9.9.9-bad'])
	assert.ok(!result.ok, 'should not be ok')
	if (result.ok) return
	assert.equal(result.code, 'incompatible')
	assert.ok(result.message.includes('9.9.9-bad'), `message should include version: ${result.message}`)
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

test('returns other failure with stderr when process fails', () => {
	/** @type {ExecFn} */
	const execFn = () => {
		throw Object.assign(new Error('Command failed'), { stderr: Buffer.from('archon: illegal option --v') })
	}
	const result = checkArchon(execFn)
	assert.ok(!result.ok, 'should not be ok')
	if (result.ok) return
	assert.equal(result.code, 'other')
	assert.ok(result.message.includes('stderr:'), `message should include stderr label: ${result.message}`)
	assert.ok(result.message.includes('illegal option'), `message should include stderr content: ${result.message}`)
})

test('parseVersion is public API: it tolerates a program-name and v prefix, and returns null on garbage', () => {
	// Exported for `/archon-upgrade`, which compares the installed version against the floor and
	// against each release tag it enumerates. Locked here now that it is public.
	assert.deepEqual(parseVersion('archon v0.7.1'), [0, 7, 1])
	assert.deepEqual(parseVersion('0.7.0'), [0, 7, 0])
	assert.equal(parseVersion('not a version'), null)
})

test('INCOMPATIBLE_ARCHON_VERSIONS is frozen and starts empty', () => {
	assert.ok(Array.isArray(INCOMPATIBLE_ARCHON_VERSIONS), 'should be an array')
	assert.ok(Object.isFrozen(INCOMPATIBLE_ARCHON_VERSIONS), 'should be frozen')
})
