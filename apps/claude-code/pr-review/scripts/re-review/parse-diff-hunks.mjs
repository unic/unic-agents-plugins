// @ts-check

/**
 * @typedef {{ filePath: string, startLine: number, endLine: number }} DiffHunk
 */

const FILE_HEADER_RE = /^diff --git a\/.* b\/(.*)$/
const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/

/**
 * Parses a unified `git diff` text into an array of per-hunk ranges on the +side.
 *
 * Each entry is `{ filePath, startLine, endLine }`. `filePath` is slash-prefixed
 * (e.g. `/src/foo.ts`) to match the format consumed by `classify-thread` and
 * `match-finding`. No deduplication is performed — every hunk produces an entry.
 *
 * Hunk headers without a `+side` (binary diffs, pure deletes) are skipped.
 * Hunk headers appearing before any `diff --git` line are ignored.
 * CRLF line endings are handled transparently.
 *
 * Pure function. No I/O.
 *
 * @param {string} rawDiff
 * @returns {DiffHunk[]}
 */
export function parseDiffHunks(rawDiff) {
	if (!rawDiff) return []
	/** @type {DiffHunk[]} */
	const hunks = []
	/** @type {string | null} */
	let currentFile = null

	const lines = rawDiff.split(/\r?\n/)
	for (const line of lines) {
		const fileMatch = line.match(FILE_HEADER_RE)
		if (fileMatch) {
			currentFile = `/${fileMatch[1]}`
			continue
		}
		const hunkMatch = line.match(HUNK_HEADER_RE)
		if (hunkMatch && currentFile) {
			const startLine = Number(hunkMatch[1])
			const count = hunkMatch[2] != null ? Number(hunkMatch[2]) : 1
			const endLine = startLine + Math.max(count - 1, 0)
			hunks.push({ filePath: currentFile, startLine, endLine })
		}
	}

	return hunks
}
