// @ts-check

/**
 * @typedef {{ severity: string, kind: string, message: string }} Notice
 * @typedef {{ ok: true, summaryThreadId: number | null, findingsPosted: number, notices: Notice[] }} AdoWriterResultOk
 * @typedef {{ ok: false, reason: 'missing-block' | 'malformed', message?: string }} AdoWriterResultErr
 * @typedef {AdoWriterResultOk | AdoWriterResultErr} AdoWriterResult
 */

/**
 * Parses the ADO Writer agent's output block into a discriminated-union result.
 * Returns { ok: false, reason: 'missing-block' } when the result block is absent.
 * Returns { ok: false, reason: 'malformed' } when the block is present but FINDINGS_POSTED is missing.
 *
 * @param {string} output
 * @returns {AdoWriterResult}
 */
export function parseAdoWriterResult(output) {
	const blockMatch = output.match(/ADO_WRITER_RESULT_START([\s\S]*?)ADO_WRITER_RESULT_END/)
	if (!blockMatch) {
		return { ok: false, reason: 'missing-block' }
	}

	const block = blockMatch[1]

	const threadIdMatch = block.match(/SUMMARY_THREAD_ID:\s*(\d+)/)
	const summaryThreadId = threadIdMatch ? Number(threadIdMatch[1]) : null

	const findingsMatch = block.match(/FINDINGS_POSTED:\s*(\d+)/)
	if (!findingsMatch) {
		return { ok: false, reason: 'malformed' }
	}
	const findingsPosted = Number(findingsMatch[1])

	const noticesMatch = block.match(/NOTICES:\s*([\s\S]+?)(?=\n[A-Z_]|\n*$)/)
	let notices = /** @type {Notice[]} */ ([])
	if (noticesMatch) {
		try {
			notices = JSON.parse(noticesMatch[1].trim())
		} catch {
			return { ok: false, reason: 'malformed', message: 'Failed to parse NOTICES JSON from ADO Writer output' }
		}
	}

	return { ok: true, summaryThreadId, findingsPosted, notices }
}
