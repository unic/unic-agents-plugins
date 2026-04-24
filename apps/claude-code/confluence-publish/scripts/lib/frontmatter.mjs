// SPDX-License-Identifier: LGPL-3.0-or-later

/**
 * Strips YAML frontmatter from the start of a Markdown string.
 *
 * The opening --- must be at byte 0. Frontmatter is capped at 50 lines to
 * prevent runaway matches on unclosed blocks. See spec 08 for full rationale.
 *
 * @param {string} content
 * @returns {string}
 */
export function stripFrontmatter(content) {
	return content.replace(/^---\r?\n(?:[^\n]*\r?\n){0,50}?---\s*\r?\n/, "");
}
