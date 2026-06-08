// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/** Visible prefix that makes a command-authored comment recognizable. */
export const FOOTER_MARKER = '-- unic-spec-review'

/**
 * Render the visible attribution footer line for a posted comment.
 * The format is stable: changing it weakens recognition of older command
 * comments by later runs (ADR-0002: treat wording changes as a migration).
 * @param {string} dimension
 * @param {string} hat
 * @returns {string}
 */
export function renderFooter(dimension, hat) {
	return `${FOOTER_MARKER} | dimension: ${dimension} | hat: ${hat}`
}

/**
 * Append the attribution footer to a comment body, separated by a blank line.
 * @param {string} commentBody
 * @param {string} dimension
 * @param {string} hat
 * @returns {string}
 */
export function withFooter(commentBody, dimension, hat) {
	return `${commentBody}\n\n${renderFooter(dimension, hat)}`
}

/**
 * @typedef {Object} FooterRecognition
 * @property {boolean} recognized
 * @property {string | undefined} dimension
 * @property {string | undefined} hat
 */

/**
 * Attempt to recognize a command-authored comment by its attribution footer.
 * Returns recognized=false for human or non-command comments.
 * @param {string} commentBody
 * @returns {FooterRecognition}
 */
export function recognizeFooter(commentBody) {
	// Hardcoded to match FOOTER_MARKER - if the marker changes, update here too (ADR-0002 migration)
	const match = commentBody.match(/-- unic-spec-review \| dimension: ([^|\n]+) \| hat: ([^\n]+)/)
	if (!match) return { recognized: false, dimension: undefined, hat: undefined }
	return { recognized: true, dimension: match[1].trim(), hat: match[2].trim() }
}
