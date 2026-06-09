// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FOOTER_MARKER, recognizeFooter } from '../scripts/lib/attribution-footer.mjs'
import { convertInline, escapeHtml, mdToStorage } from '../scripts/lib/md-to-storage.mjs'

describe('escapeHtml', () => {
	const cases = [
		{ input: 'plain text', expected: 'plain text' },
		{ input: '<input>', expected: '&lt;input&gt;' },
		{ input: 'a & b', expected: 'a &amp; b' },
		{ input: '"quoted"', expected: '&quot;quoted&quot;' },
		{ input: '<a href="url">link</a>', expected: '&lt;a href=&quot;url&quot;&gt;link&lt;/a&gt;' },
		{ input: 'a < b && c > d', expected: 'a &lt; b &amp;&amp; c &gt; d' },
	]
	for (const { input, expected } of cases) {
		it(`escapes ${JSON.stringify(input)}`, () => {
			assert.equal(escapeHtml(input), expected)
		})
	}
})

describe('convertInline — per-construct cases', () => {
	const cases = [
		{ name: 'bold **text**', input: '**bold**', expected: '<strong>bold</strong>' },
		{ name: 'bold __text__', input: '__bold__', expected: '<strong>bold</strong>' },
		{ name: 'italic *text*', input: '*italic*', expected: '<em>italic</em>' },
		{ name: 'italic _text_', input: '_italic_', expected: '<em>italic</em>' },
		{ name: 'inline code', input: '`code`', expected: '<code>code</code>' },
		{
			name: 'link [text](url)',
			input: '[click here](https://example.com)',
			expected: '<a href="https://example.com">click here</a>',
		},
		{
			name: 'mixed bold + code',
			input: '**bold** and `code`',
			expected: '<strong>bold</strong> and <code>code</code>',
		},
		{
			name: 'plain text passes through unchanged',
			input: 'hello world',
			expected: 'hello world',
		},
	]
	for (const { name, input, expected } of cases) {
		it(name, () => {
			assert.equal(convertInline(input), expected)
		})
	}
})

describe('convertInline — HTML-injection safety', () => {
	it('escapes <input> in plain text (never raw)', () => {
		const out = convertInline('<input>')
		assert.ok(!out.includes('<input>'), 'raw <input> must not appear in output')
		assert.ok(out.includes('&lt;input&gt;'))
	})

	it('escapes a & b in plain text (never raw)', () => {
		const out = convertInline('a & b')
		assert.ok(!out.includes(' & '), 'raw & must not appear in output')
		assert.ok(out.includes('&amp;'))
	})

	it('escapes HTML inside bold delimiters', () => {
		const out = convertInline('**<script>**')
		assert.ok(!out.includes('<script>'), 'raw <script> must not appear in bold output')
		assert.ok(out.includes('&lt;script&gt;'))
	})

	it('escapes HTML inside inline code', () => {
		const out = convertInline('`<div>`')
		assert.ok(!out.includes('<div>'), 'raw <div> must not appear in code output')
		assert.ok(out.includes('&lt;div&gt;'))
	})

	it('escapes URL in link href attribute', () => {
		const out = convertInline('[x]("onmouseover="alert(1))')
		assert.ok(!out.includes('"onmouseover='), 'unescaped attribute injection must not appear')
	})
})

describe('convertInline — unknown construct degrades', () => {
	it('unmatched * is HTML-escaped, not left as raw markup', () => {
		const out = convertInline('price is $5 * 2')
		// No italic tag should appear; * is a plain char here
		assert.ok(!out.includes('<em>'), 'no italic tag for unmatched *')
	})

	it('unmatched [ is HTML-escaped (not a link)', () => {
		const out = convertInline('see [section')
		assert.ok(!out.includes('<a'), 'no link tag for unmatched [')
	})
})

describe('mdToStorage — per-construct block cases', () => {
	it('converts a bold paragraph', () => {
		const out = mdToStorage('**important**')
		assert.ok(out.includes('<strong>important</strong>'), out)
		assert.ok(out.startsWith('<p>'), out)
	})

	it('converts italic in a paragraph', () => {
		const out = mdToStorage('*note*')
		assert.ok(out.includes('<em>note</em>'), out)
	})

	it('converts inline code in a paragraph', () => {
		const out = mdToStorage('use `npm install`')
		assert.ok(out.includes('<code>npm install</code>'), out)
	})

	it('converts a link in a paragraph', () => {
		const out = mdToStorage('[Confluence](https://confluence.example.com)')
		assert.ok(out.includes('<a href="https://confluence.example.com">Confluence</a>'), out)
	})

	it('converts a bullet list', () => {
		const out = mdToStorage('- alpha\n- beta\n- gamma')
		assert.ok(out.includes('<ul>'), out)
		assert.ok(out.includes('<li>alpha</li>'), out)
		assert.ok(out.includes('<li>beta</li>'), out)
		assert.ok(out.includes('<li>gamma</li>'), out)
		assert.ok(out.includes('</ul>'), out)
	})

	it('converts a * bullet list', () => {
		const out = mdToStorage('* one\n* two')
		assert.ok(out.includes('<ul>'), out)
		assert.ok(out.includes('<li>one</li>'), out)
	})

	it('converts an ordered list', () => {
		const out = mdToStorage('1. first\n2. second\n3. third')
		assert.ok(out.includes('<ol>'), out)
		assert.ok(out.includes('<li>first</li>'), out)
		assert.ok(out.includes('<li>second</li>'), out)
		assert.ok(out.includes('</ol>'), out)
	})

	it('converts a fenced code block with language', () => {
		const out = mdToStorage('```javascript\nconst x = 1\n```')
		assert.ok(out.includes('ac:name="code"'), out)
		assert.ok(out.includes('language'), out)
		assert.ok(out.includes('javascript'), out)
		assert.ok(out.includes('const x = 1'), out)
		assert.ok(out.includes('<![CDATA['), out)
		assert.ok(out.includes(']]>'), out)
	})

	it('converts a fenced code block without language', () => {
		const out = mdToStorage('```\nplain code\n```')
		assert.ok(out.includes('ac:name="code"'), out)
		assert.ok(out.includes('plain code'), out)
		// No language parameter when lang is absent
		assert.ok(!out.includes('ac:name="language"'), out)
	})

	it('escapes ]]> inside CDATA content', () => {
		const out = mdToStorage('```\na]]>b\n```')
		// Raw ]]> would break the CDATA section; must be escaped
		assert.ok(!out.match(/\]\]>[^<]/), 'raw ]]> followed by non-< must not appear')
	})

	it('converts multiple paragraphs separated by blank lines', () => {
		const out = mdToStorage('first paragraph\n\nsecond paragraph')
		assert.match(out, /<p>first paragraph<\/p>/)
		assert.match(out, /<p>second paragraph<\/p>/)
	})
})

describe('mdToStorage — HTML-injection safety', () => {
	it('never emits raw <input> in paragraph', () => {
		const out = mdToStorage('<input>')
		assert.ok(!out.includes('<input>'), out)
		assert.ok(out.includes('&lt;input&gt;'), out)
	})

	it('never emits raw & in paragraph', () => {
		const out = mdToStorage('a & b')
		assert.ok(!out.includes(' & '), out)
		assert.ok(out.includes('&amp;'), out)
	})
})

describe('mdToStorage — unknown construct degrades to escaped literal', () => {
	it('heading degrades to escaped text in <p> (not a heading tag)', () => {
		const out = mdToStorage('## Section Title')
		assert.ok(!out.includes('<h2>'), `must not emit <h2>: ${out}`)
		assert.ok(out.includes('## Section Title'), `must contain escaped heading text: ${out}`)
	})

	it('raw HTML degrades to escaped text', () => {
		const out = mdToStorage('<div>content</div>')
		assert.ok(!out.includes('<div>'), `must not emit raw <div>: ${out}`)
		assert.ok(out.includes('&lt;div&gt;'), `must escape <div>: ${out}`)
	})
})

describe('footer round-trip', () => {
	it('footer fragment stripped of HTML is recognized by recognizeFooter', () => {
		// Build the footer exactly as confluence-writer.mjs does (piecewise storage fragment)
		const dimension = 'gaps'
		const hat = 'black'
		const footerLine = `<p>${FOOTER_MARKER} | dimension: ${escapeHtml(dimension)} | hat: ${escapeHtml(hat)}</p>`

		// Simulate the read path: stripHtml as atlassian-fetch.mjs does (replace tags, collapse whitespace)
		const stripped = footerLine
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()

		const r = recognizeFooter(stripped)
		assert.equal(r.recognized, true)
		assert.equal(r.dimension, 'gaps')
		assert.equal(r.hat, 'black')
	})

	it('footer round-trip is stable across all dimension+hat combinations', () => {
		const dimensions = [
			'gaps',
			'ambiguity',
			'testability',
			'feasibility',
			'consistency',
			'nfr',
			'alternatives',
			'value',
			'ux',
		]
		const hats = ['black', 'white', 'red', 'yellow', 'green', 'blue']
		for (const dimension of dimensions) {
			for (const hat of hats) {
				const footerLine = `<p>${FOOTER_MARKER} | dimension: ${escapeHtml(dimension)} | hat: ${escapeHtml(hat)}</p>`
				const stripped = footerLine
					.replace(/<[^>]+>/g, ' ')
					.replace(/\s+/g, ' ')
					.trim()
				const r = recognizeFooter(stripped)
				assert.equal(r.recognized, true, `failed for dim=${dimension} hat=${hat}: ${stripped}`)
				assert.equal(r.dimension, dimension, `wrong dimension for dim=${dimension} hat=${hat}`)
				assert.equal(r.hat, hat, `wrong hat for dim=${dimension} hat=${hat}`)
			}
		}
	})
})
