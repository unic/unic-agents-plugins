// @ts-check

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { initFindingsDir, readFindingsMd, writeFindingsMd } from '../lib/findings-writer.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-fw-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

// --- initFindingsDir ---

test('initFindingsDir creates docs/workflow/<slug>/ on first call and returns path', () => {
	const projectDir = tempDir()
	const slug = 'my-feature'
	const result = initFindingsDir(projectDir, slug)

	assert.equal(result, join(projectDir, 'docs', 'workflow', slug))
	assert.ok(existsSync(result), 'directory should exist after initFindingsDir')
})

test('initFindingsDir second call with same slug returns same path without destroying contents', () => {
	const projectDir = tempDir()
	const slug = 'existing-feature'

	const first = initFindingsDir(projectDir, slug)

	// Write a sentinel file inside the directory
	const sentinel = join(first, 'sentinel.txt')
	writeFileSync(sentinel, 'do not destroy me')

	const second = initFindingsDir(projectDir, slug)

	assert.equal(first, second, 'should return the same path both times')
	assert.ok(existsSync(sentinel), 'sentinel file must still exist after second call')
	assert.equal(readFileSync(sentinel, 'utf8'), 'do not destroy me', 'file contents must be unchanged')
})

// --- writeFindingsMd ---

test('writeFindingsMd writes a findings.md with all required sections', () => {
	const projectDir = tempDir()
	const slug = 'new-project'
	const findingsDir = initFindingsDir(projectDir, slug)

	writeFindingsMd(findingsDir, {
		stack: 'Node.js 22, pnpm 10, Biome 2',
		features: 'Issue tracking, HANDOFF.md generation',
		architecture: 'Pure function modules, no external deps',
		pitfalls: 'Windows path separators, large monorepos',
		brief: 'Minimal plugin that bridges Archon and Claude Code',
	})

	const content = readFileSync(join(findingsDir, 'findings.md'), 'utf8')

	assert.ok(content.includes('Stack') || content.includes('stack'), 'should have Stack section')
	assert.ok(content.includes('Node.js 22'), 'should include stack content')
	assert.ok(content.includes('Features') || content.includes('features'), 'should have Features section')
	assert.ok(content.includes('Issue tracking'), 'should include features content')
	assert.ok(content.includes('Architecture') || content.includes('architecture'), 'should have Architecture section')
	assert.ok(content.includes('Pure function'), 'should include architecture content')
	assert.ok(content.includes('Pitfalls') || content.includes('pitfalls'), 'should have Pitfalls section')
	assert.ok(content.includes('Windows path'), 'should include pitfalls content')
	assert.ok(
		content.includes('Brief') || content.includes('brief') || content.includes('Integrated'),
		'should have Integrated Brief section'
	)
	assert.ok(content.includes('Minimal plugin'), 'should include brief content')
})

// --- readFindingsMd ---

test('readFindingsMd returns null if findings.md does not exist', () => {
	const projectDir = tempDir()
	const slug = 'no-findings'
	const findingsDir = initFindingsDir(projectDir, slug)

	const result = readFindingsMd(findingsDir)

	assert.equal(result, null, 'should return null when findings.md is absent')
})

test('readFindingsMd returns file content if findings.md exists', () => {
	const projectDir = tempDir()
	const slug = 'with-findings'
	const findingsDir = initFindingsDir(projectDir, slug)

	const expected = '# Findings\n\nSome content here.'
	writeFileSync(join(findingsDir, 'findings.md'), expected)

	const result = readFindingsMd(findingsDir)

	assert.equal(result, expected, 'should return the exact findings.md content')
})
