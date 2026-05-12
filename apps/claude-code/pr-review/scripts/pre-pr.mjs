// @ts-check

/**
 * @typedef {{ changedFiles: string[], filteredFiles: string[], rawDiff: string }} PrePrContext
 */

/**
 * Skip-list patterns for files that should not be passed to review agents.
 * Matches:
 *   - C# source-generated files (*.g.cs)
 *   - swagger.md / swagger.json
 *   - Serialization YAML files (*.serialization.yaml / *.serialization.yml)
 *   - Files named generated-types.* or under a generated/ directory
 *
 * @param {string} filePath - Leading-slash forward-slash path, e.g. /src/foo.ts
 * @returns {boolean} true if the file should be excluded from review
 */
export function shouldSkipFile(filePath) {
	const lower = filePath.toLowerCase()

	// C# source-generated files
	if (lower.endsWith('.g.cs')) return true

	// swagger
	if (lower.endsWith('swagger.md') || lower.endsWith('swagger.json')) return true

	// Serialization YAMLs
	if (lower.endsWith('.serialization.yaml') || lower.endsWith('.serialization.yml')) return true

	// generated-types.*  (e.g. generated-types.ts, generated-types.d.ts)
	const basename = filePath.split('/').pop() ?? ''
	if (basename.toLowerCase().startsWith('generated-types.')) return true

	// files under a generated/ directory segment
	if (filePath.includes('/generated/')) return true

	return false
}

/**
 * Parses the file paths touched by a `git diff` output.
 * Extracts the `b/` path from each `diff --git` header and returns unique
 * paths with a leading slash, matching the ADO path format.
 *
 * @param {string} diffText - Raw output of `git diff`
 * @returns {string[]} Unique file paths with leading slash
 */
export function parseChangedFilesFromDiff(diffText) {
	if (!diffText) return []

	const seen = new Set()
	const paths = []

	for (const line of diffText.split('\n')) {
		const m = line.match(/^diff --git a\/.*? b\/(.+)$/)
		if (m) {
			const filePath = `/${m[1]}`
			if (!seen.has(filePath)) {
				seen.add(filePath)
				paths.push(filePath)
			}
		}
	}

	return paths
}

/**
 * Builds the Pre-PR context object from a raw git diff string.
 * Returns all changed files, the subset that should be reviewed (filtered),
 * and the raw diff text.
 *
 * @param {string} diffText - Raw output of `git diff origin/<branch>...HEAD`
 * @returns {PrePrContext}
 */
export function buildPrePrContext(diffText) {
	const changedFiles = parseChangedFilesFromDiff(diffText)
	const filteredFiles = changedFiles.filter((f) => !shouldSkipFile(f))
	return { changedFiles, filteredFiles, rawDiff: diffText }
}
