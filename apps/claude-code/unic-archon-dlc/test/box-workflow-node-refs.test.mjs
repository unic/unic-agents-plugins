// @ts-check

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

/**
 * Loader-parity guard for the four Archon Boxes.
 *
 * Archon's DAG loader reads every dollar-prefixed node-output token in a workflow file as a real
 * edge — inside script bodies, inside prompts, and inside comments alike. A token naming a node
 * that does not exist fails the whole file at discovery time with `dag_structure_invalid`, so the
 * Box stops loading and its command stops working. Nothing else in this repo catches that: the
 * YAMLs are data files with no parser in the test suite, so `pnpm test` and `pnpm ci:check` both
 * stay green while a Box is unloadable.
 *
 * A placeholder token in an explanatory comment shipped exactly that failure on #290's branch
 * (`Node 'evidence' references unknown node '$id.output'`), which is why this asserts over
 * comments too rather than trying to strip them — matching comments is the correct behaviour
 * here, because the loader matches them.
 *
 * This is a static approximation of the loader, not the loader itself. It cannot replace running
 * `archon workflow list` against a real binary, and a token charset change upstream would drift.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')
const WORKFLOWS_DIR = join(PLUGIN_ROOT, '.archon', 'workflows')

/**
 * Node-output references, as `$<nodeId>.output`. The id charset matches the ids the Boxes
 * actually declare, hyphens included (`goals-check`, `verify-pr-base`).
 */
const NODE_OUTPUT_REF = /\$([A-Za-z0-9_-]+)\.output/g

/** @returns {string[]} every `.yaml` file in the Boxes directory */
function workflowFiles() {
	return readdirSync(WORKFLOWS_DIR)
		.filter((name) => name.endsWith('.yaml'))
		.sort()
}

/** @param {string} contents @returns {string[]} every declared node id, in file order */
function declaredNodeIds(contents) {
	return [...contents.matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gm)].map((match) => match[1])
}

/** @param {string} contents @returns {string[]} every referenced node id, deduped */
function referencedNodeIds(contents) {
	return [...new Set([...contents.matchAll(NODE_OUTPUT_REF)].map((match) => match[1]))]
}

test('the Boxes directory holds the four Boxes and nothing else', () => {
	assert.deepEqual(workflowFiles(), [
		'unic-dlc-build.yaml',
		'unic-dlc-explore.yaml',
		'unic-dlc-pr-review.yaml',
		'unic-dlc-qa.yaml',
	])
})

for (const file of workflowFiles()) {
	test(`${file}: every node-output reference names a declared node`, () => {
		const contents = readFileSync(join(WORKFLOWS_DIR, file), 'utf8').replace(/\r\n/g, '\n')
		const declared = new Set(declaredNodeIds(contents))
		assert.ok(declared.size > 0, `${file}: no node ids found — the id syntax changed and this guard went blind`)

		const unknown = referencedNodeIds(contents).filter((id) => !declared.has(id))
		assert.deepEqual(
			unknown,
			[],
			`${file}: references node(s) that do not exist — Archon's loader rejects the whole file with "references unknown node", so the Box stops loading. Placeholder tokens in comments count: the loader reads them as edges.`
		)
	})
}
