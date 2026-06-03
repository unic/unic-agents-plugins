// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * severity-bucketer.mjs — map a 0-100 Confidence Score to a Severity bucket
 * per the thresholds defined in ADR-0002.
 *
 * Findings below 60 are dropped before the reviewer sees them.
 */

/**
 * @typedef {'critical' | 'important' | 'minor'} Severity
 */

/** @type {Record<string, number>} */
export const SEVERITY_ORDER = { critical: 0, important: 1, minor: 2 }

/**
 * Map a Confidence Score to a Severity bucket.
 *
 * Thresholds (inclusive at the lower bound):
 *   - 90-100 → critical
 *   - 80-89  → important
 *   - 60-79  → minor
 *   - <60    → null (Finding dropped entirely)
 *
 * Non-finite or out-of-range inputs throw — they almost always signal a
 * programming bug upstream and silently bucketing them as `null` would hide it.
 *
 * @param {number} confidence - integer 0-100
 * @returns {Severity | null} null means the Finding should be dropped
 * @throws {Error} when confidence is not finite or is outside 0-100
 */
export function bucketBySeverity(confidence) {
	if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
		throw new Error(`bucketBySeverity: confidence must be a finite number in 0-100, got ${confidence}`)
	}
	if (confidence >= 90) return 'critical'
	if (confidence >= 80) return 'important'
	if (confidence >= 60) return 'minor'
	return null
}
