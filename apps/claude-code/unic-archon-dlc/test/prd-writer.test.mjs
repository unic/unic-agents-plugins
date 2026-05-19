// @ts-check

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readPrd, validatePrdSections, writePrd } from '../lib/prd-writer.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-prd-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

const FULL_SECTIONS = {
	problemStatement: 'The current setup requires manual steps.',
	solution: 'Automate via a workflow YAML DAG.',
	userStories: 'As a developer, I want to run a single command.',
	implementationDecisions: 'Use pure ESM modules, no external deps.',
	testingDecisions: 'node:test with tmp dirs; no mocks.',
	outOfScope: 'GUI tooling, cloud deployments.',
	furtherNotes: 'Revisit after v1 ships.',
}

// --- writePrd ---

test('writePrd creates docs/workflow/<slug>/PRD.md with all 7 sections', () => {
	const projectDir = tempDir()
	writePrd(projectDir, 'my-feature', FULL_SECTIONS)

	const prdPath = join(projectDir, 'docs', 'workflow', 'my-feature', 'PRD.md')
	assert.ok(existsSync(prdPath), 'PRD.md must exist after writePrd')

	const content = readFileSync(prdPath, 'utf8')

	assert.ok(content.includes('Problem Statement'), 'should contain Problem Statement heading')
	assert.ok(content.includes('Solution'), 'should contain Solution heading')
	assert.ok(content.includes('User Stories'), 'should contain User Stories heading')
	assert.ok(content.includes('Implementation Decisions'), 'should contain Implementation Decisions heading')
	assert.ok(content.includes('Testing Decisions'), 'should contain Testing Decisions heading')
	assert.ok(content.includes('Out of Scope'), 'should contain Out of Scope heading')
	assert.ok(content.includes('Further Notes'), 'should contain Further Notes heading')
})

test('writePrd writes actual section content into PRD.md', () => {
	const projectDir = tempDir()
	writePrd(projectDir, 'content-check', FULL_SECTIONS)

	const prdPath = join(projectDir, 'docs', 'workflow', 'content-check', 'PRD.md')
	const content = readFileSync(prdPath, 'utf8')

	assert.ok(content.includes('The current setup requires manual steps.'), 'problemStatement body present')
	assert.ok(content.includes('Automate via a workflow YAML DAG.'), 'solution body present')
	assert.ok(content.includes('As a developer, I want to run a single command.'), 'userStories body present')
	assert.ok(content.includes('Use pure ESM modules, no external deps.'), 'implementationDecisions body present')
	assert.ok(content.includes('node:test with tmp dirs; no mocks.'), 'testingDecisions body present')
	assert.ok(content.includes('GUI tooling, cloud deployments.'), 'outOfScope body present')
	assert.ok(content.includes('Revisit after v1 ships.'), 'furtherNotes body present')
})

test('writePrd creates intermediate directories if absent', () => {
	const projectDir = tempDir()
	const slug = 'deep-feature'
	// Directory does not exist yet
	assert.ok(!existsSync(join(projectDir, 'docs', 'workflow', slug)), 'dir should not exist before call')

	writePrd(projectDir, slug, FULL_SECTIONS)

	const prdPath = join(projectDir, 'docs', 'workflow', slug, 'PRD.md')
	assert.ok(existsSync(prdPath), 'PRD.md should be created including intermediate dirs')
})

// --- readPrd ---

test('readPrd returns null if PRD.md does not exist', () => {
	const projectDir = tempDir()
	const result = readPrd(projectDir, 'no-prd')
	assert.equal(result, null, 'should return null when PRD.md is absent')
})

test('readPrd returns PRD.md content if it exists', () => {
	const projectDir = tempDir()
	const slug = 'existing-prd'
	const prdDir = join(projectDir, 'docs', 'workflow', slug)
	mkdirSync(prdDir, { recursive: true })
	const expected = '# PRD\n\nSome content.'
	writeFileSync(join(prdDir, 'PRD.md'), expected)

	const result = readPrd(projectDir, slug)
	assert.equal(result, expected, 'should return exact PRD.md content')
})

// --- validatePrdSections ---

test('validatePrdSections returns valid=true for a PRD with all 7 headings', () => {
	const content = `# Product Requirements Document

## Problem Statement
The current setup is manual.

## Solution
Automate it.

## User Stories
As a user...

## Implementation Decisions
Use ESM modules.

## Testing Decisions
Use node:test.

## Out of Scope
GUI tooling.

## Further Notes
Revisit later.
`
	const result = validatePrdSections(content)
	assert.equal(result.valid, true, 'should be valid')
	assert.deepEqual(result.missingSections, [], 'no missing sections')
})

test('validatePrdSections returns valid=false and lists missing sections when headings absent', () => {
	const content = `# Product Requirements Document

## Problem Statement
Only this section.
`
	const result = validatePrdSections(content)
	assert.equal(result.valid, false, 'should not be valid')
	assert.ok(result.missingSections.includes('Solution'), 'Solution should be missing')
	assert.ok(result.missingSections.includes('User Stories'), 'User Stories should be missing')
	assert.ok(result.missingSections.includes('Implementation Decisions'), 'Implementation Decisions should be missing')
	assert.ok(result.missingSections.includes('Testing Decisions'), 'Testing Decisions should be missing')
	assert.ok(result.missingSections.includes('Out of Scope'), 'Out of Scope should be missing')
	assert.ok(result.missingSections.includes('Further Notes'), 'Further Notes should be missing')
	assert.ok(!result.missingSections.includes('Problem Statement'), 'Problem Statement should not be listed as missing')
})

test('validatePrdSections returns valid=false with all sections missing for empty content', () => {
	const result = validatePrdSections('')
	assert.equal(result.valid, false, 'empty content is not valid')
	assert.equal(result.missingSections.length, 7, 'all 7 sections should be missing')
})
