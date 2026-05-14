// @ts-check

import { classifyHttpError } from './classify-http-error.mjs'

/**
 * Parses the raw response from the ADO pullRequestWorkItems endpoint.
 * Returns a discriminated union so callers can branch on ok/not-ok without
 * conflating EMPTY-BY-DESIGN (no items linked) with a fetch failure.
 *
 * @param {{ responseText: string, exitCode?: number }} input
 * @returns {{ ok: true, ids: number[] } | { ok: false, reason: 'auth' | 'transient' | 'malformed' | 'empty-response', message: string }}
 */
export function fetchWorkItems({ responseText, exitCode = 0 }) {
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
			let reason
			if (classification.tier === 'aborted') {
				reason = /** @type {const} */ ('auth')
			} else if (classification.kind === 'malformed-request') {
				reason = /** @type {const} */ ('malformed')
			} else {
				reason = /** @type {const} */ ('transient')
			}
			return { ok: false, reason, message: classification.message }
		}
	}

	if (!responseText || !responseText.trim()) {
		return { ok: false, reason: 'empty-response', message: 'Work-item fetch returned an empty response' }
	}

	// JSON parse failed
	if (parsed === null) {
		return {
			ok: false,
			reason: 'malformed',
			message: `Work-item response was not valid JSON: ${responseText.slice(0, 100)}`,
		}
	}

	if (!Array.isArray(parsed?.value)) {
		return { ok: false, reason: 'malformed', message: 'Work-item response missing `value` array' }
	}

	const ids = parsed.value
		.filter(
			(/** @type {unknown} */ wi) =>
				wi != null && typeof wi === 'object' && typeof (/** @type {any} */ (wi).id) === 'number'
		)
		.map((/** @type {{ id: number }} */ wi) => wi.id)
	return { ok: true, ids }
}
