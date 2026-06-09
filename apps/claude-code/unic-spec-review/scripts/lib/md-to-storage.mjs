// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * Vendored, dependency-free Markdown-to-Confluence-storage converter.
 *
 * Supported constructs:
 *   HTML-escaping (mandatory for valid XHTML), bold (**text** / __text__),
 *   italic (*text* / _text_), inline code (`code`), links ([text](url)),
 *   bullet lists (- or * prefix), ordered lists (N. prefix),
 *   fenced code blocks (```lang … ```) → ac:structured-macro.
 *
 * Any unrecognised construct (headings, tables, raw HTML) degrades to
 * HTML-escaped literal text — never malformed XHTML.
 */

/**
 * Escape HTML special characters for safe embedding in XHTML.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Find the closing position of a single-character inline delimiter
 * starting from `from` (inclusive). Returns the index of the closing
 * delimiter on success. Returns -1 if not found on the same line or
 * if the closing delimiter would form a double-delimiter (** / __).
 * Known limitation: `*italic***bold**` abutted (no space between italic close
 * and bold open) mismatch — the closing `*` is skipped because `text[j+1]` is
 * also `*`. AI-generated content virtually never produces this pattern.
 * @param {string} text
 * @param {string} delim - single character: '*' or '_'
 * @param {number} from - start of search (inclusive); typically i+1 to skip the opener
 * @returns {number} index of closing delimiter, or -1
 */
function findInlineEnd(text, delim, from) {
	for (let j = from; j < text.length; j++) {
		if (text[j] === '\n') return -1
		if (text[j] === delim && text[j + 1] !== delim) return j
	}
	return -1
}

/**
 * Convert inline Markdown to XHTML inline nodes.
 * Any character that is not part of a recognised construct is HTML-escaped.
 * @param {string} text
 * @returns {string}
 */
export function convertInline(text) {
	let out = ''
	let i = 0
	while (i < text.length) {
		const ch = text[i]

		// Inline code: `code`
		if (ch === '`') {
			const end = text.indexOf('`', i + 1)
			if (end > i) {
				out += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`
				i = end + 1
				continue
			}
		}

		// Bold: **text**
		if (ch === '*' && text[i + 1] === '*') {
			const end = text.indexOf('**', i + 2)
			if (end > i + 1) {
				out += `<strong>${escapeHtml(text.slice(i + 2, end))}</strong>`
				i = end + 2
				continue
			}
		}

		// Bold: __text__
		if (ch === '_' && text[i + 1] === '_') {
			const end = text.indexOf('__', i + 2)
			if (end > i + 1) {
				out += `<strong>${escapeHtml(text.slice(i + 2, end))}</strong>`
				i = end + 2
				continue
			}
		}

		// Italic: *text* (single star only — ** already handled above)
		if (ch === '*' && text[i + 1] !== '*') {
			const end = findInlineEnd(text, '*', i + 1)
			if (end > i) {
				out += `<em>${escapeHtml(text.slice(i + 1, end))}</em>`
				i = end + 1
				continue
			}
		}

		// Italic: _text_ (single underscore only — __ already handled above)
		if (ch === '_' && text[i + 1] !== '_') {
			const end = findInlineEnd(text, '_', i + 1)
			if (end > i) {
				out += `<em>${escapeHtml(text.slice(i + 1, end))}</em>`
				i = end + 1
				continue
			}
		}

		// Link: [text](url) — balanced-paren scan handles URLs like Wikipedia's Foo_(bar)
		if (ch === '[') {
			const closeBracket = text.indexOf(']', i + 1)
			if (closeBracket > i && text[closeBracket + 1] === '(') {
				let closeParen = -1
				let depth = 0
				for (let k = closeBracket + 2; k < text.length; k++) {
					if (text[k] === '(') depth++
					else if (text[k] === ')') {
						if (depth === 0) {
							closeParen = k
							break
						}
						depth--
					}
				}
				if (closeParen > closeBracket + 1) {
					const linkText = text.slice(i + 1, closeBracket)
					const url = text.slice(closeBracket + 2, closeParen)
					out += `<a href="${escapeHtml(url)}">${escapeHtml(linkText)}</a>`
					i = closeParen + 1
					continue
				}
			}
		}

		// Unrecognised character — HTML-escape and pass through
		if (ch === '&') out += '&amp;'
		else if (ch === '<') out += '&lt;'
		else if (ch === '>') out += '&gt;'
		else if (ch === '"') out += '&quot;'
		else out += ch
		i++
	}
	return out
}

/**
 * Convert a Markdown string to Confluence storage format (XHTML).
 * @param {string} markdown
 * @returns {string}
 */
export function mdToStorage(markdown) {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n')
	const chunks = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()

		// Fenced code block: ```lang
		if (trimmed.startsWith('```')) {
			const lang = trimmed.slice(3).trim()
			const codeLines = []
			i++
			while (i < lines.length && !lines[i].trim().startsWith('```')) {
				codeLines.push(lines[i])
				i++
			}
			i++ // skip closing ```
			// Escape ]]> so it cannot break the CDATA section
			const codeContent = codeLines.join('\n').replace(/]]>/g, ']]]]><![CDATA[>')
			const langParam = lang ? `<ac:parameter ac:name="language">${escapeHtml(lang)}</ac:parameter>` : ''
			chunks.push(
				`<ac:structured-macro ac:name="code">${langParam}<ac:plain-text-body><![CDATA[${codeContent}]]></ac:plain-text-body></ac:structured-macro>`
			)
			continue
		}

		// Unordered list block
		if (/^[-*] /.test(trimmed)) {
			const items = []
			while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
				items.push(`<li>${convertInline(lines[i].trim().slice(2))}</li>`)
				i++
			}
			chunks.push(`<ul>${items.join('')}</ul>`)
			continue
		}

		// Ordered list block
		if (/^\d+\. /.test(trimmed)) {
			const items = []
			while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
				items.push(`<li>${convertInline(lines[i].trim().replace(/^\d+\. /, ''))}</li>`)
				i++
			}
			chunks.push(`<ol>${items.join('')}</ol>`)
			continue
		}

		// Blank line — paragraph separator, skip
		if (trimmed === '') {
			i++
			continue
		}

		// Paragraph: gather non-empty, non-special lines
		const paraLines = []
		while (
			i < lines.length &&
			lines[i].trim() !== '' &&
			!lines[i].trim().startsWith('```') &&
			!/^[-*] /.test(lines[i].trim()) &&
			!/^\d+\. /.test(lines[i].trim())
		) {
			paraLines.push(lines[i])
			i++
		}
		if (paraLines.length > 0) {
			chunks.push(`<p>${convertInline(paraLines.join(' '))}</p>`)
		}
	}

	return chunks.join('\n')
}
