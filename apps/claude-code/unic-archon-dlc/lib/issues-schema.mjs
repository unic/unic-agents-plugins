// @ts-check
/**
 * Issues schema — pure data transformation functions for decomposed issues.
 *
 * All functions are side-effect-free; they only transform data in memory.
 */

/**
 * @typedef {Object} Issue
 * @property {string} id - Unique identifier for this issue within the file
 * @property {string} title - Short, descriptive title
 * @property {string} type - Canonical type label (e.g. 'feature', 'bug', 'spike', 'tech-debt', 'docs')
 * @property {string} priority - Canonical priority label (e.g. 'p0', 'p1', 'p2', 'p3')
 * @property {string[]} blocked_by - Array of issue IDs this issue depends on
 * @property {string[]} acceptance_criteria - Non-empty array of independently demonstrable criteria
 * @property {string} summary - One-paragraph description of the work
 * @property {string} [test_command] - Exact shell command to verify this issue
 * @property {true} [test_command_planned] - Set to true when no test command exists yet
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - true if all mandatory fields are present and valid
 * @property {string[]} errors - list of human-readable error messages
 */

const MANDATORY_FIELDS = /** @type {const} */ ([
	'id',
	'title',
	'type',
	'priority',
	'blocked_by',
	'acceptance_criteria',
	'summary',
])

/**
 * Validate that an issue object has all mandatory fields present and valid.
 * @param {Partial<Issue>} issue
 * @returns {ValidationResult}
 */
export function validateIssue(issue) {
	/** @type {string[]} */
	const errors = []

	for (const field of MANDATORY_FIELDS) {
		if (issue[field] === undefined || issue[field] === null) {
			errors.push(`Missing mandatory field: '${field}'`)
		}
	}

	// acceptance_criteria must be a non-empty array
	if (
		issue.acceptance_criteria !== undefined &&
		issue.acceptance_criteria !== null &&
		(!Array.isArray(issue.acceptance_criteria) || issue.acceptance_criteria.length === 0)
	) {
		errors.push(`'acceptance_criteria' must be a non-empty array`)
	}

	// blocked_by must be an array (may be empty)
	if (issue.blocked_by !== undefined && issue.blocked_by !== null && !Array.isArray(issue.blocked_by)) {
		errors.push(`'blocked_by' must be an array`)
	}

	return { valid: errors.length === 0, errors }
}

/**
 * Topological sort of issues by their blocked_by dependency edges.
 * Issues with no dependencies (blocked_by: []) come first.
 * Throws if a circular dependency is detected.
 * @param {Issue[]} issues
 * @returns {Issue[]} sorted array — dependencies before dependants
 */
export function sortByDependency(issues) {
	// Kahn's algorithm (BFS-based topological sort)
	/** @type {Map<string, Issue>} */
	const byId = new Map(issues.map((i) => [i.id, i]))

	// in-degree: how many unresolved dependencies each issue has
	/** @type {Map<string, number>} */
	const inDegree = new Map(issues.map((i) => [i.id, 0]))

	// adjacency list: dep → list of issues that depend on dep
	/** @type {Map<string, string[]>} */
	const dependants = new Map(issues.map((i) => [i.id, []]))

	for (const issue of issues) {
		for (const dep of issue.blocked_by) {
			if (dep === issue.id) {
				throw new Error(`Circular dependency detected: issue '${issue.id}' depends on itself`)
			}
			// dep must exist in the set; if not treat as external (skip counting)
			if (!byId.has(dep)) continue
			inDegree.set(issue.id, (inDegree.get(issue.id) ?? 0) + 1)
			dependants.get(dep)?.push(issue.id)
		}
	}

	// Start with all issues that have no dependencies
	/** @type {string[]} */
	const queue = []
	for (const [id, deg] of inDegree) {
		if (deg === 0) queue.push(id)
	}

	/** @type {Issue[]} */
	const sorted = []

	while (queue.length > 0) {
		const id = /** @type {string} */ (queue.shift())
		const issue = byId.get(id)
		if (issue) sorted.push(issue)

		for (const dependantId of dependants.get(id) ?? []) {
			const newDeg = (inDegree.get(dependantId) ?? 0) - 1
			inDegree.set(dependantId, newDeg)
			if (newDeg === 0) queue.push(dependantId)
		}
	}

	if (sorted.length !== issues.length) {
		// Not all issues were processed → circular dependency
		const remaining = issues.filter((i) => !sorted.find((s) => s.id === i.id)).map((i) => i.id)
		throw new Error(`Circular dependency detected among issues: ${remaining.join(', ')}`)
	}

	return sorted
}

/**
 * Serialise an issues array to a JSON string with 2-space indentation.
 * @param {Issue[]} issues
 * @returns {string}
 */
export function buildIssuesJson(issues) {
	return JSON.stringify(issues, null, 2)
}
