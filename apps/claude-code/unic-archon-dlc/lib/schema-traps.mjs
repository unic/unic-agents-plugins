// @ts-check

import { parse as parseYaml } from 'yaml'

/**
 * ADR-0011's three silent-failure traps, as a deterministic check over one workflow YAML.
 *
 * `archon validate workflows <name>` passes clean on every one of these forms, because each node
 * still carries a recognised content key and unknown fields are ignored. The failures are therefore
 * invisible until a run misbehaves: a gate that never pauses, a loop that never iterates, an
 * anti-cheat context isolation that never applies. `/archon-upgrade` re-asserts them on every
 * invocation, which is only meaningful if the assertion itself is tested — a regex buried in a
 * command prompt is exactly the fail-open shape this Plugin keeps finding.
 *
 * Tracker-agnostic, deterministic, reusable: the bar ADR-0018 sets for a tested `lib/` module.
 */

/**
 * @typedef {{ trap: 'parse' | 'type-discriminator' | 'approval-interactive' | 'loop-keys' | 'node-fresh-context', node: string | null, message: string }} TrapViolation
 * @typedef {{ ok: boolean, violations: TrapViolation[] }} TrapReport
 */

/** The four ADR-0011 traps, in the order `checkSchemaTraps` reports them. */
export const SCHEMA_TRAPS = /** @type {const} */ ([
	'type-discriminator',
	'approval-interactive',
	'loop-keys',
	'node-fresh-context',
])

/**
 * Check one workflow YAML source against ADR-0011's node-schema conventions 1–4.
 *
 * Never throws: an unparseable or malformed file is reported as a `parse` violation, so a caller
 * printing a PASS/FAIL grid cannot mistake a crash for a pass.
 *
 * @param {string} source - the raw YAML text of one Box workflow
 * @returns {TrapReport}
 */
export function checkSchemaTraps(source) {
	/** @type {TrapViolation[]} */
	const violations = []

	let doc
	try {
		doc = parseYaml(source)
	} catch (err) {
		return {
			ok: false,
			violations: [{ trap: 'parse', node: null, message: `YAML did not parse: ${/** @type {Error} */ (err).message}` }],
		}
	}

	if (!doc || typeof doc !== 'object' || !Array.isArray(doc.nodes)) {
		return { ok: false, violations: [{ trap: 'parse', node: null, message: 'no top-level `nodes:` list' }] }
	}

	const workflowInteractive = doc.interactive === true

	for (const [index, node] of doc.nodes.entries()) {
		if (!node || typeof node !== 'object') {
			violations.push({ trap: 'parse', node: `#${index}`, message: 'node is not a mapping' })
			continue
		}

		const id = typeof node.id === 'string' ? node.id : `#${index}`

		// Trap 1 (ADR-0011 §1) — a `type:` field is silently ignored, so the node dispatches on
		// whichever content key it happens to carry rather than on the type the author declared.
		if ('type' in node) {
			violations.push({
				trap: 'type-discriminator',
				node: id,
				message: `carries \`type: ${String(node.type)}\` — the schema is key-discriminated and \`type\` is ignored`,
			})
		}

		// Trap 2 (ADR-0011 §2) — without workflow-level `interactive: true` the run dispatches to a
		// background worker and the approval message never reaches a human: the gate never pauses.
		if ('approval' in node && !workflowInteractive) {
			violations.push({
				trap: 'approval-interactive',
				node: id,
				message: 'is an `approval:` node but the workflow does not set `interactive: true`',
			})
		}

		// Trap 3 (ADR-0011 §3) — a `loop:` missing either key runs once and reports success.
		if ('loop' in node) {
			const loop = node.loop
			if (!loop || typeof loop !== 'object') {
				violations.push({ trap: 'loop-keys', node: id, message: '`loop:` is not a mapping' })
			} else {
				for (const key of ['until', 'max_iterations']) {
					if (!(key in loop)) {
						violations.push({ trap: 'loop-keys', node: id, message: `\`loop:\` is missing \`${key}\`` })
					}
				}
			}
		}

		// Trap 4 (ADR-0011 §4) — a node-level `fresh_context:` is an unknown field: the anti-cheat
		// isolation ADR-0012 depends on is never applied. Only `context: fresh` and `loop.fresh_context`
		// are honoured.
		if ('fresh_context' in node) {
			violations.push({
				trap: 'node-fresh-context',
				node: id,
				message: 'carries a node-level `fresh_context:` — use `context: fresh` or `loop.fresh_context`',
			})
		}
	}

	return { ok: violations.length === 0, violations }
}
