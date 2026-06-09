// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * figma-gatherer.mjs - shape Figma Dev Mode MCP output for agent injection.
 *
 * Pure library: the exported functions do no I/O and have no external deps. A
 * thin CLI entry at the bottom (guarded by an import.meta check) reads a JSON
 * file written by the command orchestrator and prints the formatted context
 * string to stdout, so command integration stays shell-quoting-free.
 *
 * The Figma Dev Mode MCP output shape is not guaranteed, so every property
 * access is defensive: the input `data` is `unknown` and the extractors never
 * throw on null, non-objects, or unexpected shapes.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * @typedef {Object} FigmaUrlResult
 * @property {string} url - original Figma URL
 * @property {unknown} data - raw Figma Dev Mode MCP output for this URL
 */

/**
 * Read a string property from an unknown object, returning null when the value
 * is missing or not a non-empty string.
 * @param {unknown} obj
 * @param {string} key
 * @returns {string | null}
 */
function readString(obj, key) {
	if (typeof obj !== 'object' || obj === null) return null
	const value = /** @type {Record<string, unknown>} */ (obj)[key]
	return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Recursively pull annotation messages from a Figma node tree. Looks at
 * `annotations[].message` on the node itself, on a nested `node` or `document`
 * wrapper, and recurses into `children[]`. Returns deduplicated, non-empty
 * messages. Never throws; returns `[]` for null/undefined/non-object input.
 * @param {unknown} data
 * @returns {string[]}
 */
export function extractAnnotations(data) {
	/** @type {string[]} */
	const collected = []

	/** @param {unknown} node */
	function walk(node) {
		if (typeof node !== 'object' || node === null) return
		const obj = /** @type {Record<string, unknown>} */ (node)

		if (Array.isArray(obj.annotations)) {
			for (const annotation of obj.annotations) {
				const message = readString(annotation, 'message')
				if (message) collected.push(message)
			}
		}

		// Descend into common Figma MCP wrapper shapes.
		walk(obj.node)
		walk(obj.document)

		if (Array.isArray(obj.children)) {
			for (const child of obj.children) {
				walk(child)
			}
		}
	}

	walk(data)

	return [...new Set(collected)]
}

/**
 * Render a single Figma node into a readable multi-line summary. Defensive
 * against missing names, descriptions, and annotations. Falls back to
 * `data.node` and `data.document` wrapper shapes for name and description.
 * @param {string} url
 * @param {unknown} data
 * @returns {string}
 */
export function formatFigmaNodeSummary(url, data) {
	const obj = typeof data === 'object' && data !== null ? /** @type {Record<string, unknown>} */ (data) : null
	const name = readString(data, 'name') ?? readString(obj?.node, 'name') ?? readString(obj?.document, 'name')
	const description = readString(data, 'description') ?? readString(obj?.node, 'description')
	const annotations = extractAnnotations(data)

	const lines = [
		`Figma source: ${url}`,
		`Frame/Page: ${name ?? '(unnamed)'}`,
		`Description: ${description ?? '(none)'}`,
	]

	if (annotations.length === 0) {
		lines.push('Annotations: (none)')
	} else {
		lines.push('Annotations:')
		for (const annotation of annotations) {
			lines.push(`  - ${annotation}`)
		}
	}

	return lines.join('\n')
}

/**
 * Build the full Figma context string for agent injection from per-URL results.
 * @param {FigmaUrlResult[]} results
 * @returns {string}
 */
export function buildFigmaContext(results) {
	if (!Array.isArray(results) || results.length === 0) {
		return '(no Figma data gathered)'
	}
	return results.map((result) => formatFigmaNodeSummary(result.url, result.data)).join('\n\n---\n\n')
}

/**
 * Validate that parsed CLI input is an array of results. Throws a TypeError
 * with a descriptive message otherwise, so the CLI entry fails loud instead of
 * silently coercing a malformed-but-parseable MCP payload to an empty result.
 * @param {unknown} raw
 * @returns {FigmaUrlResult[]}
 */
export function asResultsArray(raw) {
	if (!Array.isArray(raw)) {
		throw new TypeError(`expected a JSON array, got ${raw === null ? 'null' : typeof raw}`)
	}
	return raw
}

// CLI entry: read a JSON array of FigmaUrlResult from --input, print the context.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const inputFlag = process.argv.indexOf('--input')
	if (inputFlag === -1 || !process.argv[inputFlag + 1]) {
		process.stderr.write('figma-gatherer: --input <path> required\n')
		process.exit(1)
	}
	let results
	try {
		results = asResultsArray(JSON.parse(readFileSync(process.argv[inputFlag + 1], 'utf8')))
	} catch (err) {
		process.stderr.write(
			`figma-gatherer: failed to read/parse input: ${err instanceof Error ? err.message : String(err)}\n`
		)
		process.exit(1)
	}
	process.stdout.write(`${buildFigmaContext(results)}\n`)
}
