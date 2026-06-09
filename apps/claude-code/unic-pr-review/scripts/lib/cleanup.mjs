// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * cleanup.mjs — delete a temp file, tolerating only ENOENT.
 *
 * Usage: node cleanup.mjs <path>
 *
 * Takes path positionally so the env-vs-argv class cannot recur.
 * Throws a clear error if path is missing/empty.
 * Catches only ENOENT (already-gone = fine); rethrows everything else (EPERM, EBUSY, …).
 */

import { unlinkSync as realUnlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * @typedef {{ unlinkSync?: (path: string) => void }} CleanupDeps
 */

/**
 * @param {string} filePath
 * @param {CleanupDeps} [deps]
 * @returns {void}
 */
export function cleanupFile(filePath, deps = {}) {
	if (!filePath) throw new Error('cleanup: missing path arg')
	const unlink = deps.unlinkSync ?? realUnlinkSync
	try {
		unlink(filePath)
	} catch (e) {
		if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'ENOENT') throw e
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [filePath] = process.argv.slice(2)

	if (!filePath) {
		process.stderr.write('cleanup: usage: cleanup.mjs <path>\n')
		process.exit(1)
	}

	cleanupFile(filePath)
}
