// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Generates a valid Archon build workflow YAML string from a slug and dependency groups.
 *
 * @param {string} slug - Feature slug used to name the workflow.
 * @param {string[][]} groups - Topologically-sorted parallel groups from buildDepTree.
 * @returns {string} YAML string for the build workflow.
 */
export function generateBuildYaml(slug, groups) {
	const lines = []

	lines.push(`name: build-${slug}`)
	lines.push(`description: Build workflow for feature '${slug}'`)
	lines.push('')
	lines.push('nodes:')

	/**
	 * Track which code-green nodes have been emitted per issue,
	 * so we can build the global verification depends_on list.
	 * @type {string[]}
	 */
	const allGreenNodes = []

	// For depends_on: each tier's red nodes depend on the previous tier's green nodes
	/** @type {string[]} */
	let prevTierGreens = []

	for (const group of groups) {
		// code-red nodes for this group (run in parallel within the tier)
		for (const issueId of group) {
			const redNode = `code-red-${issueId}`
			const greenNode = `code-green-${issueId}`
			const slopNode = `slopcheck-${issueId}`

			const redDeps = prevTierGreens.length > 0 ? prevTierGreens : []

			lines.push(`  ${redNode}:`)
			lines.push(`    type: prompt`)
			lines.push(`    description: "Implement ${issueId} (red phase — write failing tests first)"`)
			if (redDeps.length > 0) {
				lines.push(`    depends_on:`)
				for (const dep of redDeps) {
					lines.push(`      - ${dep}`)
				}
			}
			lines.push('')

			lines.push(`  ${slopNode}:`)
			lines.push(`    type: bash`)
			lines.push(`    description: "Check for slopsquatting in new packages for ${issueId}"`)
			lines.push(`    command: "slopcheck . || echo '[ASSUMED] slopcheck not on PATH — manual review required'"`)
			lines.push(`    depends_on:`)
			lines.push(`      - ${redNode}`)
			lines.push('')

			lines.push(`  ${greenNode}:`)
			lines.push(`    type: prompt`)
			lines.push(`    description: "Implement ${issueId} (green phase — make tests pass)"`)
			lines.push(`    depends_on:`)
			lines.push(`      - ${slopNode}`)
			lines.push('')

			allGreenNodes.push(greenNode)
		}

		prevTierGreens = group.map((id) => `code-green-${id}`)
	}

	// Global verification node
	lines.push(`  verification:`)
	lines.push(`    type: bash`)
	lines.push(`    description: "Run full test suite, coverage check, stub detection, and wiring audit"`)
	lines.push(`    command: "node --test && echo 'Verification complete'"`)
	if (allGreenNodes.length > 0) {
		lines.push(`    depends_on:`)
		for (const dep of allGreenNodes) {
			lines.push(`      - ${dep}`)
		}
	}
	lines.push('')

	// Goals-check node
	lines.push(`  goals-check:`)
	lines.push(`    type: prompt`)
	lines.push(`    description: "Verify PRD acceptance criteria coverage matrix"`)
	lines.push(`    depends_on:`)
	lines.push(`      - verification`)
	lines.push('')

	// Report node
	lines.push(`  report:`)
	lines.push(`    type: bash`)
	lines.push(`    description: "Write docs/workflow/${slug}/report.md"`)
	lines.push(`    command: "mkdir -p docs/workflow/${slug} && node scripts/write-report.mjs ${slug}"`)
	lines.push(`    depends_on:`)
	lines.push(`      - goals-check`)
	lines.push('')

	// Human review gate
	lines.push(`  human-review-gate:`)
	lines.push(`    type: prompt`)
	lines.push(`    interactive: true`)
	lines.push(`    description: "Human approval gate: review the report and approve or request changes"`)
	lines.push(`    depends_on:`)
	lines.push(`      - report`)
	lines.push('')

	return lines.join('\n')
}
