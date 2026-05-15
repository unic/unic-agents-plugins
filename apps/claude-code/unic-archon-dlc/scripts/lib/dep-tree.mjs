// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string[]} blocked_by
 * @property {string} testCommand
 *
 * @typedef {{ ok: true, groups: string[][] } | { ok: false, error: string, cycle: string[] }} DepTreeResult
 */

/**
 * Converts an issues array into topologically-sorted parallel groups using Kahn's algorithm.
 * Issues within the same group have no inter-dependencies and can run in parallel.
 *
 * @param {Issue[]} issues
 * @returns {DepTreeResult}
 */
export function buildDepTree(issues) {
	const ids = new Set(issues.map((i) => i.id))

	// Validate all blocked_by references exist
	for (const issue of issues) {
		for (const dep of issue.blocked_by) {
			if (!ids.has(dep)) {
				return { ok: false, error: `Issue '${issue.id}' references unknown dependency '${dep}'`, cycle: [] }
			}
		}
	}

	// Build in-degree map and adjacency list
	/** @type {Map<string, number>} */
	const inDegree = new Map(issues.map((i) => [i.id, 0]))

	/** @type {Map<string, string[]>} */
	const dependents = new Map(issues.map((i) => [i.id, []]))

	for (const issue of issues) {
		for (const dep of issue.blocked_by) {
			inDegree.set(issue.id, (inDegree.get(issue.id) ?? 0) + 1)
			dependents.get(dep)?.push(issue.id)
		}
	}

	/** @type {string[][]} */
	const groups = []
	/** @type {string[]} */
	let currentTier = issues.filter((i) => (inDegree.get(i.id) ?? 0) === 0).map((i) => i.id)

	while (currentTier.length > 0) {
		groups.push(currentTier)
		/** @type {string[]} */
		const nextTier = []
		for (const id of currentTier) {
			for (const dependent of dependents.get(id) ?? []) {
				const newDegree = (inDegree.get(dependent) ?? 0) - 1
				inDegree.set(dependent, newDegree)
				if (newDegree === 0) nextTier.push(dependent)
			}
		}
		currentTier = nextTier
	}

	// If not all issues were processed, there's a cycle
	const processed = groups.flat().length
	if (processed < issues.length) {
		const cycleNodes = issues.filter((i) => (inDegree.get(i.id) ?? 0) > 0).map((i) => i.id)
		return { ok: false, error: 'Circular dependency detected', cycle: cycleNodes }
	}

	return { ok: true, groups }
}
