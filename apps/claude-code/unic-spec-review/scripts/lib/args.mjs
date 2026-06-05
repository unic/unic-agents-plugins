// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * args.mjs — parse /review-spec command arguments.
 *
 * Accepts a raw argument string or a pre-split argv array.
 * Tokens that parse as valid URLs go into `urls`; `--post` sets `post: true`;
 * other flags and unrecognised tokens are silently ignored.
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
