// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * traversal-planner.mjs - plan which Confluence pages a spec review should cover.
 *
 * Pure library: no I/O, no external deps, no CLI entry. Given seed page ids plus
 * already-fetched page metadata (child pages and in-body /wiki/ links), it
 * produces an ordered expansion plan and a budget-gate decision. The caller (the
 * /review-spec command) fetches the seed metadata, runs this planner, and - when
 * needsConfirmation is set - shows the discovered page set to the reviewer before
 * any bulk fetch. The planner itself never fetches anything.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { classifyUrl } from './link-classifier.mjs'

/**
 * @typedef {Object} ChildPageRef
 * @property {string} id
 * @property {string} title
 * @property {string} url
 */

/**
 * @typedef {Object} PageMeta
 * @property {string} id - the seed page id
 * @property {string} url - the seed page url
 * @property {string} title - the seed page title
 * @property {string[]} linkedUrls - in-body /wiki/ hrefs found on the seed page
 * @property {ChildPageRef[]} childPages - first-level child pages of the seed
 */

/**
 * @typedef {'seed' | 'child' | 'linked'} TraversalSource
 */

/**
 * @typedef {Object} TraversalPage
 * @property {string} pageId
 * @property {string} url
 * @property {string} title
 * @property {TraversalSource} source
 */

/**
 * @typedef {Object} TraversalPlan
 * @property {TraversalPage[]} pages - ordered: seeds, then children, then linked; unique by pageId
 * @property {boolean} needsConfirmation - true when the fetch expands beyond the seeds or exceeds the budget
 * @property {number} total - pages.length
 */

/**
 * Candidate count above which a fetch always requires reviewer confirmation,
 * even if the page set did not expand beyond the seeds. Exported so tests can
 * reference it without hardcoding the value.
 * @type {number}
 */
export const BUDGET_THRESHOLD = 5

/**
 * Build an ordered expansion plan plus a budget-gate decision from seed ids and
 * injected page metadata. Pure - no fetching, no I/O.
 *
 * Seeds are emitted first (source 'seed'), then each seed's child pages
 * (source 'child'), then each seed's in-body Confluence links (source 'linked').
 * Every page is unique by pageId: a child or linked page that repeats an
 * already-seen page id (including a seed's own id) is dropped.
 *
 * needsConfirmation is true when the plan expanded beyond the seeds
 * (pages.length > seeds.length) OR the total page count exceeds BUDGET_THRESHOLD.
 *
 * @param {string[]} seeds - seed page ids
 * @param {Map<string, PageMeta>} pageMetaMap - metadata per seed id; a seed missing here is treated as seed-only
 * @returns {TraversalPlan}
 */
export function planTraversal(seeds, pageMetaMap) {
	/** @type {TraversalPage[]} */
	const pages = []
	const seen = new Set()

	// Seeds first. Preserve order; dedupe repeated seed ids.
	for (const seedId of seeds) {
		if (seen.has(seedId)) continue
		seen.add(seedId)
		const meta = pageMetaMap.get(seedId)
		pages.push({
			pageId: seedId,
			url: meta?.url ?? '',
			title: meta?.title ?? '',
			source: 'seed',
		})
	}
	const seedCount = seen.size

	// Children of each seed, in seed order.
	for (const seedId of seeds) {
		const meta = pageMetaMap.get(seedId)
		if (!meta) continue
		for (const child of meta.childPages ?? []) {
			if (!child?.id || seen.has(child.id)) continue
			seen.add(child.id)
			pages.push({
				pageId: child.id,
				url: child.url ?? '',
				title: child.title ?? '',
				source: 'child',
			})
		}
	}

	// In-body Confluence links of each seed, in seed order. Non-Confluence links
	// (Figma, live, unknown) are filtered out.
	for (const seedId of seeds) {
		const meta = pageMetaMap.get(seedId)
		if (!meta) continue
		for (const href of meta.linkedUrls ?? []) {
			const classified = classifyUrl(href)
			if (classified.kind !== 'confluence') continue
			if (seen.has(classified.pageId)) continue
			seen.add(classified.pageId)
			pages.push({
				pageId: classified.pageId,
				url: classified.url,
				title: '',
				source: 'linked',
			})
		}
	}

	const total = pages.length
	const needsConfirmation = total > seedCount || total > BUDGET_THRESHOLD
	return { pages, needsConfirmation, total }
}

// CLI entry: read a plan-input JSON file ({ seeds: string[], pageMeta: PageMeta[] })
// and write the resulting TraversalPlan as JSON to stdout. Keeps the
// /review-spec command free of inline ESM and shell-quoting concerns.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const fileIdx = process.argv.indexOf('--plan-file')
	const filePath = fileIdx >= 0 ? process.argv[fileIdx + 1] : undefined
	if (!filePath) {
		process.stderr.write('traversal-planner: --plan-file <json> argument required\n')
		process.exit(1)
	}
	try {
		const input = JSON.parse(readFileSync(filePath, 'utf8'))
		const seeds = Array.isArray(input?.seeds) ? input.seeds : []
		const pageMeta = Array.isArray(input?.pageMeta) ? input.pageMeta : []
		const map = new Map(pageMeta.map((/** @type {PageMeta} */ m) => [m.id, m]))
		process.stdout.write(`${JSON.stringify(planTraversal(seeds, map))}\n`)
	} catch (err) {
		process.stderr.write(`traversal-planner: ${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	}
}
