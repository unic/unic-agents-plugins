// @ts-check

/**
 * @typedef {{ line: number }} LinePos
 * @typedef {{ threadId: number, filePath: string | null, start: LinePos | null, end: LinePos | null, comments: Array<{ content?: string }>, status: string | number, isSummaryThread?: boolean, classification?: string }} PriorThread
 * @typedef {{ filePath: string, startLine: number, endLine: number }} Finding
 */

/**
 * Finds the best-matching prior thread for a new finding using file path equality
 * and line-range overlap with ±driftLines tolerance (default 3).
 * Summary threads are always skipped.
 *
 * Returns `null` for a legitimate no-match. Throws a TypeError when the inputs
 * are structurally invalid (distinguishable from a legitimate no-match so callers
 * can surface a DEGRADED Notice instead of silently treating it as no-match).
 *
 * @param {{ finding: Finding, priorThreads: PriorThread[], driftLines?: number }} input
 * @returns {PriorThread | null}
 */
export function matchFinding({ finding, priorThreads, driftLines = 3 }) {
	if (!Array.isArray(priorThreads)) {
		throw new TypeError('priorThreads must be an array')
	}
	if (finding == null || typeof finding !== 'object') {
		throw new TypeError('finding must be an object with filePath, startLine, and endLine')
	}
	const { filePath, startLine, endLine } = finding
	if (typeof filePath !== 'string' || typeof startLine !== 'number' || typeof endLine !== 'number') {
		throw new TypeError('finding must have filePath (string), startLine (number), and endLine (number)')
	}
	const fs = startLine - driftLines
	const fe = endLine + driftLines

	for (const t of priorThreads) {
		if (t.isSummaryThread) continue
		if (t.filePath !== filePath) continue
		if (t.start == null || t.end == null) continue
		const ts = t.start.line - driftLines
		const te = t.end.line + driftLines
		if (Math.max(fs, ts) <= Math.min(fe, te)) return t
	}
	return null
}
