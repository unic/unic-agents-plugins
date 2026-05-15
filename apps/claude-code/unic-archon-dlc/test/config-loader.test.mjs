// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfig } from '../lib/config-loader.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-cfg-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

test('valid config parses correctly', () => {
	const path = join(tempDir(), 'unic-dlc.config.json')
	writeFileSync(path, JSON.stringify({ tracker: 'github', pr_strategy: 'squash', branching: 'gitflow' }))
	const result = loadConfig(path)
	assert.ok(!('error' in result), 'should not have error')
	if ('error' in result) return
	assert.equal(result.tracker, 'github')
	assert.equal(result.pr_strategy, 'squash')
	assert.equal(result.branching, 'gitflow')
})

test('missing mandatory fields return structured error', () => {
	const path = join(tempDir(), 'unic-dlc.config.json')
	writeFileSync(path, JSON.stringify({ tracker: 'github' }))
	const result = loadConfig(path)
	assert.ok('error' in result && result.error === true, 'should have error flag')
	if (!('error' in result)) return
	assert.ok(Array.isArray(result.missing), 'should have missing array')
	assert.ok(result.missing.includes('pr_strategy'))
	assert.ok(result.missing.includes('branching'))
})

test('unknown keys are ignored and mandatory fields still parse', () => {
	const path = join(tempDir(), 'unic-dlc.config.json')
	writeFileSync(
		path,
		JSON.stringify({
			tracker: 'github',
			pr_strategy: 'squash',
			branching: 'gitflow',
			unknown_key: 'should-be-ignored',
			another_unknown: 42,
		})
	)
	const result = loadConfig(path)
	assert.ok(!('error' in result), 'should not have error')
	if ('error' in result) return
	assert.equal(result.tracker, 'github')
	assert.ok(!('unknown_key' in result), 'unknown_key should not be in result')
	assert.ok(!('another_unknown' in result), 'another_unknown should not be in result')
})
