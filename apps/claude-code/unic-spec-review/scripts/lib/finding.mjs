// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * finding.mjs - Finding schema, type guards, and normalisation helpers.
 *
 * Pure library: no I/O, no external deps, no CLI entry. Used by hat-mapper,
 * finding-ranker, report-renderer, and the Blue orchestrator command.
 */

/** @typedef {'black' | 'green' | 'yellow' | 'red' | 'white' | 'blue'} Hat */

/** @typedef {'gaps' | 'ambiguity' | 'spec-versus-design' | 'spec-versus-live' | 'internal-consistency' | 'testability' | 'feasibility' | 'non-functional' | 'green' | 'yellow' | 'red'} Dimension */

/** @typedef {'critical' | 'important' | 'minor'} Severity */

/**
 * @typedef {Object} Finding
 * @property {Hat} hat
 * @property {Dimension} dimension
 * @property {number} confidence
 * @property {Severity} severity
 * @property {string | null} anchor
 * @property {string} title
 * @property {string} body
 */

/** @type {ReadonlyArray<Hat>} */
export const VALID_HATS = ['black', 'green', 'yellow', 'red', 'white', 'blue']

/** @type {ReadonlyArray<Dimension>} */
export const VALID_DIMENSIONS = [
	'gaps',
	'ambiguity',
	'spec-versus-design',
	'spec-versus-live',
	'internal-consistency',
	'testability',
	'feasibility',
	'non-functional',
	'green',
	'yellow',
	'red',
]

/** @type {ReadonlyArray<Severity>} */
export const VALID_SEVERITIES = ['critical', 'important', 'minor']

/**
 * Return null if obj is a valid Finding, or an error string if it is not.
 * @param {unknown} obj
 * @returns {string | null}
 */
export function validateFinding(obj) {
	if (!obj || typeof obj !== 'object') return 'not an object'
	const f = /** @type {Record<string, unknown>} */ (obj)
	if (typeof f.title !== 'string' || !f.title) return 'missing title'
	if (typeof f.body !== 'string' || !f.body) return 'missing body'
	if (!VALID_SEVERITIES.includes(/** @type {any} */ (f.severity))) return `invalid severity: ${f.severity}`
	if (typeof f.confidence !== 'number') return 'confidence must be a number'
	if (f.confidence < 0 || f.confidence > 100) return `confidence out of range: ${f.confidence}`
	if (f.anchor !== null && typeof f.anchor !== 'string') return 'anchor must be string or null'
	if (!VALID_HATS.includes(/** @type {any} */ (f.hat))) return `invalid hat: ${f.hat}`
	if (!VALID_DIMENSIONS.includes(/** @type {any} */ (f.dimension))) return `invalid dimension: ${f.dimension}`
	return null
}

/**
 * Normalise a raw agent response item to a Finding.
 * Handles gaps-agent legacy format (description instead of body).
 * Adds hat and dimension when the agent response omits them.
 * Does NOT validate confidence threshold - callers filter by threshold.
 * @param {Record<string, unknown>} raw
 * @param {Hat} hat
 * @param {Dimension} dimension
 * @returns {Finding}
 */
export function normalizeFinding(raw, hat, dimension) {
	const body =
		typeof raw.body === 'string' && raw.body ? raw.body : typeof raw.description === 'string' ? raw.description : ''
	return {
		hat: VALID_HATS.includes(/** @type {any} */ (raw.hat)) ? /** @type {Hat} */ (raw.hat) : hat,
		dimension: VALID_DIMENSIONS.includes(/** @type {any} */ (raw.dimension))
			? /** @type {Dimension} */ (raw.dimension)
			: dimension,
		confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
		severity: VALID_SEVERITIES.includes(/** @type {any} */ (raw.severity))
			? /** @type {Severity} */ (raw.severity)
			: 'minor',
		anchor: typeof raw.anchor === 'string' ? raw.anchor : null,
		title: typeof raw.title === 'string' ? raw.title : '',
		body,
	}
}
