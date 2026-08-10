// @ts-check

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { parse } from 'yaml'

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
 *
 * Two known divergences from the shipped 0.7.0 loader, both erring strict — so this file can raise
 * a false positive but cannot miss a real break:
 *   - The loader strips fenced blocks and inline backtick spans from `prompt` and `loop.prompt`
 *     before scanning, and does NOT strip them for `script`, `bash`, `when`, `input`, `cancel` or
 *     `approval.message`. This scans every field raw, so a backticked `$example.output` inside a
 *     prompt is legal for the loader and fails here.
 *   - The loader's id charset is `[a-zA-Z_][a-zA-Z0-9_-]*`; the pattern below also admits a leading
 *     digit.
 *
 * The FIELD pass below goes beyond the loader deliberately. Archon validates that `$id.output`
 * names a declared node; it does not check that `$id.output.<field>` names a declared property. A
 * rename on the producer side is therefore silent — the consumer reads `undefined`, which surfaces
 * as an empty section in a report or as a gate that withholds on every run.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')
const WORKFLOWS_DIR = join(PLUGIN_ROOT, '.archon', 'workflows')

/**
 * Node-output references, as `$<nodeId>.output`. The id charset matches the ids the Boxes
 * actually declare, hyphens included (`goals-check`, `verify-pr-base`).
 */
const NODE_OUTPUT_REF = /\$([A-Za-z0-9_-]+)\.output/g

/** The field-qualified form, `$<nodeId>.output.<field>`. Field names are plain identifiers. */
const NODE_OUTPUT_FIELD_REF = /\$([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)/g

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

	test(`${file}: every node-output FIELD reference is declared in that node's output_format`, () => {
		const contents = readFileSync(join(WORKFLOWS_DIR, file), 'utf8').replace(/\r\n/g, '\n')
		const doc = parse(contents)
		assert.ok(Array.isArray(doc?.nodes) && doc.nodes.length > 0, `${file}: no nodes parsed — this guard went blind`)
		const declared = new Map(doc.nodes.map((/** @type {{ id: string }} */ node) => [node.id, node]))

		const unknown = []
		for (const [, id, field] of contents.matchAll(NODE_OUTPUT_FIELD_REF)) {
			const properties = declared.get(id)?.output_format?.properties
			// A node with no output_format emits free text, so a field read against it is a
			// different (and pre-existing) question. Flag only the declared-schema case.
			if (properties && !(field in properties)) unknown.push(`$${id}.output.${field}`)
		}
		assert.deepEqual(
			[...new Set(unknown)].sort(),
			[],
			`${file}: reads field(s) absent from the producing node's output_format — Archon does not validate this, so the consumer silently gets undefined`
		)
	})
}
