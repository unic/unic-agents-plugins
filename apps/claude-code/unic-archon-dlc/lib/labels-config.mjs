// @ts-check

/** @type {readonly string[]} */
export const STATE_LABELS = [
	'needs-triage',
	'needs-info',
	'needs-specs',
	'ready-for-agent',
	'ready-for-human',
	'resolved',
	'closed',
	'rejected',
]

/** @type {readonly string[]} */
export const TYPE_LABELS = ['feature', 'bug', 'spike', 'tech-debt', 'docs']

/** @type {readonly string[]} */
export const PRIORITY_LABELS = ['p0', 'p1', 'p2', 'p3']

/**
 * @typedef {Object} LabelMapping
 * @property {Record<string, string>} state
 * @property {Record<string, string>} type
 * @property {Record<string, string>} priority
 */

/**
 * Build default label mappings for a given tracker.
 * For all v1 backends, canonical names equal tracker strings by default.
 * Users can override these mappings in .archon/unic-dlc.config.json.
 * @param {string} _tracker
 * @returns {LabelMapping}
 */
export function getDefaultLabels(_tracker) {
	const identity = (/** @type {readonly string[]} */ keys) => Object.fromEntries(keys.map((k) => [k, k]))

	return {
		state: identity(STATE_LABELS),
		type: identity(TYPE_LABELS),
		priority: identity(PRIORITY_LABELS),
	}
}
