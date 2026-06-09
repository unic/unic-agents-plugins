// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * hat-mapper.mjs - map dimensions to Six Thinking Hats and group Findings by hat.
 *
 * Pure library: no I/O, no external deps, no CLI entry.
 */

/** @import { Finding, Hat, Dimension } from './finding.mjs' */

/**
 * Dimension-to-hat mapping per ADR-0003.
 * @type {Readonly<Record<Dimension, Hat>>}
 */
export const DIMENSION_HAT = /** @type {any} */ ({
	gaps: 'black',
	ambiguity: 'black',
	'spec-versus-design': 'black',
	'spec-versus-live': 'black',
	'internal-consistency': 'black',
	testability: 'black',
	feasibility: 'black',
	'non-functional': 'black',
	green: 'green',
	yellow: 'yellow',
	red: 'red',
})

/**
 * Display labels for each hat section in the report.
 * @type {Readonly<Record<Hat, string>>}
 */
export const HAT_LABELS = /** @type {any} */ ({
	black: 'Black Hat - Critical Analysis',
	green: 'Green Hat - Alternatives',
	yellow: 'Yellow Hat - Value & Justification',
	red: 'Red Hat - User Reaction',
	white: 'White Hat - Facts',
	blue: 'Blue Hat - Synthesis',
})

/**
 * Preferred rendering order for hat sections.
 * @type {ReadonlyArray<Hat>}
 */
export const HAT_ORDER = ['black', 'green', 'yellow', 'red', 'white', 'blue']

/**
 * Map a dimension string to its hat.
 * Falls back to 'black' for unknown dimensions.
 * @param {string} dimension
 * @returns {Hat}
 */
export function dimensionToHat(dimension) {
	return DIMENSION_HAT[/** @type {Dimension} */ (dimension)] ?? 'black'
}

/**
 * Group findings by their hat value.
 * Uses f.hat directly; falls back to dimensionToHat(f.dimension) if hat absent.
 * Returns a Map preserving insertion sequence.
 * @param {Finding[]} findings
 * @returns {Map<Hat, Finding[]>}
 */
export function groupByHat(findings) {
	/** @type {Map<Hat, Finding[]>} */
	const groups = new Map()
	for (const f of findings) {
		const hat = /** @type {Hat} */ (f.hat ?? dimensionToHat(f.dimension))
		const existing = groups.get(hat)
		if (existing) existing.push(f)
		else groups.set(hat, [f])
	}
	return groups
}
