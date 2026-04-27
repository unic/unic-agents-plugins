// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later

/**
 * Strips a YAML frontmatter block from the start of a Markdown string.
 * The opening `---` must be at byte 0; a CommonMark HR in the body is not affected.
 *
 * @param {string} content - Raw file content including optional frontmatter.
 * @returns {string} Content with the frontmatter block removed, or the original string if none.
 */
export function stripFrontmatter(content) {
	return content.replace(/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/, '')
}
