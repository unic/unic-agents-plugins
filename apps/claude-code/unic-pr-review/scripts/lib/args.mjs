// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Shared CLI argument parser for setup scripts.
 *
 * Accepts both `--key=value` and `--key value` forms. Bare positional args
 * are ignored. A `--flag` with no following value (last arg, or followed by
 * another `--flag`) throws — the previous silent-drop behaviour produced
 * misleading "X is required" errors when the user actually did pass the flag.
 *
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
			continue
		}
		if (args[i].startsWith('--')) {
			const next = args[i + 1]
			if (next === undefined || next.startsWith('--')) {
				throw new Error(`${args[i]} requires a value`)
			}
			result[args[i].slice(2)] = next
			i++
		}
	}
	return result
}
