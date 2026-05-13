// @ts-check

/**
 * Parses the raw response from the ADO pullRequestWorkItems endpoint.
 * Returns a discriminated union so callers can branch on ok/not-ok without
 * conflating EMPTY-BY-DESIGN (no items linked) with a fetch failure.
 *
 * @param {{ responseText: string, exitCode?: number }} input
 * @returns {{ ok: true, ids: number[] } | { ok: false, reason: string, message: string }}
 */
export function fetchWorkItems({ responseText, exitCode = 0 }) {
	if (exitCode !== 0) {
		const detail = responseText ? responseText.slice(0, 200) : 'no response body'
		return { ok: false, reason: 'fetch-failed', message: `Work-item fetch failed (exit ${exitCode}): ${detail}` }
	}

	if (!responseText || !responseText.trim()) {
		return { ok: false, reason: 'empty-response', message: 'Work-item fetch returned an empty response' }
	}

	let parsed
	try {
		parsed = JSON.parse(responseText)
	} catch {
		return {
			ok: false,
			reason: 'malformed',
			message: `Work-item response was not valid JSON: ${responseText.slice(0, 100)}`,
		}
	}

	if (!Array.isArray(parsed?.value)) {
		return { ok: false, reason: 'malformed', message: 'Work-item response missing `value` array' }
	}

	const ids = parsed.value.map((/** @type {{ id: number }} */ wi) => wi.id).filter((id) => typeof id === 'number')
	return { ok: true, ids }
}
