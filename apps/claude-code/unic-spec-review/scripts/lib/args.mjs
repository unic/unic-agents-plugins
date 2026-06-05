// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * args.mjs — CLI argument parsers for unic-spec-review.
 *
 * - `parseReviewSpecArgs`: accepts a raw string or argv array; extracts http(s)
 *   URLs and the `--post` flag (for the /review-spec command).
 * - `parseArgs`: key=value / key value flag parser for setup scripts;
 *   throws on a flag with no value rather than silently dropping it.
 */

/**
 * @typedef {Object} ReviewSpecArgs
 * @property {string[]} urls
 * @property {boolean} post
 */

/**
 * @param {string | string[]} input - raw argument string or argv array
 * @returns {ReviewSpecArgs}
 */
export function parseReviewSpecArgs(input) {
	const tokens = Array.isArray(input) ? input : input.trim().split(/\s+/).filter(Boolean)
	const post = tokens.includes('--post')
	/** @type {string[]} */
	const urls = []
	for (const t of tokens) {
		if (t.startsWith('--')) continue
		try {
			const parsed = new URL(t)
			if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
				urls.push(t)
			}
		} catch {
			// not a URL; ignore
		}
	}
	return { urls, post }
}

/**
 * Shared CLI argument parser for setup scripts.
 *
 * Accepts both `--key=value` and `--key value` forms. Bare positional args
 * are ignored. A `--flag` with no following value (last arg, or followed by
 * another `--flag`) throws — the previous silent-drop behaviour produced
 * misleading "X is required" errors when the user actually did pass the flag.
 *
 * Boolean flags (presence-only, no value) must be declared in `options.booleanFlags`.
 * They are recorded as `''` (empty string) when present so callers can use `'key' in result`.
 *
 * @param {string[]} args
 * @param {{ booleanFlags?: Set<string> }} [options]
 * @returns {Record<string, string>}
 */
export function parseArgs(args, options = {}) {
	const booleans = options.booleanFlags ?? new Set()
	/** @type {Record<string, string>} */
	const result = {}
	for (let i = 0; i < args.length; i++) {
		const m = args[i].match(/^--([^=]+)=(.*)$/)
		if (m) {
			result[m[1]] = m[2]
			continue
		}
		if (args[i].startsWith('--')) {
			const key = args[i].slice(2)
			if (booleans.has(key)) {
				result[key] = ''
				continue
			}
			const next = args[i + 1]
			if (next === undefined || next.startsWith('--')) {
				throw new Error(`${args[i]} requires a value`)
			}
			result[key] = next
			i++
		}
	}
	return result
}
