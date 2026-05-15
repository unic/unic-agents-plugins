// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildHandoff, updateRoadmap } from '../lib/handoff-generator.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-hf-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

test('buildHandoff produces string with all four required sections', () => {
	const snapshot = /** @type {import('../lib/handoff-generator.mjs').HandoffSnapshot} */ ({
		phase: 'build',
		openIssues: {
			'needs-triage': ['feat: add login'],
			'ready-for-agent': ['fix: null pointer in handler'],
		},
		blockers: ['fix: null pointer in handler (blocked by feat: add login)'],
		recentDecisions: ['ADR-0001-use-gitflow.md', 'ADR-0002-local-markdown.md'],
	})

	const handoff = buildHandoff(snapshot)

	assert.ok(
		handoff.includes('Current Phase') || handoff.includes('current phase') || handoff.includes('phase'),
		'should have phase section'
	)
	assert.ok(handoff.includes('build'), 'should include the phase value')
	assert.ok(
		handoff.includes('needs-triage') || handoff.includes('Open Issues') || handoff.includes('open issues'),
		'should have open issues section'
	)
	assert.ok(handoff.includes('feat: add login'), 'should include open issue title')
	assert.ok(handoff.includes('Blockers') || handoff.includes('blockers'), 'should have blockers section')
	assert.ok(handoff.includes('null pointer'), 'should include blocker description')
	assert.ok(
		handoff.includes('Decisions') || handoff.includes('decisions') || handoff.includes('ADR'),
		'should have decisions section'
	)
	assert.ok(handoff.includes('ADR-0001'), 'should include ADR reference')
})

test('updateRoadmap creates ROADMAP.md on first run', () => {
	const dir = tempDir()
	mkdirSync(join(dir, 'docs', 'workflow'), { recursive: true })

	updateRoadmap(dir, 'build')

	const roadmap = readFileSync(join(dir, 'docs', 'workflow', 'ROADMAP.md'), 'utf8')
	assert.ok(roadmap.includes('build'), 'ROADMAP.md should mention the current phase')
})

test('updateRoadmap re-run updates marker region without clobbering human content', () => {
	const dir = tempDir()
	mkdirSync(join(dir, 'docs', 'workflow'), { recursive: true })

	// Write ROADMAP.md with some human content
	writeFileSync(join(dir, 'docs', 'workflow', 'ROADMAP.md'), '# Project Roadmap\n\nHuman notes here.\n')

	updateRoadmap(dir, 'plan')
	updateRoadmap(dir, 'build')

	const roadmap = readFileSync(join(dir, 'docs', 'workflow', 'ROADMAP.md'), 'utf8')
	assert.ok(roadmap.includes('Human notes here.'), 'human content must be preserved')
	assert.ok(roadmap.includes('build'), 'latest phase should be reflected')
	// Status block should appear only once
	const blockMatches = (roadmap.match(/unic-archon-dlc:begin/g) ?? []).length
	assert.equal(blockMatches, 1, 'marker block should appear exactly once')
})
