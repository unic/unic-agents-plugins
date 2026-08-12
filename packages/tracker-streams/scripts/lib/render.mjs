// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import { STYLE_CSS } from './style.mjs'

/**
 * @typedef {{ number: number, state: string, crossesStream: boolean }} Blocker
 * @typedef {{
 *   number: number,
 *   title: string,
 *   priority: string | null,
 *   readiness: { state: string, className: string },
 *   issueState: string,
 *   blockers: Blocker[]
 * }} Card
 * @typedef {{
 *   streamNumber: number,
 *   streamTitle: string,
 *   streamState: string,
 *   members: Card[]
 * }} Lane
 * @typedef {{
 *   streams: number,
 *   members: number,
 *   edges: number,
 *   crossingEdges: number,
 *   outside: number,
 *   takeable: number
 * }} Counts
 */

/**
 * Escape a value for interpolation into HTML text or a double-quoted attribute.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/**
 * The repository's issue list. Every link on the page is built from this one helper, so
 * `repo` is escaped in exactly one place and cannot reach an `href` raw.
 *
 * @param {string} repo - `owner/name`
 * @returns {string}
 */
function repoIssuesUrl(repo) {
	return `https://github.com/${escapeHtml(repo)}/issues`
}

/**
 * @param {string} repo - `owner/name`
 * @param {number} number
 * @returns {string}
 */
function issueUrl(repo, number) {
	return `${repoIssuesUrl(repo)}/${number}`
}

/**
 * @param {string} repo
 * @param {Blocker} blocker
 * @returns {string}
 */
function renderBlocker(repo, blocker) {
	const classes = ['chip', blocker.state === 'open' ? 'open' : 'closed']
	if (blocker.crossesStream) classes.push('cross')
	const label = blocker.crossesStream ? 'crosses a stream boundary' : `${blocker.state} blocker`
	return `<a class="${classes.join(' ')}" href="${issueUrl(repo, blocker.number)}" title="${escapeHtml(label)}">#${
		blocker.number
	}${blocker.crossesStream ? ' ⇄' : ''}</a>`
}

/**
 * @param {string} repo
 * @param {Card} card
 * @returns {string}
 */
function renderCard(repo, card) {
	const classes = ['card', card.readiness.className]
	if (card.issueState !== 'open') classes.push('closed-issue')
	const priority = card.priority
		? `<span class="prio prio-${card.priority}">${card.priority}</span>`
		: '<span class="prio prio-none">—</span>'
	const blockers =
		card.blockers.length > 0
			? `<span class="blockers">${card.blockers.map((b) => renderBlocker(repo, b)).join('')}</span>`
			: ''
	return [
		`<li class="${classes.join(' ')}">`,
		`<a class="num" href="${issueUrl(repo, card.number)}">#${card.number}</a>`,
		priority,
		`<span class="title">${escapeHtml(card.title)}</span>`,
		`<span class="state ${card.readiness.className}">${escapeHtml(card.readiness.state)}</span>`,
		blockers,
		'</li>',
	].join('')
}

/**
 * @param {string} repo
 * @param {Card[]} cards
 * @returns {string}
 */
function renderCards(repo, cards) {
	if (cards.length === 0) return '<p class="empty">No issues in this lane.</p>'
	return `<ol class="cards">${cards.map((card) => renderCard(repo, card)).join('')}</ol>`
}

/**
 * @param {string} repo
 * @param {Lane} lane
 * @returns {string}
 */
function renderLane(repo, lane) {
	return [
		'<section class="lane">',
		'<div class="lane-head">',
		`<a class="num" href="${issueUrl(repo, lane.streamNumber)}">#${lane.streamNumber}</a>`,
		`<h2>${escapeHtml(lane.streamTitle)}</h2>`,
		`<span class="lane-count">${lane.members.length} member${lane.members.length === 1 ? '' : 's'}</span>`,
		'</div>',
		renderCards(repo, lane.members),
		'</section>',
	].join('')
}

/**
 * @param {Counts} counts
 * @returns {string}
 */
function renderCounts(counts) {
	const entries = [
		['streams', counts.streams],
		['members', counts.members],
		['dependency edges', counts.edges],
		['crossing a stream', counts.crossingEdges],
		['outside every stream', counts.outside],
		['takeable now', counts.takeable],
	]
	return `<ul class="counts">${entries.map(([label, value]) => `<li><b>${value}</b> ${label}</li>`).join('')}</ul>`
}

/**
 * Build the whole page as one self-contained HTML document.
 *
 * The stylesheet is inlined; there is no external stylesheet, no script and no remote
 * font, so the published artefact is a single file.
 *
 * @param {{ repo: string, lanes: Lane[], outside: Card[], counts: Counts, generatedAt: string }} input
 * @returns {string}
 */
export function renderPage({ repo, lanes, outside, counts, generatedAt }) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tracker streams — ${escapeHtml(repo)}</title>
<style>${STYLE_CSS}</style>
</head>
<body>
<header>
<h1>Tracker streams</h1>
<p class="meta"><a href="${repoIssuesUrl(repo)}">${escapeHtml(
		repo
	)}</a> · generated ${escapeHtml(generatedAt)} · every value read live from the tracker</p>
${renderCounts(counts)}
</header>
<main>
${lanes.map((lane) => renderLane(repo, lane)).join('\n')}
<section class="lane">
<div class="lane-head">
<h2>Outside every stream</h2>
<span class="lane-count">${outside.length} open issue${outside.length === 1 ? '' : 's'}</span>
</div>
${renderCards(repo, outside)}
</section>
</main>
<p class="legend">
<span><span class="chip open">#000</span> open blocker</span>
<span><span class="chip closed">#000</span> closed blocker</span>
<span><span class="chip open cross">#000 ⇄</span> crosses a stream boundary</span>
</p>
</body>
</html>
`
}
