// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * live-gatherer.mjs - shape Playwright MCP observations for agent injection.
 *
 * Pure library: the exported functions do no I/O and have no external deps. A
 * thin CLI entry at the bottom (guarded by an import.meta check) reads a JSON
 * file written by the command orchestrator and prints the formatted context
 * string to stdout, so command integration stays shell-quoting-free.
 *
 * Playwright observations carry full-page text, so `content` is capped to keep
 * agent prompts bounded. `title` and `content` may be null or missing; both are
 * guarded and the formatter never throws.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Maximum number of content characters retained per page (keeps prompts bounded). */
export const CONTENT_LIMIT = 2000

/**
 * @typedef {Object} LivePageObservation
 * @property {string} url - the live URL that was inspected
 * @property {string | null} [title] - page title reported by the browser
 * @property {string | null} [content] - visible text content of the page
 */

/**
 * Render a single live page observation into a readable multi-line summary.
 * Content longer than CONTENT_LIMIT is truncated with a `[truncated]` marker.
 * @param {string} url
 * @param {{ title?: string | null, content?: string | null }} obs
 * @returns {string}
 */
export function formatLivePageSummary(url, obs) {
	const title = typeof obs?.title === 'string' && obs.title.length > 0 ? obs.title : null
	const rawContent = typeof obs?.content === 'string' && obs.content.length > 0 ? obs.content : null

	let contentBlock
	if (rawContent === null) {
		contentBlock = '(no content captured)'
	} else if (rawContent.length > CONTENT_LIMIT) {
		contentBlock = `${rawContent.slice(0, CONTENT_LIMIT)} [truncated]`
	} else {
		contentBlock = rawContent
	}

	return [`Live page: ${url}`, `Title: ${title ?? '(untitled)'}`, 'Content:', contentBlock].join('\n')
}

/**
 * Build the full live context string for agent injection from observations.
 * @param {LivePageObservation[]} observations
 * @returns {string}
 */
export function buildLiveContext(observations) {
	if (!Array.isArray(observations) || observations.length === 0) {
		return '(no live observations gathered)'
	}
	return observations.map((obs) => formatLivePageSummary(obs.url, obs)).join('\n\n---\n\n')
}

// CLI entry: read a JSON array of LivePageObservation from --input, print the context.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const inputFlag = process.argv.indexOf('--input')
	if (inputFlag === -1 || !process.argv[inputFlag + 1]) {
		process.stderr.write('live-gatherer: --input <path> required\n')
		process.exit(1)
	}
	const raw = JSON.parse(readFileSync(process.argv[inputFlag + 1], 'utf8'))
	const observations = Array.isArray(raw) ? raw : []
	process.stdout.write(`${buildLiveContext(observations)}\n`)
}
