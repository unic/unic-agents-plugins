#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * render-summary.mjs — CLI bridge between the slash command and the renderer.
 *
 * Reads the Review Aspect agent's JSON output from the `FINDINGS_JSON`
 * environment variable, validates each Finding through `parseFinding`, and
 * writes the rendered Review Summary markdown to stdout.
 *
 * The optional `INTENT_CHECK_JSON` environment variable carries the Intent
 * Checker's `intentCheck` array (Pre-PR intent gathering). When present and
 * non-empty it is parsed, malformed items are dropped with a stderr note, and
 * the survivors are passed to the renderer, which surfaces the Intent Check
 * block above the Severity sections. Absent or empty → no Intent Check block.
 *
 * The optional `NOTICES_JSON` environment variable carries a serialised
 * {@link import('./lib/notices.mjs').NoticesContext} plain object. When present,
 * it is rendered via `renderNotices` and forwarded to the renderer as the Notices
 * block. A non-object value or invalid JSON is logged to stderr and silently
 * ignored. Absent or empty → no Notices block.
 *
 * Exposed as a standalone script so the slash command can shell out
 * cross-platform (Windows cmd / PowerShell / bash) without an inline
 * `node -e` snippet whose quoting rules differ per shell.
 */

import { parseFinding } from './lib/finding-validator.mjs'
import { renderNotices } from './lib/notices.mjs'
import { isAcVerdict, renderReviewSummary } from './lib/review-summary-renderer.mjs'

/**
 * Best-effort id for a dropped IntentCheckItem warning, so stderr names which
 * item failed instead of an opaque "dropped malformed item".
 * @param {unknown} item
 * @returns {string}
 */
function idLabel(item) {
	const id = /** @type {{ id?: unknown }} */ (item)?.id
	return typeof id === 'string' ? id : '?'
}

const raw = process.env.FINDINGS_JSON
if (!raw) {
	process.stderr.write('render-summary: FINDINGS_JSON environment variable is required\n')
	process.exit(1)
}

let parsed
try {
	parsed = JSON.parse(raw)
} catch (err) {
	process.stderr.write(
		`render-summary: FINDINGS_JSON is not valid JSON — ${err instanceof Error ? err.message : String(err)}\n`
	)
	process.exit(1)
}

if (!parsed || typeof parsed !== 'object') {
	process.stderr.write('render-summary: FINDINGS_JSON must be an object\n')
	process.exit(1)
}

const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : []
const positiveObservations = Array.isArray(parsed.positiveObservations) ? parsed.positiveObservations : []

const findings = []
for (const rawFinding of rawFindings) {
	try {
		const f = parseFinding(rawFinding)
		if (f) findings.push(f)
	} catch (err) {
		process.stderr.write(
			`render-summary: dropped malformed Finding — ${err instanceof Error ? err.message : String(err)}\n`
		)
	}
}

const rawIntentCheck = process.env.INTENT_CHECK_JSON
/** @type {import('./lib/review-summary-renderer.mjs').IntentCheckItem[] | undefined} */
let intentCheck
if (rawIntentCheck?.trim()) {
	try {
		const parsedIntent = JSON.parse(rawIntentCheck)
		if (!Array.isArray(parsedIntent)) {
			process.stderr.write('render-summary: INTENT_CHECK_JSON must be an array — ignoring\n')
		} else {
			intentCheck = parsedIntent.filter((item) => {
				// `verdicts` must be a non-null plain object: the renderer calls
				// Object.entries(item.verdicts), which throws on null (typeof null ===
				// 'object') and yields nonsense indices on arrays.
				const verdicts = item?.verdicts
				if (
					!item ||
					typeof item !== 'object' ||
					typeof item.id !== 'string' ||
					typeof item.title !== 'string' ||
					typeof verdicts !== 'object' ||
					verdicts === null ||
					Array.isArray(verdicts)
				) {
					process.stderr.write(`render-summary: dropped malformed IntentCheckItem (id=${idLabel(item)})\n`)
					return false
				}
				// Verdict values are rendered verbatim into the PR summary, so an
				// off-spec value (object, number, typo) would surface as garbage like
				// `AC 1: [object Object]`. Drop the whole item instead.
				const badVerdict = Object.values(verdicts).find((v) => !isAcVerdict(v))
				if (badVerdict !== undefined) {
					process.stderr.write(
						`render-summary: dropped IntentCheckItem (id=${idLabel(item)}) with invalid verdict value: ${JSON.stringify(badVerdict)}\n`
					)
					return false
				}
				return true
			})
		}
	} catch (err) {
		process.stderr.write(
			`render-summary: INTENT_CHECK_JSON is not valid JSON — ${err instanceof Error ? err.message : String(err)}\n`
		)
	}
}

const rawNotices = process.env.NOTICES_JSON
let notices = ''
if (rawNotices?.trim()) {
	try {
		const parsedNoticesCtx = JSON.parse(rawNotices)
		if (!parsedNoticesCtx || typeof parsedNoticesCtx !== 'object' || Array.isArray(parsedNoticesCtx)) {
			process.stderr.write('render-summary: NOTICES_JSON must be a plain object — ignoring\n')
		} else {
			notices = renderNotices(/** @type {import('./lib/notices.mjs').NoticesContext} */ (parsedNoticesCtx))
		}
	} catch (err) {
		process.stderr.write(
			`render-summary: NOTICES_JSON is not valid JSON — ${err instanceof Error ? err.message : String(err)}\n`
		)
	}
}

const summary = renderReviewSummary({
	findings,
	positiveObservations,
	iteration: 1,
	intentCheck,
	notices: notices || undefined,
})

process.stdout.write(summary)
