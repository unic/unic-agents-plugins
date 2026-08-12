// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * The page's whole stylesheet, inlined into a `<style>` element by `renderPage`.
 *
 * Everything here must be self-contained: no `@import`, no remote font, no CDN. The
 * published page is one file and stays readable with no network beyond the document
 * itself. Font stacks name system faces only.
 */
export const STYLE_CSS = `
:root {
	color-scheme: dark;
	--bg: #0d1117;
	--panel: #161b22;
	--panel-2: #1c2128;
	--border: #30363d;
	--text: #e6edf3;
	--muted: #8b949e;
	--open: #f0883e;
	--closed: #3fb950;
	--cross: #d2a8ff;
}

* {
	box-sizing: border-box;
}

body {
	margin: 0;
	padding: 2rem 1.5rem 4rem;
	background: var(--bg);
	color: var(--text);
	font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	font-size: 15px;
	line-height: 1.5;
}

a {
	color: inherit;
	text-decoration: none;
}

a:hover {
	text-decoration: underline;
}

header {
	max-width: 76rem;
	margin: 0 auto 2rem;
}

h1 {
	margin: 0 0 0.35rem;
	font-size: 1.5rem;
	letter-spacing: -0.01em;
}

.meta {
	margin: 0;
	color: var(--muted);
	font-size: 0.85rem;
}

.counts {
	margin: 0.75rem 0 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
}

.counts li {
	padding: 0.15rem 0.5rem;
	border: 1px solid var(--border);
	border-radius: 999px;
	background: var(--panel);
	font-size: 0.78rem;
	color: var(--muted);
}

.counts b {
	color: var(--text);
	font-variant-numeric: tabular-nums;
}

main {
	max-width: 76rem;
	margin: 0 auto;
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
}

.lane {
	border: 1px solid var(--border);
	border-radius: 8px;
	background: var(--panel);
	overflow: hidden;
}

.lane-head {
	display: flex;
	align-items: baseline;
	gap: 0.6rem;
	padding: 0.7rem 0.9rem;
	background: var(--panel-2);
	border-bottom: 1px solid var(--border);
}

.lane-head h2 {
	margin: 0;
	font-size: 1rem;
}

.lane-head .num {
	color: var(--muted);
	font-size: 0.8rem;
	font-variant-numeric: tabular-nums;
}

.lane-count {
	margin-left: auto;
	color: var(--muted);
	font-size: 0.78rem;
}

.cards {
	margin: 0;
	padding: 0;
	list-style: none;
}

.card {
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: 0.5rem;
	padding: 0.45rem 0.9rem 0.45rem 0.7rem;
	border-top: 1px solid var(--border);
	border-left: 3px solid var(--border);
}

.cards .card:first-child {
	border-top: none;
}

.card .num {
	color: var(--muted);
	font-variant-numeric: tabular-nums;
	font-size: 0.85rem;
	min-width: 3.4rem;
}

.card .title {
	flex: 1 1 20rem;
}

.card.closed-issue .title {
	color: var(--muted);
	text-decoration: line-through;
}

.prio {
	padding: 0.05rem 0.4rem;
	border-radius: 4px;
	border: 1px solid var(--border);
	font-size: 0.72rem;
	font-weight: 600;
	color: var(--muted);
}

.prio-p0 {
	border-color: #f85149;
	color: #ff7b72;
}

.prio-p1 {
	border-color: #db6d28;
	color: #f0883e;
}

.prio-p2 {
	border-color: #9e6a03;
	color: #d29922;
}

.prio-p3 {
	border-color: #3d444d;
	color: var(--muted);
}

.state {
	padding: 0.05rem 0.45rem;
	border-radius: 999px;
	border: 1px solid var(--border);
	font-size: 0.72rem;
	white-space: nowrap;
}

.state-needs-triage {
	border-color: #8b949e;
	color: #c9d1d9;
}

.state-needs-info {
	border-color: #bf8700;
	color: #d29922;
}

.state-needs-specs {
	border-color: #9e6a03;
	color: #e3b341;
}

.state-ready-for-agent {
	border-color: #238636;
	color: #56d364;
}

.state-ready-for-human {
	border-color: #1f6feb;
	color: #79c0ff;
}

.state-resolved {
	border-color: #8957e5;
	color: #d2a8ff;
}

.state-closed {
	border-color: #6e7681;
	color: var(--muted);
}

.state-rejected {
	border-color: #f85149;
	color: #ff7b72;
}

.state-unlabelled {
	border-color: #30363d;
	color: #6e7681;
	font-style: italic;
}

.card.state-ready-for-agent {
	border-left-color: #238636;
}

.card.state-ready-for-human {
	border-left-color: #1f6feb;
}

.card.state-needs-specs {
	border-left-color: #9e6a03;
}

.card.state-needs-info {
	border-left-color: #bf8700;
}

.card.state-needs-triage {
	border-left-color: #6e7681;
}

.card.state-resolved {
	border-left-color: #8957e5;
}

.card.state-rejected {
	border-left-color: #f85149;
}

.blockers {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem;
}

.chip {
	padding: 0.05rem 0.4rem;
	border-radius: 4px;
	border: 1px dashed var(--closed);
	color: var(--closed);
	font-size: 0.72rem;
	font-variant-numeric: tabular-nums;
	opacity: 0.75;
}

.chip.open {
	border-style: solid;
	border-color: var(--open);
	color: var(--open);
	font-weight: 600;
	opacity: 1;
}

.chip.cross {
	box-shadow: inset 0 0 0 1px var(--cross);
	background: rgba(210, 168, 255, 0.12);
}

.legend {
	max-width: 76rem;
	margin: 1.5rem auto 0;
	display: flex;
	flex-wrap: wrap;
	gap: 0.9rem;
	color: var(--muted);
	font-size: 0.78rem;
}

.empty {
	padding: 0.6rem 0.9rem;
	color: var(--muted);
	font-size: 0.85rem;
	font-style: italic;
}
`
