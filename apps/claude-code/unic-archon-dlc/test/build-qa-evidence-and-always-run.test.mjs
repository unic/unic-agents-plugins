// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

/**
 * Structural regression guards for #290's two runtime-only additions (evidence gate,
 * `always_run` placement). Neither is importable: an Archon Box node is self-contained and
 * imports nothing from the Plugin (ADR-0023 §5), so the `evidence` node's delete/withhold/write
 * logic cannot be extracted into `lib/` and unit-tested the way `resolveArchonRemote` was
 * (`commands/setup.md` is a Claude Code command, not an Archon node, so no such restriction
 * applied there). These are dumb string/ordering checks against the YAML source, in the same
 * style as `box-staging-and-repo-pinning.test.mjs` — not a substitute for the live-Consumer
 * behavioural run the code-review findings flag as still outstanding, but enough to catch a
 * future edit that silently reorders the delete-before-write sequence, inverts the withhold
 * guard, or moves `always_run: true` onto (or off) the wrong node.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

/** @param {string} name @returns {string} */
function readWorkflow(name) {
	return readFileSync(join(PLUGIN_ROOT, '.archon', 'workflows', `${name}.yaml`), 'utf8').replace(/\r\n/g, '\n')
}

/**
 * The source of a single node, from just after its `- id: <nodeId>` line up to (not including)
 * the next node's `- id:` line.
 * @param {string} contents
 * @param {string} nodeId
 * @returns {string | undefined}
 */
function nodeSource(contents, nodeId) {
	return contents.split(`- id: ${nodeId}\n`)[1]?.split('\n  - id: ')[0]
}

/**
 * Every node id in `contents` whose own body sets `always_run: true` as a live field — comment
 * lines are stripped first so a neighbouring node's explanatory comment (e.g. `evidence`'s always
 * sits just above its own `- id:` line, inside the PRECEDING node's split block) can never be
 * mistaken for that preceding node's own setting.
 * @param {string} contents
 * @returns {string[]}
 */
function alwaysRunNodeIds(contents) {
	const blocks = contents.split('\n  - id: ').slice(1)
	const ids = []
	for (const block of blocks) {
		const id = block.split('\n')[0].trim()
		const codeOnly = block
			.split('\n')
			.filter((line) => !/^\s*#/.test(line))
			.join('\n')
		if (/always_run:\s*true/.test(codeOnly)) ids.push(id)
	}
	return ids
}

test('evidence node deletes any stale file before evaluating the withhold guard', () => {
	const evidence = nodeSource(readWorkflow('unic-dlc-build'), 'evidence')
	assert.ok(evidence, 'unic-dlc-build.yaml lost its evidence node')
	const deleteIndex = evidence.indexOf('rmSync(evidencePath)')
	const guardIndex = evidence.indexOf('if (!verificationPassed || !goalsCheckPassed)')
	assert.ok(deleteIndex !== -1, 'evidence node lost its delete-first step (ADR-0034)')
	assert.ok(guardIndex !== -1, 'evidence node lost its withhold guard, or the guard condition changed shape')
	assert.ok(
		deleteIndex < guardIndex,
		'evidence node must delete the stale file BEFORE evaluating the withhold guard — a resumed run must never let a stale file outlive a fresh failing attempt'
	)
})

test('evidence node deletes the mirrored copy too, before the withhold guard', () => {
	const evidence = nodeSource(readWorkflow('unic-dlc-build'), 'evidence')
	assert.ok(evidence, 'unic-dlc-build.yaml lost its evidence node')
	const deleteIndex = evidence.indexOf('rmSync(mirrorPath)')
	const guardIndex = evidence.indexOf('if (!verificationPassed || !goalsCheckPassed)')
	assert.ok(deleteIndex !== -1, 'evidence node lost the mirror delete step (ADR-0034)')
	assert.ok(
		deleteIndex < guardIndex,
		'the mirror must be deleted BEFORE the withhold guard — the engine presence gate reads only the $ARTIFACTS_DIR copy, so a stale mirror survives an engine refusal and open-pr stages it'
	)
})

test('evidence node only writes when both verification and goals-check passed', () => {
	const evidence = nodeSource(readWorkflow('unic-dlc-build'), 'evidence')
	assert.ok(evidence, 'unic-dlc-build.yaml lost its evidence node')
	const guardIndex = evidence.indexOf('if (!verificationPassed || !goalsCheckPassed)')
	const writeIndex = evidence.indexOf('writeFileSync(evidencePath')
	assert.ok(writeIndex !== -1, 'evidence node lost its write step')
	assert.ok(guardIndex < writeIndex, 'the withhold guard must run BEFORE the write, not after')
	assert.match(
		evidence,
		/process\.exit\(0\)/,
		'evidence node must exit 0 on withhold — a non-zero exit here would fail the whole run rather than just skipping the gate'
	)
})

test('always_run lands on exactly the nodes named in the PR description, per workflow', () => {
	assert.deepEqual(
		alwaysRunNodeIds(readWorkflow('unic-dlc-build')).sort(),
		['evidence', 'goals-check', 'slopcheck', 'verification'].sort(),
		'unic-dlc-build.yaml: always_run must land on exactly slopcheck, verification, goals-check, evidence'
	)
	assert.deepEqual(
		alwaysRunNodeIds(readWorkflow('unic-dlc-qa')).sort(),
		['coverage-gate', 'e2e', 'verify-pr-base'].sort(),
		'unic-dlc-qa.yaml: always_run must land on exactly e2e, coverage-gate, verify-pr-base'
	)
})
