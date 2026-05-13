// @ts-check

import { classifyHttpError } from './classify-http-error.mjs'

/**
 * @typedef {{ id: number, sourceRefCommit?: { commitId?: string } | null }} ADOIteration
 */

/**
 * Parses the raw response from the ADO pullRequestIterations endpoint.
 * Returns a discriminated union so the Fetcher prompt can branch on ok/not-ok
 * without falling back to the invalid `iterationId=1` default.
 *
 * @param {{ responseText: string, exitCode?: number }} input
 * @returns {{ ok: true, latestIterationId: number, latestCommitSha: string }
 *          | { ok: false, reason: 'empty-iterations' | 'auth' | 'transient' | 'malformed', message: string }}
 */
export function fetchIterations({ responseText, exitCode = 0 }) {
	// Try to extract an HTTP status code from the response body (ADO embeds statusCode in error JSON)
	let status = 0
	/** @type {any} */
	let parsed = null

	if (responseText?.trim()) {
		try {
			parsed = JSON.parse(responseText)
			status = typeof parsed?.statusCode === 'number' ? parsed.statusCode : 0
		} catch {
			// parse failed — handled below
		}
	}

	// Route HTTP / network failures through the canonical tier mapper
	if (exitCode !== 0 || status >= 400) {
		const classification = classifyHttpError({ status, body: responseText, exitCode })
		if (classification.tier !== 'ok') {
			const reason = classification.tier === 'aborted' ? 'auth' : 'transient'
			return { ok: false, reason, message: classification.message }
		}
	}

	// No response body at all (and exitCode was 0, so not caught above)
	if (!responseText || !responseText.trim()) {
		return { ok: false, reason: 'malformed', message: 'Iterations fetch returned an empty response' }
	}

	// JSON parse failed
	if (parsed === null) {
		return {
			ok: false,
			reason: 'malformed',
			message: `Iterations response was not valid JSON: ${responseText.slice(0, 100)}`,
		}
	}

	// Missing value array
	if (!Array.isArray(parsed?.value)) {
		return { ok: false, reason: 'malformed', message: 'Iterations response missing `value` array' }
	}

	// Empty value array → ABORTED (cannot sign a review without a valid iteration ID)
	if (parsed.value.length === 0) {
		return {
			ok: false,
			reason: 'empty-iterations',
			message: 'Iterations endpoint returned empty value array. Cannot sign Review with a valid Iteration ID.',
		}
	}

	// Find the latest iteration by id
	const iterations = /** @type {ADOIteration[]} */ (parsed.value)
	const latest = iterations.reduce((max, it) => (it.id > max.id ? it : max), iterations[0])
	return {
		ok: true,
		latestIterationId: latest.id,
		latestCommitSha: latest.sourceRefCommit?.commitId ?? '',
	}
}
