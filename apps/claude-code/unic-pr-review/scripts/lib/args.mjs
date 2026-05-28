// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Shared CLI argument parser for setup scripts.
 * Handles both `--key=value` and `--key value` forms.
 */

/**
 * @param {string[]} args
 * @returns {Record<string, string>}
 */
export function parseArgs(args) {
	/** @type {Record<string, string>} */
	const result = {}
	for (let i = 0; i < args.length; i++) {
		const m = args[i].match(/^--([^=]+)=(.*)$/)
		if (m) {
			result[m[1]] = m[2]
		} else if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
			result[args[i].slice(2)] = args[++i]
		}
	}
	return result
}
