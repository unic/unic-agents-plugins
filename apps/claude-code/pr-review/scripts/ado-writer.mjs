// @ts-check

/**
 * @typedef {{ summaryThreadId: number | null, findingsPosted: number | null }} AdoWriterResult
 */

/**
 * Parses the ADO Writer agent's output block into a structured result.
 * Returns null for both fields when the result block is absent from the output.
 *
 * @param {string} output
 * @returns {AdoWriterResult}
 */
export function parseAdoWriterResult(output) {
	const blockMatch = output.match(/ADO_WRITER_RESULT_START([\s\S]*?)ADO_WRITER_RESULT_END/)
	if (!blockMatch) {
		return { summaryThreadId: null, findingsPosted: null }
	}

	const block = blockMatch[1]

	const threadIdMatch = block.match(/SUMMARY_THREAD_ID:\s*(\d+)/)
	const summaryThreadId = threadIdMatch ? Number(threadIdMatch[1]) : null

	const findingsMatch = block.match(/FINDINGS_POSTED:\s*(\d+)/)
	const findingsPosted = findingsMatch ? Number(findingsMatch[1]) : null

	return { summaryThreadId, findingsPosted }
}
