// @ts-check

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DEFAULT_PRD_HEADINGS, readPrd, validatePrdSections, writePrd } from '../lib/prd-writer.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-prd-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

const FULL_PRD = `# Product Requirements Document

## Problem Statement
The current setup requires manual steps.

## Solution
Automate via a workflow YAML DAG.

## User Stories
As a developer, I want to run a single command.

## Implementation Decisions
Use pure ESM modules, no external deps.

## Testing Decisions
node:test with tmp dirs; no mocks.

## Out of Scope
GUI tooling, cloud deployments.

## Further Notes
Revisit after v1 ships.
`

// --- writePrd ---

test('writePrd creates <artifacts_dir>/<slug>/PRD.md (default workflows/)', () => {
	const projectDir = tempDir()
	writePrd(projectDir, 'my-feature', FULL_PRD)

	const prdPath = join(projectDir, 'workflows', 'my-feature', 'PRD.md')
	assert.ok(existsSync(prdPath), 'PRD.md must exist under workflows/<slug>/')
})

test('writePrd writes the exact content it is given', () => {
	const projectDir = tempDir()
	writePrd(projectDir, 'content-check', FULL_PRD)

	const content = readFileSync(join(projectDir, 'workflows', 'content-check', 'PRD.md'), 'utf8')
	assert.equal(content, FULL_PRD, 'PRD.md content should match the string passed to writePrd')
})

test('writePrd creates intermediate directories if absent', () => {
	const projectDir = tempDir()
	const slug = 'deep-feature'
	assert.ok(!existsSync(join(projectDir, 'workflows', slug)), 'dir should not exist before call')

	writePrd(projectDir, slug, FULL_PRD)

	assert.ok(
		existsSync(join(projectDir, 'workflows', slug, 'PRD.md')),
		'PRD.md should be created with intermediate dirs'
	)
})

test('writePrd honours a custom artifactsDir', () => {
	const projectDir = tempDir()
	writePrd(projectDir, 'custom-dir', FULL_PRD, 'artifacts')

	assert.ok(
		existsSync(join(projectDir, 'artifacts', 'custom-dir', 'PRD.md')),
		'PRD.md should land under the custom dir'
	)
	assert.ok(!existsSync(join(projectDir, 'workflows', 'custom-dir', 'PRD.md')), 'default dir should not be used')
})

// --- readPrd ---

test('readPrd returns null if PRD.md does not exist', () => {
	const projectDir = tempDir()
	assert.equal(readPrd(projectDir, 'no-prd'), null, 'should return null when PRD.md is absent')
})

test('readPrd returns PRD.md content if it exists', () => {
	const projectDir = tempDir()
	const slug = 'existing-prd'
	const dir = join(projectDir, 'workflows', slug)
	mkdirSync(dir, { recursive: true })
	const expected = '# PRD\n\nSome content.'
	writeFileSync(join(dir, 'PRD.md'), expected)

	assert.equal(readPrd(projectDir, slug), expected, 'should return exact PRD.md content')
})

test('readPrd honours a custom artifactsDir', () => {
	const projectDir = tempDir()
	writePrd(projectDir, 'roundtrip', FULL_PRD, 'artifacts')

	assert.equal(readPrd(projectDir, 'roundtrip', 'artifacts'), FULL_PRD, 'read should mirror the custom write dir')
	assert.equal(readPrd(projectDir, 'roundtrip'), null, 'default dir should not find the custom-dir PRD')
})

// --- validatePrdSections ---

test('DEFAULT_PRD_HEADINGS exposes the seven canonical headings', () => {
	assert.equal(DEFAULT_PRD_HEADINGS.length, 7, 'there should be seven canonical PRD headings')
})

test('validatePrdSections returns valid=true for a PRD with all 7 default headings', () => {
	const result = validatePrdSections(FULL_PRD)
	assert.equal(result.valid, true, 'should be valid')
	assert.deepEqual(result.missingSections, [], 'no missing sections')
})

test('validatePrdSections returns valid=false and lists missing default headings', () => {
	const content = `# Product Requirements Document

## Problem Statement
Only this section.
`
	const result = validatePrdSections(content)
	assert.equal(result.valid, false, 'should not be valid')
	assert.ok(result.missingSections.includes('Solution'), 'Solution should be missing')
	assert.ok(result.missingSections.includes('Further Notes'), 'Further Notes should be missing')
	assert.ok(!result.missingSections.includes('Problem Statement'), 'Problem Statement should not be listed as missing')
})

test('validatePrdSections returns valid=false with all 7 default headings missing for empty content', () => {
	const result = validatePrdSections('')
	assert.equal(result.valid, false, 'empty content is not valid')
	assert.equal(result.missingSections.length, 7, 'all 7 sections should be missing')
})

test('validatePrdSections accepts a custom heading set', () => {
	const content = '# Spec\n\n## Goal\nDo the thing.\n\n## Risks\nNone.\n'
	const ok = validatePrdSections(content, ['Goal', 'Risks'])
	assert.equal(ok.valid, true, 'custom headings present → valid')

	const bad = validatePrdSections(content, ['Goal', 'Rollback'])
	assert.equal(bad.valid, false, 'a missing custom heading → invalid')
	assert.deepEqual(bad.missingSections, ['Rollback'], 'lists the missing custom heading')
})
