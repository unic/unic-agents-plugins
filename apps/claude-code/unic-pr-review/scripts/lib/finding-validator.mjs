// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * finding-validator.mjs — boundary validator for Finding objects emitted by
 * Review Aspect agents.
 *
 * Agent output arrives as untrusted JSON. Every downstream module assumes the
 * Finding shape is correct, so we validate once here and reject malformed
 * inputs with a descriptive error rather than letting bad data propagate.
 */

import { bucketBySeverity } from './severity-bucketer.mjs'

/** @import { Severity } from './severity-bucketer.mjs' */

/**
 * @typedef {'fixed' | 'partial' | 'ignored'} PriorVerdict
 */

/**
 * @typedef {Object} RawFinding
 * @property {string} filePath
 * @property {number} startLine
 * @property {number} confidence
 * @property {string} title
 * @property {string} body
 * @property {string} [suggestion]
 * @property {PriorVerdict} [priorVerdict]
 */

/**
 * @typedef {Object} ValidatedFinding
 * @property {Severity} severity
 * @property {number} confidence
 * @property {string} filePath
 * @property {number} startLine
 * @property {string} title
 * @property {string} body
 * @property {string} [suggestion]
 * @property {PriorVerdict} [priorVerdict]
 */

/**
 * Validate a single raw Finding emitted by a Review Aspect agent.
 *
 * Returns the normalised Finding (with derived `severity`) on success.
 * Returns `null` when confidence is below the drop threshold (< 60). Note:
 * sub-threshold findings short-circuit before the remaining shape checks
 * run, so a low-confidence Finding with otherwise-garbage fields is silently
 * dropped rather than reported as malformed.
 * Throws on any shape, type, or confidence-range violation (non-finite or
 * outside 0–100, surfaced via `bucketBySeverity`).
 *
 * @param {unknown} raw
 * @returns {ValidatedFinding | null}
 * @throws {Error} on malformed input
 */
export function parseFinding(raw) {
	if (raw == null || typeof raw !== 'object') {
		throw new Error(`parseFinding: expected object, got ${raw === null ? 'null' : typeof raw}`)
	}
	const r = /** @type {Record<string, unknown>} */ (raw)

	if (typeof r.confidence !== 'number') {
		throw new Error('parseFinding: confidence must be a number')
	}
	const severity = bucketBySeverity(r.confidence)
	if (severity === null) return null

	if (typeof r.filePath !== 'string' || r.filePath.length === 0) {
		throw new Error('parseFinding: filePath must be a non-empty string')
	}
	if (typeof r.startLine !== 'number' || !Number.isInteger(r.startLine) || r.startLine < 1) {
		throw new Error(`parseFinding: startLine must be a positive integer, got ${r.startLine}`)
	}
	if (typeof r.title !== 'string' || r.title.length === 0) {
		throw new Error('parseFinding: title must be a non-empty string')
	}
	if (typeof r.body !== 'string' || r.body.length === 0) {
		throw new Error('parseFinding: body must be a non-empty string')
	}

	const suggestion = typeof r.suggestion === 'string' && r.suggestion.trim().length > 0 ? r.suggestion : undefined

	const PRIOR_VERDICTS = /** @type {readonly string[]} */ (['fixed', 'partial', 'ignored'])
	const priorVerdict =
		typeof r.priorVerdict === 'string' && PRIOR_VERDICTS.includes(r.priorVerdict)
			? /** @type {PriorVerdict} */ (r.priorVerdict)
			: undefined

	return {
		severity,
		confidence: r.confidence,
		filePath: r.filePath,
		startLine: r.startLine,
		title: r.title,
		body: r.body,
		...(suggestion !== undefined && { suggestion }),
		...(priorVerdict !== undefined && { priorVerdict }),
	}
}
