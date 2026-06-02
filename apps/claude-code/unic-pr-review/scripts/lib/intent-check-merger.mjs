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
 * The merger is pure and context-free: no I/O, and no knowledge of whether the
 * Assessor was spawned. Alongside the merged `items` it returns `diagnostics` —
 * mechanical counts of what it applied and what it ignored. Per ADR-0011,
 * structural safety is free (a drifted-but-well-formed response cannot corrupt
 * the block) but verdict provenance is not: a wholesale silent fallback to
 * `unaddressed` is indistinguishable, to the Reviewer, from a genuine "the diff
 * does not cover this AC". The counts exist so the orchestrator — which alone
 * knows the spawn context and the raw input shape — can warn the Reviewer with
 * a Notice when zero verdicts were applied, and log a maintainer-facing stderr
 * diagnostic on any drop.
 *
 * Total-failure inputs (assessed is null, not an array, or empty) return the
 * skeleton unchanged with all-zero diagnostics; detecting that gross input
 * shape is the orchestrator's job, not the merger's. Note-bearing skeleton
 * items (ADR-0004 hard-stop signal) pass through verbatim, verdicts untouched.
 */

import { pathToFileURL } from 'node:url'
import { isAcVerdict } from './review-summary-renderer.mjs'

/** @import { IntentCheckItem, AcVerdict } from './review-summary-renderer.mjs' */

/**
 * The narrow shape the element guard actually proves: a non-null object with a
 * string `id`. `verdicts` is treated as an untrusted optional bag — each value
 * is validated via `isAcVerdict` before use, so the container shape is all the
 * type needs to promise. Deliberately weaker than {@link IntentCheckItem}.
 *
 * @typedef {{ id: string, verdicts?: Record<string, unknown> }} AssessedItem
 */

/**
 * Mechanical counts describing what the merge applied and ignored. Context-free:
 * the orchestrator interprets these against spawn state to choose Notice/stderr.
 *
 * @typedef {Object} MergeDiagnostics
 * @property {number} assessedReceived - assessed array length (0 when assessed is null/non-array)
 * @property {number} applied - valid verdicts overlaid onto the skeleton
 * @property {number} droppedElements - assessed entries skipped (null, non-object, or missing string id)
 * @property {number} rejectedVerdicts - candidate verdicts present but not a valid AcVerdict
 * @property {number} unmatchedItems - distinct assessed ids absent from the skeleton
 */

/**
 * The merge result: the merged skeleton plus mechanical diagnostics.
 *
 * @typedef {Object} MergeResult
 * @property {IntentCheckItem[]} items - the merged intentCheck array
 * @property {MergeDiagnostics} diagnostics
 */

/**
 * Overlay assessed verdicts onto the skeleton.
 *
 * @param {IntentCheckItem[]} skeleton - structural source of truth (all `unaddressed`)
 * @param {unknown} assessed - Intent Assessor output; untrusted at this boundary
 * @returns {MergeResult} the merged items and mechanical diagnostics
 */
export function mergeIntentCheck(skeleton, assessed) {
	if (!Array.isArray(assessed) || assessed.length === 0) {
		return {
			items: skeleton,
			diagnostics: { assessedReceived: 0, applied: 0, droppedElements: 0, rejectedVerdicts: 0, unmatchedItems: 0 },
		}
	}

	/** @type {Map<string, AssessedItem>} */
	const assessedById = new Map()
	let droppedElements = 0
	for (const item of assessed) {
		if (typeof item === 'object' && item !== null && typeof (/** @type {{ id?: unknown }} */ (item).id) === 'string') {
			const validItem = /** @type {AssessedItem} */ (item)
			assessedById.set(validItem.id, validItem)
		} else {
			droppedElements++
		}
	}

	const skeletonIds = new Set(skeleton.map((item) => item.id))
	let unmatchedItems = 0
	for (const id of assessedById.keys()) {
		if (!skeletonIds.has(id)) unmatchedItems++
	}

	let applied = 0
	let rejectedVerdicts = 0
	const items = skeleton.map((skeletonItem) => {
		if (skeletonItem.note !== undefined) {
			return skeletonItem
		}

		const assessedItem = assessedById.get(skeletonItem.id)
		if (!assessedItem) {
			return skeletonItem
		}

		/** @type {Record<string, AcVerdict>} */
		const mergedVerdicts = {}
		for (const [ac, verdict] of Object.entries(skeletonItem.verdicts)) {
			const candidate = assessedItem.verdicts?.[ac]
			if (isAcVerdict(candidate)) {
				mergedVerdicts[ac] = candidate
				applied++
			} else {
				mergedVerdicts[ac] = verdict
				if (candidate !== undefined) rejectedVerdicts++
			}
		}

		return { ...skeletonItem, verdicts: mergedVerdicts }
	})

	return {
		items,
		diagnostics: { assessedReceived: assessed.length, applied, droppedElements, rejectedVerdicts, unmatchedItems },
	}
}

/** @param {unknown} err */
const errMsg = (err) => (err instanceof Error ? err.message : String(err))

// CLI entry — reads SKELETON_JSON and ASSESSED_JSON from env, writes { items, diagnostics } JSON to stdout.
// Only runs when executed directly: `node scripts/lib/intent-check-merger.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const rawSkeleton = process.env.SKELETON_JSON
	const rawAssessed = process.env.ASSESSED_JSON

	if (!rawSkeleton) {
		process.stderr.write('intent-check-merger: SKELETON_JSON environment variable is required\n')
		process.exit(1)
	}
	if (!rawAssessed) {
		process.stderr.write('intent-check-merger: ASSESSED_JSON environment variable is required\n')
		process.exit(1)
	}

	try {
		const skeleton = JSON.parse(rawSkeleton)
		const assessed = JSON.parse(rawAssessed)
		const result = mergeIntentCheck(skeleton, assessed)
		process.stdout.write(`${JSON.stringify(result)}\n`)
	} catch (err) {
		process.stderr.write(`intent-check-merger: ${errMsg(err)}\n`)
		process.exit(1)
	}
}
