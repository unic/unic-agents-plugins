// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * intent-check-merger.mjs — overlay the Intent Assessor's live AC verdicts onto
 * the Intent Checker's unassessed skeleton, per ADR-0011.
 *
 * The skeleton is the structural source of truth: the Assessor can only colour
 * in verdicts, never add, drop, rename, or reorder ACs. A verdict is applied
 * only when it is present for a matching item + AC key and is a valid
 * {@link AcVerdict} (validated via the renderer's `isAcVerdict`, the single
 * source of truth). Otherwise the skeleton's `unaddressed` stands.
 *
 * Total-failure inputs (assessed is null, not an array, or empty) return the
 * skeleton unchanged, giving free graceful degradation to the all-`unaddressed`
 * behaviour. Note-bearing skeleton items (ADR-0004 hard-stop signal) pass
 * through verbatim, verdicts untouched.
 */

import { isAcVerdict } from './review-summary-renderer.mjs'

/** @import { IntentCheckItem } from './review-summary-renderer.mjs' */

/**
 * Overlay assessed verdicts onto the skeleton.
 *
 * @param {IntentCheckItem[]} skeleton - structural source of truth (all `unaddressed`)
 * @param {unknown} assessed - Intent Assessor output; untrusted at this boundary
 * @returns {IntentCheckItem[]} the merged intentCheck array
 */
export function mergeIntentCheck(skeleton, assessed) {
	if (!Array.isArray(assessed) || assessed.length === 0) {
		return skeleton
	}

	/** @type {Map<string, IntentCheckItem>} */
	const assessedById = new Map()
	for (const item of assessed) {
		if (typeof item === 'object' && item !== null && typeof (/** @type {{ id?: unknown }} */ (item).id) === 'string') {
			const validItem = /** @type {IntentCheckItem} */ (item)
			assessedById.set(validItem.id, validItem)
		}
	}

	return skeleton.map((skeletonItem) => {
		if (skeletonItem.note !== undefined) {
			return skeletonItem
		}

		const assessedItem = assessedById.get(skeletonItem.id)
		if (!assessedItem) {
			return skeletonItem
		}

		/** @type {Record<string, import('./review-summary-renderer.mjs').AcVerdict>} */
		const mergedVerdicts = {}
		for (const [ac, verdict] of Object.entries(skeletonItem.verdicts)) {
			const candidate = assessedItem.verdicts?.[ac]
			mergedVerdicts[ac] = isAcVerdict(candidate) ? candidate : verdict
		}

		return { ...skeletonItem, verdicts: mergedVerdicts }
	})
}
