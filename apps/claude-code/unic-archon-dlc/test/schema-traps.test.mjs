// @ts-check

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { checkSchemaTraps } from '../lib/schema-traps.mjs'

/**
 * Two jobs in one file.
 *
 * The unit tests below prove each of ADR-0011's traps actually fires — `/archon-upgrade` re-asserts
 * them on every run, and an assertion nobody tests is the same fail-open shape the traps describe.
 *
 * The last test runs the checker over the four bundled Boxes, so a future edit that reintroduces a
 * `type:` discriminator, an unpaired `approval:`, a loop missing `until`/`max_iterations`, or a
 * node-level `fresh_context:` fails CI here rather than silently at run time in a Consumer.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')
const WORKFLOWS_DIR = join(PLUGIN_ROOT, '.archon', 'workflows')

const CLEAN = `
name: sample
interactive: true
nodes:
  - id: bootstrap
    context: fresh
    prompt: |
      do the thing
  - id: run
    loop:
      fresh_context: true
      until: COMPLETE
      max_iterations: 10
      prompt: |
        iterate
  - id: gate
    approval:
      message: proceed?
`

test('a conforming workflow reports no violations', () => {
	const report = checkSchemaTraps(CLEAN)
	assert.ok(report.ok, `expected a clean report, got ${JSON.stringify(report.violations)}`)
	assert.deepEqual(report.violations, [])
})

test('a `type:` discriminator is reported', () => {
	const report = checkSchemaTraps(CLEAN.replace('  - id: bootstrap\n', '  - id: bootstrap\n    type: prompt\n'))
	assert.ok(!report.ok, 'a type: field must fail')
	assert.equal(report.violations.length, 1)
	assert.equal(report.violations[0].trap, 'type-discriminator')
	assert.equal(report.violations[0].node, 'bootstrap')
})

test('an approval node without workflow-level `interactive: true` is reported', () => {
	const report = checkSchemaTraps(CLEAN.replace('interactive: true\n', ''))
	assert.ok(!report.ok, 'an unpaired approval node must fail')
	assert.equal(report.violations.length, 1)
	assert.equal(report.violations[0].trap, 'approval-interactive')
	assert.equal(report.violations[0].node, 'gate')
})

test('a loop missing until or max_iterations is reported, one violation per missing key', () => {
	const report = checkSchemaTraps(CLEAN.replace('      until: COMPLETE\n      max_iterations: 10\n', ''))
	assert.ok(!report.ok, 'a loop missing both keys must fail')
	assert.equal(report.violations.length, 2)
	assert.deepEqual(
		report.violations.map((v) => v.trap),
		['loop-keys', 'loop-keys']
	)
	assert.ok(
		report.violations.every((v) => v.node === 'run'),
		'both violations should name the loop node'
	)
})

test('a node-level fresh_context is reported, while loop.fresh_context is not', () => {
	const report = checkSchemaTraps(CLEAN.replace('    context: fresh\n', '    fresh_context: true\n'))
	assert.ok(!report.ok, 'a node-level fresh_context must fail')
	assert.equal(report.violations.length, 1)
	assert.equal(report.violations[0].trap, 'node-fresh-context')
	assert.equal(report.violations[0].node, 'bootstrap')
})

test('unparseable or nodeless YAML is a reported violation, never a throw and never a pass', () => {
	const broken = checkSchemaTraps('name: x\n  bad: [indent')
	assert.ok(!broken.ok, 'unparseable YAML must not pass')
	assert.equal(broken.violations[0].trap, 'parse')

	const nodeless = checkSchemaTraps('name: x\n')
	assert.ok(!nodeless.ok, 'a file with no nodes: list must not pass')
	assert.equal(nodeless.violations[0].trap, 'parse')
})

test('the four bundled Box workflows conform to ADR-0011', () => {
	const files = readdirSync(WORKFLOWS_DIR)
		.filter((name) => name.endsWith('.yaml'))
		.sort()
	assert.equal(files.length, 4, `expected the four Box workflows, found ${files.join(', ')}`)

	for (const file of files) {
		const report = checkSchemaTraps(readFileSync(join(WORKFLOWS_DIR, file), 'utf8'))
		assert.ok(
			report.ok,
			`${file} violates ADR-0011: ${report.violations.map((v) => `${v.node ?? '-'} ${v.trap} — ${v.message}`).join('; ')}`
		)
	}
})
