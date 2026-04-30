// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * CliError — thrown by any function in push-to-confluence.mjs when user-facing
 * error conditions are encountered. Caught once in main() which handles
 * console.error output and process.exit.
 *
 * Using a dedicated class (instead of process.exit) makes all error paths
 * testable: callers can assert.throws(fn, CliError) without mocking process.exit.
 */
export class CliError extends Error {
	/** @param {string} message @param {number} [exitCode=1] */
	constructor(message, exitCode = 1) {
		super(message)
		this.name = 'CliError'
		this.exitCode = exitCode
	}
}
