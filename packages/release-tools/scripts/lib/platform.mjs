// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { chmodSync } from 'node:fs'

/**
 * True when running on Windows.
 * @type {boolean}
 */
export const isWindows = process.platform === 'win32'

/**
 * Cross-platform chmod. On Windows NTFS, chmodSync is a no-op; warn the user
 * so they know the file is not protected by filesystem permissions.
 *
 * @param {string} filePath
 * @param {number} mode
 * @returns {void}
 */
export function safeChmod(filePath, mode) {
	if (isWindows) {
		console.warn(
			`Warning: token file "${filePath}" is not protected by filesystem permissions on Windows — ensure only your user account has read access`
		)
		return
	}
	chmodSync(filePath, mode)
}

/**
 * Returns the correct pnpm binary name for the current OS.
 * On Windows, bare "pnpm" is not found without shell:true; use "pnpm.cmd".
 *
 * @returns {string}
 */
export function pnpmBin() {
	return isWindows ? 'pnpm.cmd' : 'pnpm'
}

/**
 * Returns [cmd, ...args] for spawning git without a shell.
 * In tests, set _GIT_BIN to the absolute path of a .cjs script to intercept
 * git calls cross-platform (spawned via `node`; receives git args at argv[2]+).
 *
 * @param {string[]} subArgs
 * @returns {[string, ...string[]]}
 */
export function gitCmd(subArgs) {
	const override = process.env._GIT_BIN
	if (override) return /** @type {[string, ...string[]]} */ (['node', override, ...subArgs])
	return /** @type {[string, ...string[]]} */ (['git', ...subArgs])
}
