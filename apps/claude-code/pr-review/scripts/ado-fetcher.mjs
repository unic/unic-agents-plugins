// @ts-check

/**
 * @typedef {{ id: number, sourceRefCommit?: { commitId?: string } | null }} ADOIteration
 * @typedef {{ latestIterationId: number, latestCommitSha: string }} IterationResult
 */

/**
 * Parses the ADO pullRequestIterations value array and returns the latest
 * iteration ID and its commit SHA. Defaults gracefully when no iterations
 * are returned.
 *
 * @param {ADOIteration[]} iterations
 * @returns {IterationResult}
 */
export function parseIterations(iterations) {
	if (iterations.length === 0) {
		return { latestIterationId: 1, latestCommitSha: '' }
	}

	const latest = iterations.reduce((max, it) => (it.id > max.id ? it : max), iterations[0])
	return {
		latestIterationId: latest.id,
		latestCommitSha: latest.sourceRefCommit?.commitId ?? '',
	}
}

/**
 * Parses the ADO pullRequestWorkItems response and returns an array of work item IDs.
 * Returns an empty array when no work items are linked or when the command failed.
 *
 * @param {{ value?: Array<{ id: number }> } | null | undefined} response
 * @returns {number[]}
 */
export function parseWorkItemIds(response) {
	return (response?.value ?? []).map((wi) => wi.id)
}
