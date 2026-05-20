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

test('partial config: optional fields preserved when mandatory fields are missing from existing file', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-partialopt-${Date.now()}`)
	mkdirSync(join(dir, '.archon'), { recursive: true })

	// File has optional fields but is missing all mandatory fields
	const partial = { e2e_command: 'pnpm test', model_profile: 'fast' }
	writeFileSync(join(dir, '.archon', 'unic-dlc.config.json'), `${JSON.stringify(partial, null, 2)}\n`)

	// partialAnswers supplies the missing mandatory fields
	const result = runInstall(dir, { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow' })

	assert.ok(result.ok, `expected ok:true but got ${result.ok === false ? result.message : ''}`)
	const config = JSON.parse(readFileSync(result.configPath, 'utf8'))
	assert.equal(config.e2e_command, 'pnpm test') // optional field preserved
	assert.equal(config.model_profile, 'fast') // optional field preserved (overrides default)
	assert.equal(config.tracker, 'github') // mandatory field from partialAnswers
})

test('writeAgentDocs failure: error message includes config path confirmation', async () => {
	// We spy on writeAgentDocs by using a writable temp dir for config but a non-existent
	// parent for docs/ — we make docs/ itself a file so writeAgentDocs cannot create it.
	const { mkdirSync: mkdir, writeFileSync: wf, readFileSync: rf, existsSync: ef } = await import('node:fs')
	const dir = join(tmpdir(), `unic-dlc-runner-docserr-${Date.now()}`)
	mkdir(dir, { recursive: true })

	// Block docs/agents/ by making docs/ a file (not a directory)
	wf(join(dir, 'docs'), 'not-a-directory')

	const result = runInstall(dir, { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow' })

	// Config should have been written
	assert.ok(ef(join(dir, '.archon', 'unic-dlc.config.json')), 'config file should exist')

	assert.equal(result.ok, false)
	assert.ok(!result.ok)
	assert.equal(result.stage, 'docs')
	assert.ok(
		result.message.includes('Config written to'),
		`Expected "Config written to" in message, got: ${result.message}`
	)

	void rf
})

test('corrupt config: invalid JSON returns config stage error with parse message', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-corrupt-${Date.now()}`)
	mkdirSync(join(dir, '.archon'), { recursive: true })

	// Write deliberately broken JSON
	writeFileSync(join(dir, '.archon', 'unic-dlc.config.json'), '{ not valid json !!!')

	const result = runInstall(dir, { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow' })

	assert.equal(result.ok, false)
	assert.equal(result.stage, 'config')
	assert.ok(result.message.includes('invalid JSON'), `Expected "invalid JSON" in message, got: ${result.message}`)
	assert.ok(result.message.includes('Parse error:'), `Expected "Parse error:" in message, got: ${result.message}`)
})

test('updateAgentSkillsBlock failure: stage is claude-md and message includes config/docs confirmation', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-claudemderr-${Date.now()}`)
	mkdirSync(dir, { recursive: true })

	// Block CLAUDE.md from being written by pre-creating it as a directory
	mkdirSync(join(dir, 'CLAUDE.md'))

	const result = runInstall(dir, { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow' })

	assert.equal(result.ok, false)
	assert.equal(result.stage, 'claude-md')
	assert.ok(
		result.message.includes('Config and docs written'),
		`Expected "Config and docs written" in message, got: ${result.message}`
	)
})

test('custom labels in existing config are preserved on reconfigure', () => {
	const dir = join(tmpdir(), `unic-dlc-runner-labels-${Date.now()}`)
	mkdirSync(join(dir, '.archon'), { recursive: true })

	// Valid LabelMapping shape with custom tracker strings (different from defaults)
	const customLabels = {
		state: {
			'needs-triage': 'triage',
			'needs-info': 'info',
			'needs-specs': 'spec',
			'ready-for-agent': 'agent',
			'ready-for-human': 'human',
			resolved: 'done',
			closed: 'closed',
			rejected: 'wont-fix',
		},
		type: { feature: 'enhancement', bug: 'defect', spike: 'spike', 'tech-debt': 'debt', docs: 'docs' },
		priority: { p0: 'critical', p1: 'high', p2: 'medium', p3: 'low' },
	}
	const existing = { tracker: 'github', pr_strategy: 'squash', branching: 'gitflow', labels: customLabels }
	writeFileSync(join(dir, '.archon', 'unic-dlc.config.json'), `${JSON.stringify(existing, null, 2)}\n`)

	const result = runInstall(dir, {})

	assert.ok(result.ok, `expected ok:true but got ${result.ok === false ? result.message : ''}`)
	const config = JSON.parse(readFileSync(result.configPath, 'utf8'))
	assert.deepEqual(config.labels, customLabels, 'custom labels should be preserved')
})
