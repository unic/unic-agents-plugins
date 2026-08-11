// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * The eight canonical state labels, in lifecycle order. Source of truth:
 * `docs/agents/labels.md`. On this tracker the canonical names are also the literal
 * label strings, so no mapping layer is needed.
 *
 * @type {readonly string[]}
 */
export const STATE_LABELS = /** @type {const} */ ([
	'needs-triage',
	'needs-info',
	'needs-specs',
	'ready-for-agent',
	'ready-for-human',
	'resolved',
	'closed',
	'rejected',
])

/** The state reported for an issue that carries no state label at all. */
export const UNLABELLED = 'unlabelled'

/**
 * @typedef {{ state: string, className: string }} Readiness
 */

/**
 * Classify an issue's readiness from its label names.
 *
 * An issue should carry exactly one state label. When several are present — which the
 * one-per-issue discipline forbids but nothing enforces — the first in lifecycle order
 * wins, so the result stays deterministic instead of depending on label ordering.
 *
 * @param {readonly string[]} labels - label names carried by the issue
 * @returns {Readiness}
 */
export function classifyReadiness(labels) {
	const state = STATE_LABELS.find((candidate) => labels.includes(candidate)) ?? UNLABELLED
	return { state, className: `state-${state}` }
}
