// @ts-check

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { appendSpikeVerdicts, parseSpikeVerdicts } from '../lib/spike-verdicts.mjs'

let _seq = 0
function tempDir() {
	const p = join(tmpdir(), `unic-dlc-sv-${Date.now()}-${++_seq}`)
	mkdirSync(p, { recursive: true })
	return p
}

// --- appendSpikeVerdicts ---

test('appendSpikeVerdicts on new findings.md adds ## Spike verdicts section', () => {
	const dir = tempDir()
	writeFileSync(join(dir, 'findings.md'), '# Research Findings\n\n## Stack\n\nNode.js 22\n')

	const verdicts = [
		{
			title: 'Try streaming parser',
			verdict: /** @type {'VALIDATED'} */ ('VALIDATED'),
			notes: 'Works within memory budget.',
		},
	]
	appendSpikeVerdicts(dir, verdicts)

	const content = readFileSync(join(dir, 'findings.md'), 'utf8')
	assert.ok(content.includes('## Spike verdicts'), 'should have ## Spike verdicts heading')
	assert.ok(content.includes('### Experiment 1: Try streaming parser'), 'should have experiment heading')
	assert.ok(content.includes('**Verdict:** VALIDATED'), 'should include the verdict')
	assert.ok(content.includes('Works within memory budget.'), 'should include the notes')
})

test('appendSpikeVerdicts called twice replaces existing section, does not duplicate', () => {
	const dir = tempDir()
	writeFileSync(join(dir, 'findings.md'), '# Research Findings\n\n## Stack\n\nNode.js 22\n')

	const first = [
		{ title: 'First experiment', verdict: /** @type {'INVALIDATED'} */ ('INVALIDATED'), notes: 'Too slow.' },
	]
	appendSpikeVerdicts(dir, first)

	const second = [
		{ title: 'Second experiment', verdict: /** @type {'PARTIAL'} */ ('PARTIAL'), notes: 'Needs more work.' },
	]
	appendSpikeVerdicts(dir, second)

	const content = readFileSync(join(dir, 'findings.md'), 'utf8')

	// Only one ## Spike verdicts heading
	const sectionCount = (content.match(/^## Spike verdicts/gm) ?? []).length
	assert.equal(sectionCount, 1, 'should have exactly one ## Spike verdicts section after two calls')

	// Second experiment present, first not
	assert.ok(content.includes('Second experiment'), 'should contain second experiment title')
	assert.ok(!content.includes('First experiment'), 'should NOT contain first experiment title after replacement')
})

test('appendSpikeVerdicts handles multiple verdicts with correct numbering', () => {
	const dir = tempDir()
	writeFileSync(join(dir, 'findings.md'), '# Research Findings\n\n## Integrated Brief\n\nSome brief.\n')

	const verdicts = [
		{ title: 'Alpha', verdict: /** @type {'VALIDATED'} */ ('VALIDATED'), notes: 'Alpha notes.' },
		{ title: 'Beta', verdict: /** @type {'INVALIDATED'} */ ('INVALIDATED'), notes: 'Beta notes.' },
		{ title: 'Gamma', verdict: /** @type {'PARTIAL'} */ ('PARTIAL'), notes: 'Gamma notes.' },
	]
	appendSpikeVerdicts(dir, verdicts)

	const content = readFileSync(join(dir, 'findings.md'), 'utf8')
	assert.ok(content.includes('### Experiment 1: Alpha'), 'first experiment numbered 1')
	assert.ok(content.includes('### Experiment 2: Beta'), 'second experiment numbered 2')
	assert.ok(content.includes('### Experiment 3: Gamma'), 'third experiment numbered 3')
	assert.ok(content.includes('**Verdict:** VALIDATED'), 'VALIDATED verdict present')
	assert.ok(content.includes('**Verdict:** INVALIDATED'), 'INVALIDATED verdict present')
	assert.ok(content.includes('**Verdict:** PARTIAL'), 'PARTIAL verdict present')
})

// --- parseSpikeVerdicts ---

test('parseSpikeVerdicts returns empty array when no ## Spike verdicts section exists', () => {
	const content = '# Research Findings\n\n## Stack\n\nNode.js 22\n'
	const result = parseSpikeVerdicts(content)
	assert.deepEqual(result, [])
})

test('parseSpikeVerdicts parses verdicts from findings.md content', () => {
	const content = `# Research Findings

## Stack

Node.js 22

## Spike verdicts

### Experiment 1: Try streaming parser
**Verdict:** VALIDATED
Works within memory budget.

### Experiment 2: Naive approach
**Verdict:** INVALIDATED
Exceeded 512 MB limit.
`
	const result = parseSpikeVerdicts(content)

	assert.equal(result.length, 2, 'should parse two verdicts')
	assert.equal(result[0].title, 'Try streaming parser')
	assert.equal(result[0].verdict, 'VALIDATED')
	assert.ok(result[0].notes.includes('Works within memory budget.'))
	assert.equal(result[1].title, 'Naive approach')
	assert.equal(result[1].verdict, 'INVALIDATED')
	assert.ok(result[1].notes.includes('Exceeded 512 MB limit.'))
})

test('parseSpikeVerdicts handles PARTIAL verdict', () => {
	const content = `## Spike verdicts

### Experiment 1: Hybrid approach
**Verdict:** PARTIAL
Some parts work, needs refinement.
`
	const result = parseSpikeVerdicts(content)
	assert.equal(result.length, 1)
	assert.equal(result[0].verdict, 'PARTIAL')
	assert.equal(result[0].title, 'Hybrid approach')
})

test('each verdict in parseSpikeVerdicts result has exactly one of VALIDATED | INVALIDATED | PARTIAL', () => {
	const content = `## Spike verdicts

### Experiment 1: A
**Verdict:** VALIDATED
Notes A.

### Experiment 2: B
**Verdict:** INVALIDATED
Notes B.

### Experiment 3: C
**Verdict:** PARTIAL
Notes C.
`
	const valid = new Set(['VALIDATED', 'INVALIDATED', 'PARTIAL'])
	const result = parseSpikeVerdicts(content)

	assert.equal(result.length, 3)
	for (const v of result) {
		assert.ok(valid.has(v.verdict), `verdict '${v.verdict}' must be one of VALIDATED|INVALIDATED|PARTIAL`)
	}
})
