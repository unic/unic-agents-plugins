// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

/**
 * Structural guards for `/archon-upgrade`.
 *
 * Everything asserted here is what a reader cannot verify by running the command: it produces a
 * report, so a dropped citation or a quietly-granted write tool looks exactly like a correct run.
 *
 * The assertions are dumb string checks on purpose, in the style of `command-methods.test.mjs` — a
 * command file is a prompt, not code, and a clever parser would have failure modes of its own. Prose
 * matches run against a whitespace-normalised copy, so a Prettier rewrap cannot break them, but a
 * dropped citation still can.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

const COMMAND = readFileSync(join(PLUGIN_ROOT, 'commands', 'archon-upgrade.md'), 'utf8')

/** Collapse every whitespace run to one space — line wrapping is Prettier's, not the author's. */
const FLAT = COMMAND.replace(/\s+/g, ' ')

/** The frontmatter block, alone. `Write` in the prose is not a granted tool. */
const FRONTMATTER = COMMAND.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''

test('the command declares Bash and no write-capable tool (AC 7)', () => {
	assert.ok(FRONTMATTER, 'commands/archon-upgrade.md must open with a frontmatter block')
	assert.match(FRONTMATTER, /allowed-tools:.*'Bash'/, 'allowed-tools must grant Bash')
	for (const tool of ['Write', 'Edit', 'NotebookEdit']) {
		assert.ok(
			!FRONTMATTER.includes(tool),
			`allowed-tools grants ${tool} — /archon-upgrade is read-only by design (ADR-0035)`
		)
	}
})

test('the command cites every ADR its design rests on', () => {
	const adrs = [
		'docs/adr/0011-archon-schema-target.md',
		'docs/adr/0017-container-follows-structural-need.md',
		'docs/adr/0033-archon-070-schema-target.md',
		'docs/adr/0034-evidence-gate-deterministic-writer.md',
		'docs/adr/0035-archon-upgrade-report.md',
	]
	for (const adr of adrs) {
		assert.ok(COMMAND.includes(adr), `commands/archon-upgrade.md must link ${adr}`)
	}
})

test('the DEFER precedent cites ADR-0033 § Sub-runs rather than restating its trigger', () => {
	// AMENDMENT 2 (#291): the row cites the recorded trigger. A run that re-derives or paraphrases it
	// grows a second, drifting trigger — which is the failure this citation exists to prevent.
	assert.ok(FLAT.includes('ADR-0033 § Sub-runs'), 'the DEFER precedent must cite ADR-0033 § Sub-runs by name')
	assert.match(FLAT, /classify DEFER/, 'the sub-run precedent must name its classification')
})

test('the repository-derivation precedent is VERIFY-ONLY, never BREAKS-US', () => {
	// AMENDMENT 3 (#291): the divergence is deliberate and recorded. Classifying it BREAKS-US would
	// make every run re-raise a settled decision.
	assert.ok(
		FLAT.includes('ADR-0033 § "Repository derivation'),
		'the divergence precedent must cite ADR-0033 § "Repository derivation…"'
	)
	assert.match(FLAT, /classify VERIFY-ONLY, never BREAKS-US/, 'the divergence must be classified VERIFY-ONLY')
})

test('the command names all four classifications and the changed-defaults pass', () => {
	for (const bucket of ['ADOPT', 'DEFER', 'VERIFY-ONLY', 'BREAKS-US']) {
		assert.ok(COMMAND.includes(bucket), `commands/archon-upgrade.md must define the ${bucket} classification`)
	}
	// AC 4: a new-field-only scan misses a removed default a Box still assumes — both real 0.7.0
	// defects were that shape, so the lens gets its own named sub-pass.
	for (const phrase of ['changed default', 'removed', 'deprecated', 'no longer']) {
		assert.ok(FLAT.includes(phrase), `the changed-defaults sub-pass must look for "${phrase}" language`)
	}
})

test('the trap re-assertion runs through the tested lib, over the bundled Boxes', () => {
	// AC 5. A regex inlined in the prompt would be untested and would fail open — the exact class of
	// defect ADR-0011's traps describe.
	assert.ok(COMMAND.includes('lib/schema-traps.mjs'), 'Step 5 must call lib/schema-traps.mjs')
	assert.ok(
		COMMAND.includes('$CLAUDE_PLUGIN_ROOT/.archon/workflows/'),
		'the trap pass must read the BUNDLED Boxes, not a Consumer copy'
	)
})

test('the report closes by stating that nothing was written (AC 7)', () => {
	assert.ok(
		FLAT.includes('This command wrote nothing.'),
		'the closing line must state plainly that the command wrote nothing'
	)
})

test('README.md and AGENTS.md list the box (AC 8)', () => {
	for (const doc of ['README.md', 'AGENTS.md']) {
		const contents = readFileSync(join(PLUGIN_ROOT, doc), 'utf8')
		assert.ok(contents.includes('`/archon-upgrade`'), `${doc} must list \`/archon-upgrade\` in its box set`)
	}
})
