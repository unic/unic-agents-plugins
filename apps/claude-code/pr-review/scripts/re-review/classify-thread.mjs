// @ts-check

/**
 * @typedef {{ line: number }} LinePos
 * @typedef {{ threadId: number, filePath: string | null, start: LinePos | null, end: LinePos | null, comments: Array<{ content?: string }>, status: string | number, isSummaryThread?: boolean }} PriorThread
 * @typedef {{ filePath: string, startLine: number, endLine: number }} DiffHunk
 */

const RESOLVED_STATUSES = new Set(['fixed', 'wontFix', 'closed', 'byDesign', 2, 3, 4, 5])

/**
 * Classifies a prior review thread into one of four states using diff hunk data.
 * Rules evaluated in order (spec 05):
 *   1. addressed — ADO status is resolved OR line range intersects a diff hunk
 *   2. obsolete  — filePath non-null and absent from diff (or file was deleted)
 *   3. disputed  — at least one comment has no bot signature
 *   4. pending   — all comments carry the bot signature
 *
 * γ-downgrade (ADR-0004): when diffRange is 'full', outputs 'addressed' and 'obsolete'
 * are remapped to 'pending' since diff-position evidence is unreliable on a widened range.
 * 'disputed' is unaffected (its derivation is reviewer-reply-based, not diff-position-based).
 *
 * @param {{ thread: PriorThread, diffHunks: DiffHunk[], signaturePrefix: string, diffRange?: 'full' | 'incremental' }} input
 * @returns {'addressed' | 'disputed' | 'pending' | 'obsolete'}
 */
export function classifyThread({ thread, diffHunks, signaturePrefix, diffRange = 'incremental' }) {
	const { filePath, start, end, comments, status } = thread

	/** @type {'addressed' | 'disputed' | 'pending' | 'obsolete'} */
	let result

	if (RESOLVED_STATUSES.has(status)) {
		result = 'addressed'
	} else {
		const diffFiles = new Set(diffHunks.map((h) => h.filePath))

		/** @type {Map<string, Array<[number, number]>>} */
		const hunkMap = new Map()
		for (const h of diffHunks) {
			const ranges = hunkMap.get(h.filePath) ?? []
			ranges.push([h.startLine, h.endLine])
			hunkMap.set(h.filePath, ranges)
		}

		// Files whose every hunk is [0, 0] were deleted from the PR
		const deletedFiles = new Set(
			[...hunkMap.entries()].filter(([, ranges]) => ranges.every(([s, e]) => s === 0 && e === 0)).map(([fp]) => fp)
		)

		if (filePath !== null && (!diffFiles.has(filePath) || deletedFiles.has(filePath))) {
			result = 'obsolete'
		} else {
			const startLine = start?.line ?? null
			const endLine = end?.line ?? null
			const intersects =
				filePath !== null &&
				startLine !== null &&
				endLine !== null &&
				(hunkMap.get(filePath) ?? []).some(([hs, he]) => Math.max(startLine, hs) <= Math.min(endLine, he))

			if (intersects) {
				result = 'addressed'
			} else {
				const hasHuman = comments.some((c) => !(c.content ?? '').includes(signaturePrefix))
				result = hasHuman ? 'disputed' : 'pending'
			}
		}
	}

	// γ-downgrade: full diff range makes diff-position verdicts unreliable
	if (diffRange === 'full' && (result === 'addressed' || result === 'obsolete')) return 'pending'
	return result
}
