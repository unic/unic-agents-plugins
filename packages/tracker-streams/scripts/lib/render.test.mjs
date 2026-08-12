#!/usr/bin/env node
// @ts-check
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { escapeHtml, renderPage } from './render.mjs'

/**
 * @param {Partial<import('./render.mjs').Card> & { number: number }} overrides
 * @returns {import('./render.mjs').Card}
 */
const card = (overrides) => ({
	title: 'a title',
	priority: 'p1',
	readiness: { state: 'ready-for-agent', className: 'state-ready-for-agent' },
	issueState: 'open',
	blockers: [],
	...overrides,
})

/** @type {import('./render.mjs').Counts} */
const COUNTS = { streams: 2, members: 3, edges: 2, crossingEdges: 1, outside: 1, takeable: 1 }

/** @returns {string} */
function samplePage() {
	return renderPage({
		repo: 'unic/unic-agents-plugins',
		generatedAt: '2026-08-12T00:00:00Z',
		counts: COUNTS,
		lanes: [
			{
				streamNumber: 313,
				streamTitle: 'stream: Matt Pocock skills migration',
				streamState: 'open',
				members: [
					card({
						number: 281,
						title: 'rewire the command Boxes',
						blockers: [
							{ number: 280, state: 'closed', crossesStream: false },
							{ number: 290, state: 'open', crossesStream: true },
						],
					}),
					card({ number: 282, priority: null, readiness: { state: 'unlabelled', className: 'state-unlabelled' } }),
				],
			},
			{
				streamNumber: 316,
				streamTitle: 'stream: unic-pr-review fixes',
				streamState: 'open',
				members: [card({ number: 290, issueState: 'closed' })],
			},
		],
		outside: [card({ number: 37, title: 'an <unsorted> issue' })],
	})
}

describe('escapeHtml', () => {
	it('escapes every HTML-significant character', () => {
		assert.equal(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
	})

	it('leaves ordinary text alone', () => {
		assert.equal(escapeHtml('publish a streams page'), 'publish a streams page')
	})
})

describe('renderPage — self-contained output (AC 3)', () => {
	const html = samplePage()

	it('opens with a doctype and closes the document', () => {
		assert.match(html, /^<!doctype html>/)
		assert.match(html, /<\/html>\s*$/)
	})

	it('inlines the stylesheet in a style element', () => {
		assert.match(html, /<style>[\s\S]*\.lane \{/)
	})

	it('references no external stylesheet', () => {
		assert.doesNotMatch(html, /<link\b/i)
	})

	it('references no script at all', () => {
		assert.doesNotMatch(html, /<script\b/i)
	})

	it('imports no remote font', () => {
		assert.doesNotMatch(html, /@import/i)
		assert.doesNotMatch(html, /@font-face/i)
		assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|cdn\./i)
	})
})

describe('renderPage — lanes and membership (AC 4)', () => {
	const html = samplePage()

	it('renders one section per lane plus the outside section', () => {
		assert.equal(html.match(/<section class="lane">/g)?.length, 3)
	})

	it('names each stream', () => {
		assert.match(html, /stream: Matt Pocock skills migration/)
		assert.match(html, /stream: unic-pr-review fixes/)
	})

	it('reports each lane member count', () => {
		assert.match(html, /2 members/)
		assert.match(html, /1 member</)
	})

	it('renders every member card', () => {
		for (const number of [281, 282, 290]) {
			assert.match(html, new RegExp(`>#${number}<`))
		}
	})

	it('renders a section for issues outside every stream', () => {
		assert.match(html, /Outside every stream/)
		assert.match(html, />#37</)
	})
})

describe('renderPage — card contents (AC 5)', () => {
	const html = samplePage()

	it('shows number, priority, title and triage state', () => {
		assert.match(html, /<a class="num" href="https:\/\/github\.com\/unic\/unic-agents-plugins\/issues\/281">#281<\/a>/)
		assert.match(html, /<span class="prio prio-p1">p1<\/span>/)
		assert.match(html, /<span class="title">rewire the command Boxes<\/span>/)
		assert.match(html, /<span class="state state-ready-for-agent">ready-for-agent<\/span>/)
	})

	it('renders a placeholder for an issue with no priority', () => {
		assert.match(html, /<span class="prio prio-none">/)
	})

	it('renders the unlabelled state rather than dropping it', () => {
		assert.match(html, /<span class="state state-unlabelled">unlabelled<\/span>/)
	})

	it('distinguishes an open blocker from a closed one', () => {
		assert.match(html, /class="chip closed cross"|class="chip closed"/)
		assert.match(html, /class="chip open cross"|class="chip open"/)
	})

	it('links each blocker chip to its issue', () => {
		assert.match(html, /href="https:\/\/github\.com\/unic\/unic-agents-plugins\/issues\/280"/)
	})

	it('escapes a title containing angle brackets', () => {
		assert.match(html, /an &lt;unsorted&gt; issue/)
		assert.doesNotMatch(html, /an <unsorted> issue/)
	})
})

describe('renderPage — crossing edges (AC 6)', () => {
	const html = samplePage()

	it('marks a blocker whose endpoints sit in different streams', () => {
		assert.match(html, /class="chip open cross"/)
		assert.match(html, /crosses a stream boundary/)
	})

	it('leaves a same-stream blocker unmarked', () => {
		assert.match(html, /class="chip closed" href="[^"]*\/280"/)
	})
})

describe('renderPage — escaping (the page is published publicly)', () => {
	/** A slug that closes the `href` attribute and opens an element, if it is not escaped. */
	const HOSTILE_REPO = 'unic/repo"><script>alert(1)</script>'

	/** @returns {string} */
	function hostilePage() {
		return renderPage({
			repo: HOSTILE_REPO,
			generatedAt: '2026-08-12T00:00:00Z',
			counts: COUNTS,
			lanes: [
				{
					streamNumber: 313,
					streamTitle: 'stream: <img src=x onerror="alert(1)"> & friends',
					streamState: 'open',
					members: [card({ number: 281, blockers: [{ number: 280, state: 'open', crossesStream: false }] })],
				},
			],
			outside: [],
		})
	}

	it('escapes the repository slug in every issue link', () => {
		const html = hostilePage()
		assert.match(html, /href="https:\/\/github\.com\/unic\/repo&quot;&gt;&lt;script&gt;/)
		assert.doesNotMatch(html, /href="https:\/\/github\.com\/unic\/repo">/)
	})

	it('escapes the repository slug in the blocker chip link too', () => {
		const html = hostilePage()
		const chip = html.match(/<a class="chip[^>]*>/)?.[0] ?? ''
		assert.match(chip, /&quot;&gt;&lt;script&gt;/)
		assert.doesNotMatch(chip, /"><script>/)
	})

	it('opens no element anywhere from a hostile repository slug or stream title', () => {
		const html = hostilePage()
		assert.doesNotMatch(html, /<script\b/i)
		assert.doesNotMatch(html, /<img\b/i)
	})

	it('escapes a stream title containing markup and an ampersand', () => {
		const html = hostilePage()
		assert.match(html, /<h2>stream: &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; friends<\/h2>/)
	})
})

describe('renderPage — counts (AC 9)', () => {
	it('prints every count it was given', () => {
		const html = samplePage()
		assert.match(html, /<b>2<\/b> streams/)
		assert.match(html, /<b>3<\/b> members/)
		assert.match(html, /<b>2<\/b> dependency edges/)
		assert.match(html, /<b>1<\/b> crossing a stream/)
		assert.match(html, /<b>1<\/b> outside every stream/)
		assert.match(html, /<b>1<\/b> takeable now/)
	})

	it('renders a degenerate tracker with no streams at all', () => {
		const html = renderPage({
			repo: 'unic/unic-agents-plugins',
			generatedAt: '2026-08-12T00:00:00Z',
			counts: { streams: 0, members: 0, edges: 0, crossingEdges: 0, outside: 0, takeable: 0 },
			lanes: [],
			outside: [],
		})
		assert.match(html, /Outside every stream/)
		assert.match(html, /No issues in this lane\./)
	})
})
