// @ts-check
import { readFileSync } from 'node:fs'

/** @type {readonly string[]} */
const MANDATORY_FIELDS = ['tracker', 'pr_strategy', 'branching']

/** @type {readonly string[]} */
const KNOWN_FIELDS = [
	'tracker',
	'pr_strategy',
	'branching',
	'e2e_command',
	'model_profile',
	'tdd_mode',
	'nyquist_validation',
	'slopsquatting_gate',
	'repo_layout',
	'context_paths',
	'labels',
	'workflow',
	'coverage_thresholds',
]

/**
 * @typedef {Object} DlcConfig
 * @property {string} tracker
 * @property {string} pr_strategy
 * @property {string} branching
 * @property {string | null} [e2e_command]
 * @property {string} [model_profile]
 * @property {boolean} [tdd_mode]
 * @property {boolean} [nyquist_validation]
 * @property {boolean} [slopsquatting_gate]
 * @property {string} [repo_layout]
 */

/**
 * @typedef {Object} ConfigError
 * @property {true} error
 * @property {string[]} missing
 * @property {string} message
 */

/**
 * Reads and validates .archon/unic-dlc.config.json.
 * Returns a typed config object or a structured error.
 * Unknown keys in the file are silently ignored.
 * @param {string} path - absolute path to the config file
 * @returns {DlcConfig | ConfigError}
 */
export function loadConfig(path) {
	let raw
	try {
		raw = JSON.parse(readFileSync(path, 'utf8'))
	} catch (err) {
		return { error: true, missing: [], message: `Cannot read config at ${path}: ${/** @type {Error} */ (err).message}` }
	}

	const missing = MANDATORY_FIELDS.filter((f) => !(f in raw))
	if (missing.length > 0) {
		return { error: true, missing, message: `Missing mandatory fields: ${missing.join(', ')}` }
	}

	/** @type {Record<string, unknown>} */
	const result = {}
	for (const key of KNOWN_FIELDS) {
		if (key in raw) result[key] = raw[key]
	}
	return /** @type {DlcConfig} */ (result)
}
