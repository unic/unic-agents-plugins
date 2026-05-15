// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { updateAgentSkillsBlock } from '../lib/agent-docs-writer.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-claude-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

test('## Agent skills block is written on first run', () => {
	const dir = tempDir()
	writeFileSync(join(dir, 'CLAUDE.md'), '# Project\n\nSome existing content.\n')

	updateAgentSkillsBlock(dir)

	const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
	assert.ok(content.includes('## Agent skills'), 'block heading should be present')
	assert.ok(content.includes('issue-tracker.md'), 'issue-tracker link should be present')
	assert.ok(content.includes('labels.md'), 'labels link should be present')
	// Original content preserved
	assert.ok(content.includes('Some existing content.'), 'original content must not be destroyed')
})

test('## Agent skills block is refreshed idempotently — never duplicated', () => {
	const dir = tempDir()
	writeFileSync(join(dir, 'CLAUDE.md'), '# Project\n\nContent.\n')

	updateAgentSkillsBlock(dir)
	updateAgentSkillsBlock(dir)
	updateAgentSkillsBlock(dir)

	const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
	const headingMatches = (content.match(/## Agent skills/g) ?? []).length
	assert.equal(headingMatches, 1, 'heading should appear exactly once even after multiple runs')
	// Original content preserved
	assert.ok(content.includes('Content.'), 'original content must not be destroyed')
})
