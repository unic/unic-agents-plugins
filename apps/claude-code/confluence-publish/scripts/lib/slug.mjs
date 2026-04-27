// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later

const MAX_LEN = 60

/**
 * Slugify a Confluence page title into a safe alias key for confluence-pages.json.
 * Returns "" when the title produces no slug characters; caller substitutes a fallback.
 *
 * @param {unknown} title
 * @returns {string}
 */
export function slugify(title) {
	const raw = String(title ?? '')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	if (!raw) return ''
	return raw.slice(0, MAX_LEN).replace(/-+$/, '')
}
