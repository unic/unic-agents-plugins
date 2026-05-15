// @ts-check
/**
 * Tracker adapter — pure functions that translate canonical label names to
 * tracker-specific strings and generate CLI command strings for each backend.
 *
 * All tracker-specific knowledge is encapsulated here. Callers always use
 * canonical names; this module translates at write time.
 */

/**
 * @typedef {import('./labels-config.mjs').LabelMapping} LabelMapping
 */

/**
 * Translate a canonical label name to the tracker-specific string.
 * Falls back to the canonical name if the key is not in any tier.
 * @param {string} canonical
 * @param {LabelMapping} labels
 * @returns {string}
 */
export function translateLabel(canonical, labels) {
	return labels.state[canonical] ?? labels.type[canonical] ?? labels.priority[canonical] ?? canonical
}

/**
 * Generate a CLI command string to create a new issue in the configured tracker.
 * @param {string} tracker
 * @param {string} title
 * @param {string} type  - canonical type label (e.g. 'bug', 'feature')
 * @param {string} priority  - canonical priority label (e.g. 'p1')
 * @param {LabelMapping} labels
 * @returns {string}
 */
export function buildCreateCommand(tracker, title, type, priority, labels) {
	const typeStr = translateLabel(type, labels)
	const priorityStr = translateLabel(priority, labels)

	switch (tracker) {
		case 'github':
			return `gh issue create --title "${title}" --label "${typeStr}" --label "${priorityStr}"`

		case 'ado':
			return `az boards work-item create --title "${title}" --type "Issue" --fields "Tags=${typeStr};${priorityStr}"`

		case 'jira':
			return `jira issue create --summary "${title}" --issuetype "${typeStr}" --label "${priorityStr}"`

		case 'local-markdown': {
			const slug = title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
			return `Create docs/issues/${slug}/index.md with:\nStatus: needs-triage\nType: ${typeStr}\nPriority: ${priorityStr}`
		}

		default:
			return `gh issue create --title "${title}" --label "${typeStr}" --label "${priorityStr}"`
	}
}

/**
 * Generate a CLI command string to update an issue's state label.
 * @param {string} tracker
 * @param {string} issueId  - issue number or key
 * @param {string} newState  - canonical state label (e.g. 'resolved')
 * @param {LabelMapping} labels
 * @returns {string}
 */
export function buildUpdateCommand(tracker, issueId, newState, labels) {
	const stateStr = translateLabel(newState, labels)

	switch (tracker) {
		case 'github':
			return `gh issue edit ${issueId} --add-label "${stateStr}"`

		case 'ado':
			return `az boards work-item update --id ${issueId} --fields "Tags=${stateStr}"`

		case 'jira':
			return `jira issue edit ${issueId} --label "${stateStr}"`

		case 'local-markdown':
			return `Edit Status: line in docs/issues/<slug>/index.md to: Status: ${stateStr}`

		default:
			return `gh issue edit ${issueId} --add-label "${stateStr}"`
	}
}
