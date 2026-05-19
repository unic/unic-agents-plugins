// @ts-check

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDefaultLabels } from '../lib/labels-config.mjs'
import { buildCreateCommand, buildUpdateCommand, translateLabel } from '../lib/tracker-adapter.mjs'

const labels = getDefaultLabels('github')

test('translateLabel: returns canonical string as tracker string (default mapping)', () => {
	assert.equal(translateLabel('needs-triage', labels), 'needs-triage')
	assert.equal(translateLabel('ready-for-agent', labels), 'ready-for-agent')
	assert.equal(translateLabel('feature', labels), 'feature')
	assert.equal(translateLabel('p0', labels), 'p0')
})

test('translateLabel: missing key falls back to canonical name unchanged', () => {
	const empty = { state: {}, type: {}, priority: {} }
	assert.equal(translateLabel('needs-triage', empty), 'needs-triage')
	assert.equal(translateLabel('some-unknown-label', empty), 'some-unknown-label')
})

test('github: buildCreateCommand produces a valid gh CLI string', () => {
	const cmd = buildCreateCommand('github', 'Fix login bug', 'bug', 'p1', labels)
	assert.ok(cmd.startsWith('gh issue create'), `expected gh issue create, got: ${cmd}`)
	assert.ok(cmd.includes('--title'), 'should include --title flag')
	assert.ok(cmd.includes('Fix login bug'), 'should include the title')
	assert.ok(cmd.includes('--label'), 'should include --label flag')
})

test('ado: buildCreateCommand produces a valid az boards CLI string', () => {
	const adoLabels = getDefaultLabels('ado')
	const cmd = buildCreateCommand('ado', 'Add dashboard', 'feature', 'p2', adoLabels)
	assert.ok(cmd.startsWith('az boards work-item create'), `expected az boards work-item create, got: ${cmd}`)
	assert.ok(cmd.includes('Add dashboard'), 'should include the title')
})

test('jira: buildCreateCommand produces a valid jira CLI string', () => {
	const jiraLabels = getDefaultLabels('jira')
	const cmd = buildCreateCommand('jira', 'Spike authentication', 'spike', 'p0', jiraLabels)
	assert.ok(cmd.startsWith('jira issue create'), `expected jira issue create, got: ${cmd}`)
	assert.ok(cmd.includes('Spike authentication'), 'should include the title')
})

test('local-markdown: buildCreateCommand produces a file write instruction', () => {
	const lmLabels = getDefaultLabels('local-markdown')
	const cmd = buildCreateCommand('local-markdown', 'Tech debt cleanup', 'tech-debt', 'p3', lmLabels)
	assert.ok(cmd.includes('docs/issues') || cmd.includes('Status:'), `expected file write instruction, got: ${cmd}`)
})

test('github: buildUpdateCommand produces a valid gh CLI string', () => {
	const cmd = buildUpdateCommand('github', '42', 'resolved', labels)
	assert.ok(cmd.startsWith('gh issue edit'), `expected gh issue edit, got: ${cmd}`)
	assert.ok(cmd.includes('42'), 'should include the issue number')
})

test('ado: buildUpdateCommand produces a valid az boards CLI string', () => {
	const adoLabels = getDefaultLabels('ado')
	const cmd = buildUpdateCommand('ado', '99', 'resolved', adoLabels)
	assert.ok(cmd.startsWith('az boards work-item update'), `expected az boards work-item update, got: ${cmd}`)
	assert.ok(cmd.includes('99'), 'should include the issue id')
})

test('jira: buildUpdateCommand produces a valid jira CLI string', () => {
	const jiraLabels = getDefaultLabels('jira')
	const cmd = buildUpdateCommand('jira', 'PROJ-42', 'ready-for-agent', jiraLabels)
	assert.ok(cmd.startsWith('jira issue edit'), `expected jira issue edit, got: ${cmd}`)
	assert.ok(cmd.includes('PROJ-42'), 'should include the issue key')
})

test('local-markdown: buildUpdateCommand produces a human-readable instruction', () => {
	const lmLabels = getDefaultLabels('local-markdown')
	const cmd = buildUpdateCommand('local-markdown', 'fix-login', 'resolved', lmLabels)
	assert.ok(cmd.includes('Status:'), `expected Status: instruction, got: ${cmd}`)
})

test('default tracker: buildUpdateCommand falls back to gh issue edit', () => {
	const cmd = buildUpdateCommand('unknown-tracker', '7', 'closed', labels)
	assert.ok(cmd.startsWith('gh issue edit'), `expected gh fallback, got: ${cmd}`)
})
