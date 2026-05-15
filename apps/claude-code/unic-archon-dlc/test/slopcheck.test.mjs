// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyPackages, parseNewPackages } from '../lib/slopcheck.mjs'

test('parseNewPackages: all packages are new when prev is empty', () => {
	const result = parseNewPackages({}, { react: '^18.0.0', lodash: '^4.0.0' })
	assert.deepEqual(result.sort(), ['lodash', 'react'])
})

test('parseNewPackages: returns empty array when deps are unchanged', () => {
	const deps = { react: '^18.0.0' }
	assert.deepEqual(parseNewPackages(deps, deps), [])
})

test('parseNewPackages: returns only packages not in prev', () => {
	const prev = { react: '^18.0.0', lodash: '^4.0.0' }
	const next = { react: '^18.0.0', lodash: '^4.0.0', zod: '^3.0.0' }
	assert.deepEqual(parseNewPackages(prev, next), ['zod'])
})

test('parseNewPackages: treats null/undefined prev as empty', () => {
	// @ts-expect-error — testing runtime null handling
	const result = parseNewPackages(null, { express: '^4.0.0' })
	assert.deepEqual(result, ['express'])
})

test('classifyPackages: package is not assumed when registry returns true', async () => {
	const result = await classifyPackages(['my-pkg'], async () => true)
	assert.equal(result.length, 1)
	assert.equal(result[0].name, 'my-pkg')
	assert.equal(result[0].assumed, false)
})

test('classifyPackages: package is assumed when registry returns false', async () => {
	const result = await classifyPackages(['fake-pkg-xyz'], async () => false)
	assert.equal(result[0].assumed, true)
})

test('classifyPackages: package is assumed when registry check throws', async () => {
	const result = await classifyPackages(['boom-pkg'], async () => {
		throw new Error('network error')
	})
	assert.equal(result[0].assumed, true)
})

test('classifyPackages: all packages assumed when no registryFn provided', async () => {
	const result = await classifyPackages(['pkg-a', 'pkg-b'], null)
	assert.ok(
		result.every((r) => r.assumed === true),
		'all should be assumed'
	)
})

test('classifyPackages: returns empty array for empty input', async () => {
	const result = await classifyPackages([], async () => true)
	assert.deepEqual(result, [])
})
