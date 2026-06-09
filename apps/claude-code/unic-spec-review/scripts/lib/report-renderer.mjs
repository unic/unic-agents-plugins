// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * report-renderer.mjs - render and write a timestamped spec-review report.
 *
 * Pure library: renderReport() accepts injectable fs deps for unit testing.
 * The CLI entry reads the report JSON from a file-path argument (argv[2]),
 * falling back to the REPORT_JSON env var, and writes the rendered report
 * under REPORT_OUTPUT_DIR.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { groupByHat, HAT_LABELS, HAT_ORDER } from './hat-mapper.mjs'

/**
 * @typedef {Object} Finding
 * @property {string} title
 * @property {string} [description] - legacy gaps-agent field; use body instead
 * @property {string} [body]        - preferred body field; falls back to description
 * @property {'critical' | 'important' | 'minor'} [severity]
 * @property {number} [confidence]
 * @property {string | null} [anchor]
 * @property {string} [hat]         - hat tag (absent in gaps-agent output)
 * @property {string} [dimension]   - dimension tag (absent in gaps-agent output)
 */

/**
 * @typedef {Object} ReportInput
 * @property {string} pageTitle
 * @property {string} pageUrl
 * @property {string} timestamp - ISO 8601, e.g. new Date().toISOString()
 * @property {Finding[]} findings
 */

/**
 * @typedef {Object} RendererDeps
 * @property {(dir: string, opts?: import('node:fs').MakeDirectoryOptions) => void} [mkdirSync]
 * @property {(path: string, data: string) => void} [writeFileSync]
 */

/**
 * @typedef {Object} ReportResult
 * @property {string} path - path of the written report file
 * @property {string} markdown - rendered markdown content
 */

/**
 * Collapse an ISO timestamp to a filesystem-safe slug.
 * @param {string} ts
 * @returns {string}
 */
function tsToSlug(ts) {
	return ts.slice(0, 19).replace(/[T:]/g, '-')
}

/**
 * @param {Finding} f
 * @returns {string}
 */
function renderFinding(f) {
	const badge = f.severity ? ` \`${f.severity}\`` : ''
	const conf = typeof f.confidence === 'number' ? ` (${f.confidence}%)` : ''
	const anchor = f.anchor ? `\n\n> Anchor: \`${f.anchor}\`` : ''
	const bodyText = f.body ?? f.description ?? ''
	return `### ${f.title}${badge}${conf}\n\n${bodyText}${anchor}`
}

/**
 * Render one hat section with a heading and its findings.
 * @param {string} label
 * @param {Finding[]} sectionFindings
 * @returns {string}
 */
function renderHatSection(label, sectionFindings) {
	return `## ${label}\n\n${sectionFindings.map(renderFinding).join('\n\n')}`
}

/**
 * Render findings into a timestamped markdown report and write it to disk.
 * @param {ReportInput} input
 * @param {string} outputDir
 * @param {RendererDeps} [deps]
 * @returns {ReportResult}
 */
export function renderReport(input, outputDir, deps = {}) {
	const mkdir = deps.mkdirSync ?? mkdirSync
	const write = deps.writeFileSync ?? writeFileSync

	mkdir(outputDir, { recursive: true })

	const slug = tsToSlug(input.timestamp)
	const filename = `spec-review-${slug}.md`
	const path = join(outputDir, filename)

	// Detect hat-tagged findings for grouped hat rendering.
	const hasHatTags = input.findings.length > 0 && input.findings.some((f) => f.hat)

	let sections
	if (hasHatTags) {
		const grouped = groupByHat(/** @type {any} */ (input.findings))
		sections = HAT_ORDER.filter((hat) => grouped.has(hat))
			.map((hat) => renderHatSection(HAT_LABELS[hat] ?? hat, grouped.get(hat) ?? []))
			.join('\n\n')
	} else {
		// Backward-compat flat path: gaps-agent output carries no hat tags.
		const body =
			input.findings.length > 0 ? input.findings.map(renderFinding).join('\n\n') : '_No gaps or completeness findings._'
		sections = `## Gaps / Completeness\n\n${body}`
	}

	const markdown = [
		`# Spec Review: ${input.pageTitle}`,
		'',
		`**Source:** ${input.pageUrl}`,
		`**Date:** ${input.timestamp}`,
		'',
		'---',
		'',
		sections,
		'',
	].join('\n')

	write(path, markdown)
	return { path, markdown }
}

// CLI entry
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	// Accept JSON from a file path (argv[2]) to avoid shell-quoting issues with
	// apostrophes in page titles; falls back to REPORT_JSON env var.
	const jsonFilePath = process.argv[2]
	let raw
	if (jsonFilePath) {
		try {
			raw = readFileSync(jsonFilePath, 'utf8')
		} catch (err) {
			process.stderr.write(
				`report-renderer: could not read JSON file ${jsonFilePath}: ${err instanceof Error ? err.message : String(err)}\n`
			)
			process.exit(1)
		}
	} else {
		raw = process.env.REPORT_JSON
	}
	if (!raw) {
		process.stderr.write('report-renderer: REPORT_JSON environment variable is required\n')
		process.exit(1)
	}
	let input
	try {
		input = JSON.parse(raw)
	} catch (err) {
		process.stderr.write(
			`report-renderer: REPORT_JSON is not valid JSON: ${err instanceof Error ? err.message : String(err)}\n`
		)
		process.exit(1)
	}
	if (typeof input !== 'object' || input === null) {
		process.stderr.write('report-renderer: REPORT_JSON must be an object\n')
		process.exit(1)
	}
	if (!Array.isArray(input.findings)) {
		process.stderr.write('report-renderer: REPORT_JSON missing required field: findings\n')
		process.exit(1)
	}
	for (const field of ['timestamp', 'pageTitle', 'pageUrl']) {
		if (typeof input[field] !== 'string') {
			process.stderr.write(`report-renderer: REPORT_JSON missing required field: ${field}\n`)
			process.exit(1)
		}
	}
	const outputDir = process.env.REPORT_OUTPUT_DIR ?? '.spec-review'
	let result
	try {
		result = renderReport(input, outputDir)
	} catch (err) {
		process.stderr.write(
			`report-renderer: could not write report to ${outputDir}: ${err instanceof Error ? err.message : String(err)}\n`
		)
		process.exit(1)
	}
	process.stdout.write(`${result.path}\n`)
}
