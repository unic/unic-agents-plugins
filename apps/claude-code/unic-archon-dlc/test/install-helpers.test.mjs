// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { deducePrStrategy, detectRepoLayout, detectTracker } from '../lib/install-runner.mjs'

// --- detectTracker ---

test('detectTracker: github.com remote → github tracker', () => {
	assert.equal(detectTracker('https://github.com/org/repo.git'), 'github')
})

test('detectTracker: ssh github.com remote → github tracker', () => {
	assert.equal(detectTracker('git@github.com:org/repo.git'), 'github')
})

test('detectTracker: visualstudio.com remote → ado tracker', () => {
	assert.equal(detectTracker('https://org.visualstudio.com/project/_git/repo'), 'ado')
})

test('detectTracker: dev.azure.com remote → ado tracker', () => {
	assert.equal(detectTracker('https://dev.azure.com/org/project/_git/repo'), 'ado')
})

test('detectTracker: null remote → null (no tracker detected)', () => {
	assert.equal(detectTracker(null), null)
})

test('detectTracker: unknown/unrecognised remote → null (fallback)', () => {
	assert.equal(detectTracker('https://bitbucket.org/org/repo.git'), null)
})

// --- deducePrStrategy ---

test('deducePrStrategy: github tracker → squash merge strategy', () => {
	assert.equal(deducePrStrategy('github'), 'squash')
})

test('deducePrStrategy: ado tracker → squash merge strategy', () => {
	assert.equal(deducePrStrategy('ado'), 'squash')
})

test('deducePrStrategy: jira tracker → merge strategy (fallback)', () => {
	assert.equal(deducePrStrategy('jira'), 'merge')
})

test('deducePrStrategy: local-markdown tracker → merge strategy (fallback)', () => {
	assert.equal(deducePrStrategy('local-markdown'), 'merge')
})

test('deducePrStrategy: unknown tracker → merge strategy (fallback)', () => {
	assert.equal(deducePrStrategy('unknown-tracker'), 'merge')
})

// --- detectRepoLayout ---

test('detectRepoLayout: CONTEXT-MAP.md present → multi-context', () => {
	const dir = join(tmpdir(), `unic-dlc-layout-multi-${Date.now()}`)
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, 'CONTEXT-MAP.md'), '# Context Map')
	assert.equal(detectRepoLayout(dir), 'multi-context')
})

test('detectRepoLayout: CONTEXT-MAP.md absent → single-context', () => {
	const dir = join(tmpdir(), `unic-dlc-layout-single-${Date.now()}`)
	mkdirSync(dir, { recursive: true })
	assert.equal(detectRepoLayout(dir), 'single-context')
})
