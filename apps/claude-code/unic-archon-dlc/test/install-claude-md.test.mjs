// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { updateAgentSkillsBlock } from '../lib/agent-docs-writer.mjs'
import { SKILLS_BLOCK_BANNER } from '../lib/dogfood-banner.mjs'

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

test('SKILLS_BLOCK_BANNER appears inside the marker block after updateAgentSkillsBlock', () => {
	const dir = tempDir()
	writeFileSync(join(dir, 'CLAUDE.md'), '# Project\n\nSome content.\n')

	updateAgentSkillsBlock(dir)

	const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
	const begin = content.indexOf('<!-- unic-archon-dlc:begin -->')
	const end = content.indexOf('<!-- unic-archon-dlc:end -->')
	assert.ok(begin !== -1 && end !== -1, 'markers must be present')
	const block = content.slice(begin, end)
	assert.ok(block.includes(SKILLS_BLOCK_BANNER), 'SKILLS_BLOCK_BANNER must appear inside the marker block')
	// Surrounding content preserved
	assert.ok(content.includes('Some content.'), 'original content must not be destroyed')
})

test('SKILLS_BLOCK_BANNER appears exactly once inside the block after multiple updateAgentSkillsBlock runs', () => {
	const dir = tempDir()
	writeFileSync(join(dir, 'CLAUDE.md'), '# Project\n\nContent.\n')

	updateAgentSkillsBlock(dir)
	updateAgentSkillsBlock(dir)
	updateAgentSkillsBlock(dir)

	const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
	const begin = content.indexOf('<!-- unic-archon-dlc:begin -->')
	const end = content.indexOf('<!-- unic-archon-dlc:end -->')
	const block = content.slice(begin, end)
	const bannerCount = (block.match(/AUTO-GENERATED/g) ?? []).length
	assert.equal(bannerCount, 1, 'SKILLS_BLOCK_BANNER must appear exactly once inside the block')
})
