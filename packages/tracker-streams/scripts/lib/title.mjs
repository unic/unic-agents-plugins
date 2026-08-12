// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * A leading conventional-commit prefix: a lowercase type, an optional `(scope)`, an
 * optional breaking-change `!`, then a colon and whitespace. Only the first such segment
 * is stripped — anything after the first colon belongs to the description.
 */
const CONVENTIONAL_PREFIX = /^[a-z][a-z0-9-]*(\([^()\s]+\))?!?:[ \t]+/

/**
 * Shorten an issue title for a card by dropping its conventional-commit prefix.
 *
 * `'feat(repo): publish a streams page'` becomes `'publish a streams page'`. A title with
 * no prefix comes back unchanged, as does one whose prefix is all there is.
 *
 * @param {string} title
 * @returns {string}
 */
export function shortenTitle(title) {
	const trimmed = title.trim()
	const shortened = trimmed.replace(CONVENTIONAL_PREFIX, '').trim()
	return shortened.length > 0 ? shortened : trimmed
}
