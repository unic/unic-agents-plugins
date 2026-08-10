// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { parse } from 'yaml'

/**
 * Structural regression guards for #290's two runtime-only additions (evidence gate,
 * `always_run` placement). Neither is importable: an Archon Box node is self-contained and
 * imports nothing from the Plugin (ADR-0023 §5), so the `evidence` node's delete/withhold/write
 * logic cannot be extracted into `lib/` and unit-tested the way `resolveArchonRemote` was
 * (`commands/setup.md` is a Claude Code command, not an Archon node, so no such restriction
 * applied there). These are dumb string/ordering checks against the YAML source, in the same
 * style as `box-staging-and-repo-pinning.test.mjs`. They are not a substitute for a behavioural
 * run against a live Consumer, which remains outstanding — but they catch a future edit that
 * silently reorders the delete-before-write sequence, inverts the withhold guard, drops the
 * workflow-level `evidence_policy` key, or moves `always_run: true` onto (or off) the wrong node.
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
 * lines are stripped first because a node's explanatory banner sits ABOVE its own `- id:` line and
 * therefore lands inside the PRECEDING node's split block. `evidence`'s banner in
 * `unic-dlc-build.yaml` mentions `always_run: true` in prose; without the filter that prose would
 * be read as `goals-check`'s own setting, so this function would report `goals-check` twice and
 * `evidence` never.
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

/** The withhold guard's exact expression. One constant, so all four ordering tests move together. */
const WITHHOLD_GUARD = 'if (!verificationGreen || !goalsCheckGreen)'

test('evidence node deletes any stale file before evaluating the withhold guard', () => {
	const evidence = nodeSource(readWorkflow('unic-dlc-build'), 'evidence')
	assert.ok(evidence, 'unic-dlc-build.yaml lost its evidence node')
	const deleteIndex = evidence.indexOf('rmSync(evidencePath)')
	const guardIndex = evidence.indexOf(WITHHOLD_GUARD)
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
	const guardIndex = evidence.indexOf(WITHHOLD_GUARD)
	assert.ok(deleteIndex !== -1, 'evidence node lost the mirror delete step (ADR-0034)')
	assert.ok(
		deleteIndex < guardIndex,
		'the mirror must be deleted BEFORE the withhold guard — the engine presence gate reads only the $ARTIFACTS_DIR copy, so a stale mirror survives an engine refusal and open-pr stages it'
	)
})

test('evidence node only writes when both verification and goals-check passed', () => {
	const evidence = nodeSource(readWorkflow('unic-dlc-build'), 'evidence')
	assert.ok(evidence, 'unic-dlc-build.yaml lost its evidence node')
	const guardIndex = evidence.indexOf(WITHHOLD_GUARD)
	const writeIndex = evidence.indexOf('writeFileSync(evidencePath')
	assert.ok(writeIndex !== -1, 'evidence node lost its write step')
	assert.ok(guardIndex < writeIndex, 'the withhold guard must run BEFORE the write, not after')
	assert.match(
		evidence,
		/process\.exit\(0\)/,
		'evidence node must exit 0 on withhold — a non-zero exit here would fail the whole run rather than just skipping the gate'
	)
})

test('evidence node cross-checks the failures list against the self-reported boolean', () => {
	// `passed` is self-reported by the same prompt that wrote `failures`. Certifying on the boolean
	// alone let `passed: true` beside a non-empty `failures` array write a certificate whose own
	// body listed the failures. Both fields must gate (ADR-0034 step 2).
	const evidence = nodeSource(readWorkflow('unic-dlc-build'), 'evidence')
	assert.ok(evidence, 'unic-dlc-build.yaml lost its evidence node')
	assert.match(
		evidence,
		/const verificationGreen = verificationPassed === true && verificationFailures\.length === 0/,
		'the verification verdict must require passed === true AND an empty failures list'
	)
	assert.match(
		evidence,
		/const goalsCheckGreen = goalsCheckPassed === true && goalsCheckFailures\.length === 0/,
		'the goals-check verdict must require passed === true AND an empty failures list'
	)
	const greenIndex = evidence.indexOf('const verificationGreen')
	assert.ok(
		greenIndex !== -1 && greenIndex < evidence.indexOf(WITHHOLD_GUARD),
		'the cross-check must be derived BEFORE the withhold guard consumes it'
	)
})

test('unic-dlc-build declares the workflow-level evidence gate', () => {
	// ADR-0034: the engine refuses terminal `completed` unless evidence.json exists. Without this
	// key the `evidence` node still runs and still writes — and /build can again complete on a red
	// tree, the defect #290 closed. Parsed, not string-matched: `evidence_policy` also appears in
	// comments and prompts in this file, so a string check passes on a file whose real key is gone.
	const doc = parse(readWorkflow('unic-dlc-build'))
	assert.deepEqual(
		doc.evidence_policy,
		{ required: true },
		'the workflow-level evidence gate is gone or disabled — /build can reach completed on a red tree again'
	)
	assert.ok(
		doc.nodes.some((/** @type {{ id: string }} */ node) => node.id === 'evidence'),
		'evidence_policy without an evidence node fails every run closed'
	)
})

test('/build stages the evidence mirror at open-pr, and only when it exists', () => {
	// $ARTIFACTS_DIR is outside the repo and dies with the worktree, so the mirror is the only copy
	// a reviewer sees; unstaged, the certification never reaches the PR and nothing else fails,
	// because the engine's presence gate reads the other copy. The conditional matters as much: the
	// evidence node withholds on a red verdict, and `git add` on a missing path exits 128 and takes
	// the whole staging step with it.
	const openPr = nodeSource(readWorkflow('unic-dlc-build'), 'open-pr')
	assert.ok(openPr, 'unic-dlc-build.yaml lost its open-pr node')
	assert.match(openPr, /SESSION\/evidence\.json/, 'open-pr no longer stages the evidence mirror')
	assert.match(
		openPr,
		/SESSION\/evidence\.json — ONLY if that file exists/,
		'the evidence mirror must be staged conditionally — it is absent on every withheld (red) verdict'
	)
})

test('always_run lands on exactly the nodes ADR-0033 names, per workflow', () => {
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
