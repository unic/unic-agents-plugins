// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * clear-state-dir.mjs — delete the Approval Loop state directory for a PR key.
 *
 * Usage: node clear-state-dir.mjs <pr-key>
 *
 * Owned by the `review-pr` orchestrator (Step 1.13, ADR-0014): the Approval Loop
 * never deletes its own state dir, so this runs only after the ADO Writer reports
 * `success: true`. A failed write leaves the dir in place so `--post` can resume.
 *
 * Takes the key positionally so the env-vs-argv class (issue #227) cannot recur,
 * and is invoked as a real script file (`node clear-state-dir.mjs <key>`) so it
 * works on Windows — unlike an inline `--eval` that embeds an absolute path in an
 * ESM import specifier. Computes the path via `approvalStateDirPath` (no mkdir
 * side effect) so it never re-creates the directory it is about to remove.
 */

import { rmSync as realRmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { approvalStateDirPath } from './cache-paths.mjs'

/**
 * @typedef {{ rmSync?: (path: string, options: { recursive: boolean, force: boolean }) => void, cwd?: string }} ClearStateDirDeps
 */

/**
 * Delete `<cwd>/.unic-pr-review/<key>/` recursively.
 *
 * `force: true` makes an already-absent directory a no-op (success); EPERM/EBUSY
 * and any other error surface unchanged rather than being masked.
 *
 * @param {string} key - hex PR key (e.g. from `sha16(prUrl)`)
 * @param {ClearStateDirDeps} [deps]
 * @returns {string} the deleted directory path
 */
export function clearStateDir(key, deps = {}) {
	if (!key) throw new Error('clear-state-dir: missing key')
	const rmSync = deps.rmSync ?? realRmSync
	const dir = approvalStateDirPath(key, deps.cwd)
	rmSync(dir, { recursive: true, force: true })
	return dir
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [key] = process.argv.slice(2)

	if (!key) {
		process.stderr.write('clear-state-dir: usage: clear-state-dir.mjs <pr-key>\n')
		process.exit(1)
	}

	clearStateDir(key)
}
