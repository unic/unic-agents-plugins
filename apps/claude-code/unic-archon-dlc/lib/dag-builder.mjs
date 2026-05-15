// @ts-check

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} title
 * @property {string} type
 * @property {string} priority
 * @property {string[]} blocked_by
 * @property {string[]} acceptance_criteria
 * @property {string} summary
 * @property {string} [test_command]
 * @property {boolean} [test_command_planned]
 */

/**
 * Detect circular dependencies using DFS.
 * Returns null if no cycles; returns the cycle path array if one is found.
 * @param {Issue[]} issues
 * @returns {string[] | null}
 */
export function detectCircular(issues) {
	/** @type {Map<string, string[]>} */
	const deps = new Map(issues.map((i) => [i.id, i.blocked_by ?? []]))

	// DFS with three-colour marking: WHITE=0, GREY=1 (in stack), BLACK=2 (done)
	/** @type {Map<string, number>} */
	const colour = new Map()

	/**
	 * @param {string} id
	 * @param {string[]} path
	 * @returns {string[] | null}
	 */
	function visit(id, path) {
		const c = colour.get(id) ?? 0
		if (c === 2) return null
		if (c === 1) return [...path, id] // cycle found

		colour.set(id, 1)
		for (const dep of deps.get(id) ?? []) {
			const cycle = visit(dep, [...path, id])
			if (cycle) return cycle
		}
		colour.set(id, 2)
		return null
	}

	for (const issue of issues) {
		if (!colour.has(issue.id)) {
			const cycle = visit(issue.id, [])
			if (cycle) return cycle
		}
	}

	return null
}

/**
 * Build the Archon build-<slug>.yaml for a set of issues.
 * Each issue produces two nodes: code-red-<id> and code-green-<id>.
 * code-red-<id> depends on code-green nodes of all blocked_by issues.
 * code-green-<id> depends on code-red-<id>.
 * Throws if a circular dependency is detected.
 * @param {string} slug
 * @param {Issue[]} issues
 * @returns {string}
 */
export function buildYaml(slug, issues) {
	const cycle = detectCircular(issues)
	if (cycle) {
		throw new Error(`Circular dependency detected: ${cycle.join(' → ')}`)
	}

	const lines = [
		`name: unic-dlc-build-${slug}`,
		`description: >`,
		`  Auto-generated build workflow for ${slug}.`,
		`  Produced by unic-archon-dlc yaml-gen node.`,
		``,
		`inputs:`,
		`  slug:`,
		`    description: Planning session identifier.`,
		`    required: true`,
		``,
		`nodes:`,
	]

	for (const issue of issues) {
		const blockedByGreens = (issue.blocked_by ?? []).map((dep) => `code-green-${dep}`)
		const redDeps = blockedByGreens.length ? `[${blockedByGreens.join(', ')}]` : '[]'

		lines.push(
			`  - id: code-red-${issue.id}`,
			`    name: "Red — ${issue.title}"`,
			`    type: prompt`,
			`    depends_on: ${redDeps}`,
			`    prompt: |`,
			`      You are running the unic-archon-dlc build workflow — code-red node for issue ${issue.id}.`,
			``,
			`      Issue: ${issue.title}`,
			`      Summary: ${issue.summary}`,
			``,
			`      Write FAILING acceptance tests for this issue before writing any implementation.`,
			`      Tests must:`,
			`        - Use only the public interface of the module under test.`,
			`        - Assert on observable behaviour, not internal state.`,
			`        - Cover every acceptance criterion listed for this issue:`,
			...issue.acceptance_criteria.map((ac) => `          - ${ac}`),
			...(issue.test_command
				? [`      Run: ${issue.test_command}`, `      Confirm all new tests FAIL before proceeding.`]
				: [`      Mark tests as expected-to-fail (todo) if no runner is configured yet.`]),
			``
		)

		lines.push(
			`  - id: code-green-${issue.id}`,
			`    name: "Green — ${issue.title}"`,
			`    type: prompt`,
			`    depends_on: [code-red-${issue.id}]`,
			`    prompt: |`,
			`      You are running the unic-archon-dlc build workflow — code-green node for issue ${issue.id}.`,
			``,
			`      Issue: ${issue.title}`,
			`      Summary: ${issue.summary}`,
			``,
			`      Write the MINIMUM implementation to make the failing tests from code-red-${issue.id} pass.`,
			`      Rules:`,
			`        - Do not modify the tests.`,
			`        - Only write enough code to pass the current tests.`,
			`        - Do not add features not covered by the acceptance criteria.`,
			...(issue.test_command
				? [`      Run: ${issue.test_command}`, `      Confirm all tests PASS before proceeding.`]
				: []),
			``
		)
	}

	return lines.join('\n')
}
