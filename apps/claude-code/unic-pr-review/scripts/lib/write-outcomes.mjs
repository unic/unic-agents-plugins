// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * write-outcomes.mjs — Write Retry bookkeeping for the Approval Loop state dir.
 *
 * Implements the local-dedup half of ADR-0015 (Write Retry completes a
 * partially-written Iteration). Three pure-ish helpers, all path-based so they
 * are unit-testable without touching the module system:
 *
 *   - `checkWriteRetry`  — classify a re-run as none / retry / stale by comparing
 *                          the saved `headSha` to the current HEAD.
 *   - `recordOutcomes`   — after a write, persist each Finding's post outcome and
 *                          a `summaryPosted` flag into `state.json` (atomic write),
 *                          run BEFORE the success-gated cleanup (ADR-0014).
 *   - `filterUnposted`   — drop Findings that already posted so a retry re-posts
 *                          only the ones that failed (first attempt → no-op).
 *
 * Owned by the `review-pr` orchestrator (Steps 1.2a, 1.11, 1.12a). The CLI
 * dispatcher at the bottom exposes the three helpers as a real script file so
 * the command-prompt one-liners pass data via env (`VAR=… node script.mjs sub`)
 * and never embed an absolute path in an inline ESM `import` specifier — the
 * Windows-breaking pattern that issue #227 / clear-state-dir.mjs already retired.
 */

import {
	existsSync as realExistsSync,
	readFileSync as realReadFile,
	renameSync as realRenameSync,
	writeFileSync as realWriteFile,
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { approvalStateDirPath } from './cache-paths.mjs'

/**
 * @typedef {Object} InlineResult
 * @property {string} findingId
 * @property {boolean} success
 * @property {number|null} threadId
 * @property {string|null} [error]
 */

/**
 * @typedef {Object} SummaryResult
 * @property {boolean} success
 * @property {number|null} threadId
 * @property {string|null} [error]
 */

/**
 * @typedef {Record<string, { success: boolean, threadId: number|null }>} PostedMap
 */

/**
 * @typedef {Object} WriteRetryState
 * @property {string} headSha
 * @property {number} [iteration]
 * @property {PostedMap} [postedMap]
 * @property {boolean} [summaryPosted]
 */

/**
 * @typedef {Object} WriteOutcomeDeps
 * @property {(path: string) => boolean} [existsSync]
 * @property {(path: string, encoding: BufferEncoding) => string} [readFile]
 * @property {(path: string, data: string, encoding: BufferEncoding) => void} [writeFile]
 * @property {(from: string, to: string) => void} [renameSync]
 */

/**
 * Classify a `--post` re-run by inspecting the surviving Approval Loop state.
 *
 * The state directory is deleted only on a fully-successful write (ADR-0014), so
 * its presence means the prior `--post` did not complete. The short-circuit fires
 * only when the saved `headSha` still matches the current HEAD; otherwise the
 * partial attempt is stale and the caller discards it (staleness guard, ADR-0015).
 *
 * @param {string} statePath - absolute path to `<stateDir>/state.json`
 * @param {string} currentHead - current `git rev-parse HEAD`
 * @param {WriteOutcomeDeps} [deps]
 * @returns {{ mode: 'none' } | { mode: 'retry', state: WriteRetryState } | { mode: 'stale' }}
 */
export function checkWriteRetry(statePath, currentHead, deps = {}) {
	const existsSync = deps.existsSync ?? realExistsSync
	const readFile = deps.readFile ?? realReadFile

	if (!existsSync(statePath)) return { mode: 'none' }

	let state
	try {
		state = JSON.parse(readFile(statePath, 'utf8'))
	} catch {
		return { mode: 'none' }
	}

	if (!state || typeof state !== 'object' || typeof state.headSha !== 'string') {
		return { mode: 'none' }
	}

	if (state.headSha === currentHead) return { mode: 'retry', state }
	return { mode: 'stale' }
}

/**
 * Persist post outcomes into `state.json`, run after the Writer returns and
 * BEFORE the success-gated cleanup (ADR-0014). Merges into any existing state so
 * `headSha`, `iteration`, and `findings` are preserved. `summaryPosted` is sticky:
 * once true it never resets, so a later partial retry cannot un-set it.
 *
 * A missing or corrupt state file starts from `{}` — the outcomes are still
 * written. Written atomically (tmp + rename) like `approval-loop.mjs`.
 *
 * @param {string} statePath - absolute path to `<stateDir>/state.json`
 * @param {InlineResult[]} inlineResults
 * @param {SummaryResult|null} summaryResult
 * @param {WriteOutcomeDeps} [deps]
 * @returns {void}
 */
export function recordOutcomes(statePath, inlineResults, summaryResult, deps = {}) {
	const readFile = deps.readFile ?? realReadFile
	const writeFile = deps.writeFile ?? realWriteFile
	const renameSync = deps.renameSync ?? realRenameSync

	let state = /** @type {Record<string, unknown>} */ ({})
	try {
		const parsed = JSON.parse(readFile(statePath, 'utf8'))
		if (parsed && typeof parsed === 'object') state = parsed
	} catch {
		// start fresh if the state file is missing or corrupt
	}

	const postedMap = /** @type {PostedMap} */ (state.postedMap ?? {})
	for (const r of inlineResults) {
		postedMap[r.findingId] = { success: r.success, threadId: r.threadId }
	}

	const updated = {
		...state,
		postedMap,
		summaryPosted: Boolean(state.summaryPosted) || summaryResult?.success === true,
	}

	const tmp = `${statePath}.tmp`
	writeFile(tmp, JSON.stringify(updated, null, 2), 'utf8')
	renameSync(tmp, statePath)
}

/**
 * Drop Findings that already posted successfully so a retry re-posts only the
 * failures. An empty or absent posted-map returns the input unchanged — the
 * first-attempt no-op that keeps normal behaviour intact.
 *
 * @template {{ id?: string }} F
 * @param {F[]} approvedFindings
 * @param {PostedMap} [postedMap]
 * @returns {F[]}
 */
export function filterUnposted(approvedFindings, postedMap) {
	if (!postedMap || Object.keys(postedMap).length === 0) return approvedFindings
	return approvedFindings.filter((f) => postedMap[/** @type {string} */ (f.id)]?.success !== true)
}

/* ------------------------------------------------------------------ CLI ---- */

/**
 * Read a required env var or exit non-zero with a usage message.
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
	const value = process.env[name]
	if (typeof value !== 'string' || value === '') {
		process.stderr.write(`write-outcomes: missing required env var ${name}\n`)
		process.exit(1)
	}
	return value
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [subcommand, key] = process.argv.slice(2)

	if (!subcommand || !key) {
		process.stderr.write('write-outcomes: usage: write-outcomes.mjs <check|record|filter> <pr-key>\n')
		process.exit(1)
	}

	const statePath = join(approvalStateDirPath(key), 'state.json')

	if (subcommand === 'check') {
		// env HEAD_SHA → stdout: JSON { mode, state? }
		const result = checkWriteRetry(statePath, requireEnv('HEAD_SHA'))
		process.stdout.write(JSON.stringify(result))
	} else if (subcommand === 'record') {
		// env WRITER_RESULT (JSON) → persist outcomes into state.json
		let writer
		try {
			writer = JSON.parse(requireEnv('WRITER_RESULT'))
		} catch (err) {
			process.stderr.write(`write-outcomes: WRITER_RESULT is not valid JSON: ${String(err)}\n`)
			process.exit(1)
		}
		recordOutcomes(statePath, writer.inlineResults ?? [], writer.summaryResult ?? null)
	} else if (subcommand === 'filter') {
		// env APPROVED_FILE (path) → rewrite it in place to the un-posted Findings
		const approvedFile = requireEnv('APPROVED_FILE')
		/** @type {PostedMap} */
		let postedMap = {}
		try {
			const state = JSON.parse(realReadFile(statePath, 'utf8'))
			if (state && typeof state === 'object' && state.postedMap) postedMap = state.postedMap
		} catch {
			// no readable state → empty posted-map → filter is a no-op
		}
		const approved = JSON.parse(realReadFile(approvedFile, 'utf8'))
		const unposted = filterUnposted(approved, postedMap)
		realWriteFile(approvedFile, JSON.stringify(unposted), 'utf8')
	} else {
		process.stderr.write(`write-outcomes: unknown subcommand '${subcommand}'\n`)
		process.exit(1)
	}
}
