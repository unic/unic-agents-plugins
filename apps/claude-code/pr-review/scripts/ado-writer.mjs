// @ts-check

/**
 * @typedef {{ severity: string, kind: string, message: string }} Notice
 * @typedef {{ summaryThreadId: number | null, findingsPosted: number | null, notices: Notice[] }} AdoWriterResult
 */

/**
 * Parses the ADO Writer agent's output block into a structured result.
 * Returns null for both numeric fields when the result block is absent from the output.
 *
 * @param {string} output
 * @returns {AdoWriterResult}
 */
export function parseAdoWriterResult(output) {
	const blockMatch = output.match(/ADO_WRITER_RESULT_START([\s\S]*?)ADO_WRITER_RESULT_END/)
	if (!blockMatch) {
		return { summaryThreadId: null, findingsPosted: null, notices: [] }
	}

	const block = blockMatch[1]

	const threadIdMatch = block.match(/SUMMARY_THREAD_ID:\s*(\d+)/)
	const summaryThreadId = threadIdMatch ? Number(threadIdMatch[1]) : null

	const findingsMatch = block.match(/FINDINGS_POSTED:\s*(\d+)/)
	const findingsPosted = findingsMatch ? Number(findingsMatch[1]) : null

	const noticesMatch = block.match(/NOTICES:\s*(\[[\s\S]*?\])/)
	let notices = /** @type {Notice[]} */ ([])
	if (noticesMatch) {
		try {
			notices = JSON.parse(noticesMatch[1])
		} catch {
			notices = []
		}
	}

	return { summaryThreadId, findingsPosted, notices }
}
