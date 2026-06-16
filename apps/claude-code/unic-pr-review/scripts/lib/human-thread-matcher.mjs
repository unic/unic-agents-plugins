// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * human-thread-matcher.mjs — post-fan-out matching of Findings against Human Threads.
 *
 * A Human Thread is matched to a Finding when both share the same filePath and the
 * thread's startLine is within LINE_PROXIMITY lines of the Finding's startLine.
 * Non-inline Human Threads (filePath is null) never match a Finding.
 *
 * Matched Findings are annotated in their body:
 *   - Open thread  → "Overlaps open Human Thread #N."
 *   - Resolved thread → "Thread #N marked fixed but issue still present — re-verify."
 *
 * Unresolved threads that no Finding matched (including all non-inline threads) are
 * returned as unmatchedUnresolved — the caller renders them as a Notice (ADR-0016).
 * Resolved threads that no Finding matched are silently dropped.
 *
 * Acts as a CLI entry point when invoked directly:
 *   FINDINGS_JSON='...' HUMAN_THREADS_JSON='...' node human-thread-matcher.mjs
 * Reads env vars, writes { annotatedFindings, unmatchedUnresolved } to stdout.
 */

/** Line proximity window for matching a thread to a Finding. */
const LINE_PROXIMITY = 10

/** ADO thread status values that indicate the thread is resolved. */
const RESOLVED_STATUSES = new Set(['fixed', 'wontFix', 'closed', 'byDesign'])

/**
 * @typedef {Object} HumanThread
 * @property {number} threadId
 * @property {string | null} filePath - null for non-inline (general comment) threads
 * @property {number | null} startLine - null for non-inline threads
 * @property {string} status - ADO thread status: 'active' | 'pending' | 'fixed' | 'wontFix' | 'closed' | 'byDesign'
 * @property {string} excerpt - first ~150 chars of the thread's first comment
 */

/**
 * @typedef {Object} AnnotatedFinding
 * @property {string} severity
 * @property {number} confidence
 * @property {string} filePath
 * @property {number} startLine
 * @property {string} title
 * @property {string} body
 * @property {string} [suggestion]
 * @property {string} [priorVerdict]
 */

/**
 * @typedef {Object} MatchResult
 * @property {AnnotatedFinding[]} annotatedFindings
 * @property {HumanThread[]} unmatchedUnresolved
 */

/**
 * Match Findings to Human Threads by filePath + line proximity, annotate matched
 * Findings, and collect unresolved unmatched threads for the Notice.
 *
 * @param {AnnotatedFinding[]} findings
 * @param {HumanThread[]} humanThreads
 * @returns {MatchResult}
 */
export function matchHumanThreadsToFindings(findings, humanThreads) {
	if (!Array.isArray(humanThreads) || humanThreads.length === 0) {
		return { annotatedFindings: findings.slice(), unmatchedUnresolved: [] }
	}

	/** @type {Set<number>} */
	const matchedThreadIds = new Set()

	const annotatedFindings = findings.map((finding) => {
		const match = humanThreads.find(
			(t) =>
				t.filePath !== null &&
				t.filePath === finding.filePath &&
				t.startLine !== null &&
				typeof finding.startLine === 'number' &&
				Math.abs(t.startLine - finding.startLine) <= LINE_PROXIMITY
		)

		if (!match) return finding

		matchedThreadIds.add(match.threadId)

		const isResolved = RESOLVED_STATUSES.has(match.status)
		const annotation = isResolved
			? `\n\n> Thread #${match.threadId} marked fixed but issue still present — re-verify.`
			: `\n\n> Overlaps open Human Thread #${match.threadId}.`

		return { ...finding, body: finding.body + annotation }
	})

	const unmatchedUnresolved = humanThreads.filter(
		(t) => !RESOLVED_STATUSES.has(t.status) && !matchedThreadIds.has(t.threadId)
	)

	return { annotatedFindings, unmatchedUnresolved }
}

// CLI entry point
const isMain =
	typeof process !== 'undefined' &&
	process.argv[1] !== undefined &&
	(process.argv[1].endsWith('human-thread-matcher.mjs') || process.argv[1].endsWith('human-thread-matcher'))

if (isMain) {
	const findingsRaw = process.env['FINDINGS_JSON'] ?? '[]'
	const threadsRaw = process.env['HUMAN_THREADS_JSON'] ?? '[]'

	let findings, humanThreads
	try {
		findings = JSON.parse(findingsRaw)
		humanThreads = JSON.parse(threadsRaw)
	} catch (err) {
		process.stderr.write(`human-thread-matcher: JSON parse error — ${/** @type {Error} */ (err).message}\n`)
		process.exit(1)
	}

	if (!Array.isArray(findings)) {
		process.stderr.write(`human-thread-matcher: FINDINGS_JSON must be a JSON array, got ${typeof findings}\n`)
		process.exit(1)
	}
	if (!Array.isArray(humanThreads)) {
		process.stderr.write(`human-thread-matcher: HUMAN_THREADS_JSON must be a JSON array, got ${typeof humanThreads}\n`)
		process.exit(1)
	}

	const result = matchHumanThreadsToFindings(findings, humanThreads)
	process.stdout.write(JSON.stringify(result))
}
