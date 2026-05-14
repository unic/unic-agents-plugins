// @ts-check

import { classifyHttpError } from './classify-http-error.mjs'

/**
 * Routes an ADO write-call outcome through the canonical HTTP-tier mapping and
 * extracts the created resource's `id` from the response body.
 *
 * @param {{ httpExit: number, responseText: string, errStream?: string }} input
 * @returns {{ ok: true, id: number | null } | { ok: false, tier: string, kind: string, message: string }}
 */
export function parseWriteResponse({ httpExit, responseText, errStream = '' }) {
	let bodyStatus = 0
	/** @type {any} */
	let parsed = null

	if (responseText?.trim()) {
		try {
			parsed = JSON.parse(responseText)
			bodyStatus = typeof parsed?.statusCode === 'number' ? parsed.statusCode : 0
		} catch {
			// parse failed — handled below
		}
	}

	const classified = classifyHttpError({ status: bodyStatus, body: responseText, exitCode: httpExit })

	if (classified.tier !== 'ok') {
		const errDetail = errStream ? ` — ${errStream.slice(0, 200)}` : ''
		return { ok: false, tier: classified.tier, kind: classified.kind, message: classified.message + errDetail }
	}

	// tier is 'ok' — try to extract a numeric id from the response body
	if (parsed !== null && typeof parsed?.id === 'number') {
		return { ok: true, id: parsed.id }
	}

	// 404 and 409 are canonical-ok with no id (thread gone / state already changed)
	if (bodyStatus === 404 || bodyStatus === 409) {
		return { ok: true, id: null }
	}

	// 200/201 without a numeric id — the write response is malformed
	const errDetail = errStream ? ` — ${errStream.slice(0, 200)}` : ''
	return {
		ok: false,
		tier: 'degraded',
		kind: 'malformed-response',
		message: `Write response did not contain a numeric id field${errDetail}`,
	}
}
