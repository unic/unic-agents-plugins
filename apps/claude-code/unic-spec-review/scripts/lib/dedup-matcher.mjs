// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * dedup-matcher.mjs - compare a candidate Finding against existing page comments.
 *
 * Pure library: the exported functions do no I/O and have no external deps. A
 * thin CLI entry at the bottom (guarded by an import.meta check) reads two JSON
 * files and prints results, so command integration stays shell-quoting-free.
 *
 * De-duplication reads the shared page's comments directly (own prior runs,
 * other reviewers' runs, and human comments) and compares by Jaccard word-token
 * similarity. There is no hidden marker and no local state file, so the check is
 * multi-user and multi-run safe by construction.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** @import { Finding } from './finding.mjs' */
/** @import { ConfluenceComment } from '../atlassian-fetch.mjs' */

/** Minimum Jaccard similarity to flag as a borderline near-duplicate (requires a human tiebreak). */
export const FLAG_THRESHOLD = 0.25

/** Minimum Jaccard similarity to classify as a likely duplicate (strongly discourage; override required). */
export const SKIP_THRESHOLD = 0.6

/**
 * @typedef {'post' | 'skip' | 'flag'} DedupDecision
 */

/**
 * @typedef {Object} NearDuplicate
 * @property {ConfluenceComment} comment
 * @property {number} similarity - Jaccard score in the range 0..1
 */

/**
 * @typedef {Object} DedupResult
 * @property {DedupDecision} decision
 * @property {NearDuplicate[]} nearDuplicates - sorted by similarity descending; only entries >= FLAG_THRESHOLD
 */

/**
 * Normalise text to a word-token set for Jaccard comparison.
 * Lowercases, replaces non-alphanumeric runs with spaces, splits on whitespace,
 * and drops single-character tokens (low signal, mostly noise).
 * @param {string} text
 * @returns {Set<string>}
 */
export function tokenize(text) {
	if (typeof text !== 'string' || text.length === 0) return new Set()
	const tokens = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.split(/\s+/)
		.filter((token) => token.length > 1)
	return new Set(tokens)
}

/**
 * Jaccard similarity between two token sets: |A∩B| / |A∪B|.
 * Returns 0 when the union is empty (both sets empty).
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number}
 */
export function jaccard(a, b) {
	if (a.size === 0 && b.size === 0) return 0
	let intersection = 0
	for (const token of a) {
		if (b.has(token)) intersection += 1
	}
	const union = a.size + b.size - intersection
	return intersection / union
}

/**
 * Compare a candidate Finding against existing page comments by content similarity.
 * No hidden marker, no local state - reads all supplied comments (own prior runs,
 * other users' runs, and human comments).
 *
 * Decision: `skip` when any near-duplicate is at or above SKIP_THRESHOLD; else
 * `flag` when at least one near-duplicate is at or above FLAG_THRESHOLD; else `post`.
 * @param {Finding} finding
 * @param {ConfluenceComment[]} existingComments
 * @returns {DedupResult}
 */
export function matchDedup(finding, existingComments) {
	const candidateText = `${finding.title ?? ''} ${finding.body ?? ''}`.trim()
	const candidateTokens = tokenize(candidateText)
	const comments = Array.isArray(existingComments) ? existingComments : []

	/** @type {NearDuplicate[]} */
	const nearDuplicates = []
	for (const comment of comments) {
		const similarity = jaccard(candidateTokens, tokenize(comment.body))
		if (similarity >= FLAG_THRESHOLD) {
			nearDuplicates.push({ comment, similarity })
		}
	}
	nearDuplicates.sort((a, b) => b.similarity - a.similarity)

	/** @type {DedupDecision} */
	let decision = 'post'
	if (nearDuplicates.some((entry) => entry.similarity >= SKIP_THRESHOLD)) {
		decision = 'skip'
	} else if (nearDuplicates.length > 0) {
		decision = 'flag'
	}

	return { decision, nearDuplicates }
}

/**
 * CLI entry: read findings and comments from JSON files, print a run-level
 * envelope `{ truncated, results }` to stdout where `results` is a DedupResult[]
 * (indexed by findings position). Exits 1 on missing args or parse error.
 *
 * Usage: node dedup-matcher.mjs --findings-file <path> --comments-file <path>
 *
 * The findings file is a JSON array of Finding objects. The comments file is the
 * `{ comments: ConfluenceComment[], truncated: boolean }` object emitted by
 * `collectComments` (the CLI reads `.comments` and `.truncated`), or a bare
 * `ConfluenceComment[]` array; either shape is accepted. `truncated` is read from
 * the object shape (a bare array reports `truncated: false`).
 */
function main() {
	const argv = process.argv.slice(2)
	const findingsFileIdx = argv.indexOf('--findings-file')
	const commentsFileIdx = argv.indexOf('--comments-file')
	const findingsFile = findingsFileIdx >= 0 ? argv[findingsFileIdx + 1] : undefined
	const commentsFile = commentsFileIdx >= 0 ? argv[commentsFileIdx + 1] : undefined

	if (!findingsFile || !commentsFile) {
		process.stderr.write(
			`${JSON.stringify({ error: 'Usage: dedup-matcher.mjs --findings-file <path> --comments-file <path>' })}\n`
		)
		process.exit(1)
	}

	let findings
	try {
		findings = JSON.parse(readFileSync(findingsFile, 'utf8'))
	} catch (err) {
		process.stderr.write(
			`${JSON.stringify({ error: `Failed to read findings file: ${err instanceof Error ? err.message : String(err)}` })}\n`
		)
		process.exit(1)
	}

	let commentsRaw
	try {
		commentsRaw = JSON.parse(readFileSync(commentsFile, 'utf8'))
	} catch (err) {
		process.stderr.write(
			`${JSON.stringify({ error: `Failed to read comments file: ${err instanceof Error ? err.message : String(err)}` })}\n`
		)
		process.exit(1)
	}

	// Strict `=== true`: a missing/non-boolean `truncated` reports `false` here. The
	// envelope flag is advisory; Step 10a of review-spec.md is the authoritative source
	// for COMPARISON_INCOMPLETE (computed from the fetch result + read errors), so the
	// CLI never has to fail toward the gate on an ambiguous shape.
	const truncated = !Array.isArray(commentsRaw) && commentsRaw?.truncated === true
	const comments = Array.isArray(commentsRaw) ? commentsRaw : (commentsRaw?.comments ?? [])
	const findingsList = Array.isArray(findings) ? findings : []
	const results = findingsList.map((finding) => matchDedup(finding, comments))
	process.stdout.write(`${JSON.stringify({ truncated, results })}\n`)
	process.exit(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main()
}
