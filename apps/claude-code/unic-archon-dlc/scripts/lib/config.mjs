// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import { readFileSync } from 'node:fs'

/**
 * @typedef {'github' | 'ado' | 'jira' | 'local'} IssueTracker
 * @typedef {'gitflow' | 'github-flow'} BranchingStrategy
 * @typedef {'balanced' | 'fast' | 'quality'} ModelProfile
 *
 * @typedef {Object} DlcConfig
 * @property {IssueTracker} issueTracker
 * @property {BranchingStrategy} branchingStrategy
 * @property {boolean} tddMode
 * @property {boolean} nyquistValidation
 * @property {boolean} slopsquattingGate
 * @property {ModelProfile} modelProfile
 * @property {string | null} e2eCommand
 * @property {{ state: Record<string, string>, type: Record<string, string>, priority: Record<string, string> }} labels
 *
 * @typedef {{ ok: true, config: DlcConfig } | { ok: false, errors: string[] }} ConfigResult
 */

/** @type {readonly IssueTracker[]} */
const VALID_ISSUE_TRACKERS = ['github', 'ado', 'jira', 'local']

/** @type {readonly BranchingStrategy[]} */
const VALID_BRANCHING_STRATEGIES = ['gitflow', 'github-flow']

/** @type {readonly ModelProfile[]} */
const VALID_MODEL_PROFILES = ['balanced', 'fast', 'quality']

/**
 * Reads and validates a DlcConfig from the given JSON file path.
 *
 * @param {string} filePath - Absolute or relative path to the config JSON file.
 * @returns {ConfigResult}
 */
export function loadConfig(filePath) {
	let raw

	try {
		raw = readFileSync(filePath, 'utf8')
	} catch {
		return { ok: false, errors: [`Cannot read config file: ${filePath}`] }
	}

	/** @type {Record<string, unknown>} */
	let parsed

	try {
		parsed = /** @type {Record<string, unknown>} */ (JSON.parse(raw))
	} catch {
		return { ok: false, errors: [`Config file is not valid JSON: ${filePath}`] }
	}

	const errors = []

	if (!parsed.issueTracker) {
		errors.push('Missing required field: issueTracker')
	} else if (!VALID_ISSUE_TRACKERS.includes(/** @type {IssueTracker} */ (parsed.issueTracker))) {
		errors.push(`Invalid issueTracker: ${parsed.issueTracker}. Must be one of: ${VALID_ISSUE_TRACKERS.join(', ')}`)
	}

	if (!parsed.branchingStrategy) {
		errors.push('Missing required field: branchingStrategy')
	} else if (!VALID_BRANCHING_STRATEGIES.includes(/** @type {BranchingStrategy} */ (parsed.branchingStrategy))) {
		errors.push(
			`Invalid branchingStrategy: ${parsed.branchingStrategy}. Must be one of: ${VALID_BRANCHING_STRATEGIES.join(', ')}`,
		)
	}

	if (errors.length > 0) return { ok: false, errors }

	const modelProfile = VALID_MODEL_PROFILES.includes(/** @type {ModelProfile} */ (parsed.modelProfile))
		? /** @type {ModelProfile} */ (parsed.modelProfile)
		: 'balanced'

	const labels =
		parsed.labels !== null && typeof parsed.labels === 'object'
			? /** @type {{ state: Record<string, string>, type: Record<string, string>, priority: Record<string, string> }} */ (
					parsed.labels
				)
			: { state: {}, type: {}, priority: {} }

	return {
		ok: true,
		config: {
			issueTracker: /** @type {IssueTracker} */ (parsed.issueTracker),
			branchingStrategy: /** @type {BranchingStrategy} */ (parsed.branchingStrategy),
			tddMode: parsed.tddMode !== false,
			nyquistValidation: parsed.nyquistValidation !== false,
			slopsquattingGate: parsed.slopsquattingGate !== false,
			modelProfile,
			e2eCommand: typeof parsed.e2eCommand === 'string' ? parsed.e2eCommand : null,
			labels,
		},
	}
}
