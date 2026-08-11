// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * The four canonical priority labels, most urgent first. Source of truth:
 * `docs/agents/labels.md`.
 *
 * @type {readonly string[]}
 */
export const PRIORITY_LABELS = /** @type {const} */ (['p0', 'p1', 'p2', 'p3'])

/**
 * Derive an issue's priority from its label names.
 *
 * A stream ticket carries no priority, and an untriaged issue may carry none either, so
 * `null` is an expected result rather than an error. When several are present the most
 * urgent wins.
 *
 * @param {readonly string[]} labels - label names carried by the issue
 * @returns {string | null}
 */
export function derivePriority(labels) {
	return PRIORITY_LABELS.find((candidate) => labels.includes(candidate)) ?? null
}
