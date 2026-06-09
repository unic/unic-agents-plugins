// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * temp-paths.mjs — print the canonical temp-file path for a unic-pr-review run.
 *
 * Usage: node temp-paths.mjs <findings|approved> <pr-key>
 *
 * Takes arguments positionally so the env-vs-argv class cannot recur.
 */

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

/**
 * @param {'findings' | 'approved'} kind
 * @param {string} key - 16-char hex PR key
 * @returns {string}
 */
export function tempFilePath(kind, key) {
	return join(tmpdir(), `unic-pr-review-${kind}-${key}.json`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [kind, key] = process.argv.slice(2)

	if (!kind || !key) {
		process.stderr.write('temp-paths: usage: temp-paths.mjs <findings|approved> <pr-key>\n')
		process.exit(1)
	}

	if (kind !== 'findings' && kind !== 'approved') {
		process.stderr.write(`temp-paths: unknown kind '${kind}'; expected 'findings' or 'approved'\n`)
		process.exit(1)
	}

	process.stdout.write(tempFilePath(/** @type {'findings' | 'approved'} */ (kind), key))
}
