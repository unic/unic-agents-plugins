// @ts-check

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runInstall } from '../lib/install-runner.mjs'

test('fresh install: partialAnswers provides all mandatory fields, defaults applied', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-fresh-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	const result = runInstall(dir, { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow' })

	assert.ok(result.ok, `expected ok:true but got ${result.ok === false ? result.message : ''}`)
	assert.equal(result.configPath, join(dir, '.archon', 'unic-dlc.config.json'))
	assert.equal(result.wroteDocs, true)
	assert.equal(result.wroteClaudeMd, true)

	const config = JSON.parse(readFileSync(result.configPath, 'utf8'))
	assert.equal(config.tracker, 'github')
	assert.equal(config.pr_strategy, 'squash')
	assert.equal(config.branching, 'gitflow')
	assert.equal(config.model_profile, 'balanced')
	assert.ok(existsSync(join(dir, 'docs', 'agents', 'issue-tracker.md')))
	assert.ok(existsSync(join(dir, 'CLAUDE.md')))
})

test('partial fill: existing optional fields survive merge, partialAnswers fills new field', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-partial-${Date.now()}`)
	mkdirSync(join(dir, '.archon'), { recursive: true })

	const existing = { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow', model_profile: 'fast' }
	writeFileSync(join(dir, '.archon', 'unic-dlc.config.json'), `${JSON.stringify(existing, null, 2)}\n`)

	const result = runInstall(dir, { e2e_command: 'npm test' })

	assert.ok(result.ok)
	const config = JSON.parse(readFileSync(result.configPath, 'utf8'))
	assert.equal(config.model_profile, 'fast') // existing overrides default 'balanced'
	assert.equal(config.e2e_command, 'npm test') // new field added by partialAnswers
	assert.equal(config.tracker, 'github') // mandatory preserved from existing
})

test('full config, no changes: existing values written back unchanged when partialAnswers is empty', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-full-${Date.now()}`)
	mkdirSync(join(dir, '.archon'), { recursive: true })

	const existing = { tracker: 'ado', pr_strategy: 'squash', branching: 'github-flow' }
	writeFileSync(join(dir, '.archon', 'unic-dlc.config.json'), `${JSON.stringify(existing, null, 2)}\n`)

	const result = runInstall(dir, {})

	assert.ok(result.ok)
	const config = JSON.parse(readFileSync(result.configPath, 'utf8'))
	assert.equal(config.tracker, 'ado')
	assert.equal(config.pr_strategy, 'squash')
	assert.equal(config.branching, 'github-flow')
})

test('reconfigure: partialAnswers overwrite existing fields, non-overridden fields preserved', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-reconfig-${Date.now()}`)
	mkdirSync(join(dir, '.archon'), { recursive: true })

	const existing = { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow' }
	writeFileSync(join(dir, '.archon', 'unic-dlc.config.json'), `${JSON.stringify(existing, null, 2)}\n`)

	const result = runInstall(dir, { tracker: 'ado', branching: 'github-flow' })

	assert.ok(result.ok)
	const config = JSON.parse(readFileSync(result.configPath, 'utf8'))
	assert.equal(config.tracker, 'ado') // overwritten by partialAnswers
	assert.equal(config.branching, 'github-flow') // overwritten by partialAnswers
	assert.equal(config.pr_strategy, 'squash') // preserved from existing (not in partialAnswers)
})

test('missing mandatory field after merge returns validate error without writing', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-validate-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	const result = runInstall(dir, {})

	assert.equal(result.ok, false)
	assert.ok(!result.ok)
	assert.equal(result.stage, 'validate')
	assert.ok(result.message.includes('Missing mandatory fields'))
	assert.ok(!existsSync(join(dir, '.archon', 'unic-dlc.config.json')))
})
