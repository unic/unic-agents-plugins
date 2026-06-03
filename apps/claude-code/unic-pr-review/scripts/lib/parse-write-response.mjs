// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * parse-write-response.mjs — normalise the result of an `az devops invoke`
 * POST into a single, predictable shape.
 *
 * The ADO Writer (agents/ado-writer.md) POSTs Review Threads (create path) and
 * will later PATCH existing threads (re-review path). Both endpoints return a
 * JSON object carrying a numeric `id` on success, so a single parser covers
 * both: success is "exit 0 AND a numeric id in the parsed body". Anything else
 * is a failure with a human-readable `error`.
 */

/**
 * @typedef {Object} WriteResponse
 * @property {boolean} success
 * @property {number | null} threadId
 * @property {string | null} error
 */

/**
 * Parse the stdout/stderr from `az devops invoke` POST and return a normalised
 * result. Covers both the create-thread and future patch-thread paths — both
 * return an object with a numeric `id` field on success.
 *
 * @param {string} stdout - raw stdout from az devops invoke
 * @param {string} stderr - raw stderr from az devops invoke
 * @param {boolean} cmdOk - true when the process exited with status 0
 * @returns {WriteResponse}
 */
export function parseWriteResponse(stdout, stderr, cmdOk) {
	if (!cmdOk) {
		return {
			success: false,
			threadId: null,
			error: stderr.trim() || stdout.trim() || 'az devops invoke exited non-zero',
		}
	}

	let parsed
	try {
		parsed = JSON.parse(stdout)
	} catch {
		return { success: false, threadId: null, error: `Response is not valid JSON: ${stdout.slice(0, 200)}` }
	}

	if (parsed === null || typeof parsed !== 'object') {
		return {
			success: false,
			threadId: null,
			error: `Unexpected response type: ${parsed === null ? 'null' : typeof parsed}`,
		}
	}

	const obj = /** @type {Record<string, unknown>} */ (parsed)
	const id = obj.id
	if (typeof id !== 'number') {
		const error =
			typeof obj.message === 'string' && obj.message.trim() !== ''
				? `ADO error: ${obj.message}`
				: `Response missing numeric id field: ${stdout.slice(0, 200)}`
		return { success: false, threadId: null, error }
	}

	return { success: true, threadId: id, error: null }
}
