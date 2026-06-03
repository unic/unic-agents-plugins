// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * cache-paths.mjs — paths for the per-key Approval Loop state directory.
 *
 * The state directory lives under `<cwd>/.unic-pr-review/<key>/` and is
 * never tracked by git: a sibling `.gitignore` containing `*` is written on
 * first use.
 *
 * Key derivation (ADR-0003):
 *   - ADO modes: sha16(prUrl)
 *   - Pre-PR mode: sha16(cwd + ' ' + branch)
 */

import { createHash } from 'node:crypto'
import { existsSync as realExistsSync, mkdirSync as realMkdirSync, writeFileSync as realWriteFile } from 'node:fs'
import { join } from 'node:path'

/**
 * @typedef {Object} CachePathDeps
 * @property {string} [cwd] - working directory override; defaults to process.cwd()
 * @property {(path: string) => boolean} [existsSync]
 * @property {(path: string, options: { recursive: boolean }) => void} [mkdirSync]
 * @property {(path: string, data: string, encoding: BufferEncoding) => void} [writeFile]
 */

/**
 * Compute a 16-character hex prefix of the SHA-256 digest of a string.
 *
 * Used to derive a per-PR or per-branch state directory key that is short
 * enough to be a safe directory component on all platforms.
 *
 * @param {string} input
 * @returns {string} 16-char lowercase hex string
 */
export function sha16(input) {
	return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16)
}

/**
 * Return the per-key state directory path and ensure:
 *   1. `<cwd>/.unic-pr-review/.gitignore` (containing `*`) exists so the
 *      entire directory tree is never tracked.
 *   2. The `<cwd>/.unic-pr-review/<key>/` directory exists.
 *
 * Writing the gitignore before any subdirectory is created guarantees that
 * the state file is never accidentally staged even if the user runs `git add .`
 * immediately after a review starts.
 *
 * @param {string} key - 16-char hex directory name (from sha16)
 * @param {CachePathDeps} [deps]
 * @returns {string} absolute path to `<cwd>/.unic-pr-review/<key>/`
 */
export function getApprovalStateDir(key, deps = {}) {
	const cwd = deps.cwd ?? process.cwd()
	const existsSync = deps.existsSync ?? realExistsSync
	const mkdirSync = deps.mkdirSync ?? realMkdirSync
	const writeFile = deps.writeFile ?? realWriteFile

	const root = join(cwd, '.unic-pr-review')
	const gitignorePath = join(root, '.gitignore')
	const stateDir = join(root, key)

	if (!existsSync(gitignorePath)) {
		mkdirSync(root, { recursive: true })
		writeFile(gitignorePath, '*\n', 'utf8')
	}

	mkdirSync(stateDir, { recursive: true })

	return stateDir
}
