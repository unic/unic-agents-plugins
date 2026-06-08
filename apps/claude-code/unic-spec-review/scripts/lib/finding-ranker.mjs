// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * finding-ranker.mjs - rank Findings by confidence * severity weight.
 *
 * Pure library: no I/O, no external deps, no CLI entry.
 */

/** @import { Finding, Severity } from './finding.mjs' */

/** @type {Readonly<Record<Severity, number>>} */
const SEVERITY_WEIGHT = { critical: 3, important: 2, minor: 1 }

/**
 * Sort findings by confidence * severity weight descending.
 * Stable: equal scores preserve original order.
 * @param {Finding[]} findings
 * @returns {Finding[]}
 */
export function rankFindings(findings) {
	return [...findings].sort((a, b) => {
		const scoreA = a.confidence * (SEVERITY_WEIGHT[a.severity] ?? 1)
		const scoreB = b.confidence * (SEVERITY_WEIGHT[b.severity] ?? 1)
		return scoreB - scoreA
	})
}
