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
 * Exposed as a standalone script so the slash command can shell out
 * cross-platform (Windows cmd / PowerShell / bash) without an inline
 * `node -e` snippet whose quoting rules differ per shell.
 */

import { parseFinding } from './lib/finding-validator.mjs'
import { renderReviewSummary } from './lib/review-summary-renderer.mjs'

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
if (rawIntentCheck && rawIntentCheck.trim() !== '') {
	try {
		const parsedIntent = JSON.parse(rawIntentCheck)
		if (!Array.isArray(parsedIntent)) {
			process.stderr.write('render-summary: INTENT_CHECK_JSON must be an array — ignoring\n')
		} else {
			intentCheck = parsedIntent.filter((item) => {
				if (!item || typeof item !== 'object' || !item.id || !item.title || typeof item.verdicts !== 'object') {
					process.stderr.write('render-summary: dropped malformed IntentCheckItem\n')
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

const summary = renderReviewSummary({
	findings,
	positiveObservations,
	iteration: 1,
	intentCheck,
})

process.stdout.write(summary)
