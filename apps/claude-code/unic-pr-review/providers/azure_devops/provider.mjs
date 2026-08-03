// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import { pathToFileURL } from 'node:url'

/**
 * providers/azure_devops/provider.mjs — Azure DevOps Source Platform Provider
 * (ADR-0010). Library + CLI entry.
 *
 * Exports the Provider contract: `name`, `label`, `prUrlPattern`, `parsePrUrl`,
 * `agents`, and `discoverWorkItems`. The default export bundles them for the
 * dynamic import in `providers/index.mjs`.
 */

/** Matches dev.azure.com and legacy visualstudio.com PR URLs. */
export const prUrlPattern =
	/^https:\/\/(?:dev\.azure\.com\/([^/]+)|([^.]+)\.visualstudio\.com)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i

export const name = 'azure_devops'
export const label = 'Azure DevOps'

/**
 * Parse an ADO PR URL into its addressable parts.
 * @param {string} url
 * @returns {{ orgUrl: string, project: string, repo: string, prId: number }}
 * @throws {Error} when `url` is not an ADO PR URL
 */
export function parsePrUrl(url) {
	const m = prUrlPattern.exec(url)
	if (!m) throw new Error(`Not an ADO PR URL: ${url}`)
	const [, devOrg, vsOrg, project, repo, prIdStr] = m
	const orgUrl = devOrg ? `https://dev.azure.com/${devOrg}` : `https://${vsOrg}.visualstudio.com`
	return { orgUrl, project, repo, prId: Number(prIdStr) }
}

/** Agents registered by this Provider (unic-pr-review:* namespace). */
export const agents = {
	fetcher: 'unic-pr-review:ado-fetcher',
	writer: 'unic-pr-review:ado-writer',
}

/**
 * Normalise the Work Item refs array hoisted by the ADO Fetcher to `FETCHER_OUTPUT.workItemRefs`
 * (top-level, never nested in `prMetadata`). Never regex-scrapes the PR description —
 * this is the ADR-0001 amendment contract.
 *
 * Throws on `undefined` or any non-array input so a data-loss handoff (absent key on
 * `FETCHER_OUTPUT`) is never silently collapsed into the legitimate "no Work Items linked"
 * case (an explicit `[]` from the Fetcher). The caller must distinguish the two states and
 * handle absent-key via the loud Notice + continue path (review-pr.md Step 1.5, ADR-0004).
 *
 * @param {Array<{ id: string | number, url: string }>} workItemRefs
 * @returns {Array<{ id: string, type: string, url: string, raw: object }>}
 * @throws {Error} when `workItemRefs` is not an array (guards against a malformed or
 *   absent payload silently yielding zero Work Items)
 */
export function discoverWorkItems(workItemRefs) {
	if (!Array.isArray(workItemRefs)) {
		throw new Error(`Expected workItemRefs array, got ${describeType(workItemRefs)}`)
	}
	return workItemRefs.map((ref, i) => {
		if (ref.id == null) throw new Error(`workItemRefs[${i}].id is missing or null`)
		if (typeof ref.url !== 'string')
			throw new Error(`workItemRefs[${i}].url must be a string, got ${describeType(ref.url)}`)
		return {
			id: String(ref.id),
			type: 'ado-work-item',
			url: ref.url,
			raw: ref,
		}
	})
}

/** Default export — the full Provider bundle for `providers/index.mjs`. */
export default { name, label, prUrlPattern, parsePrUrl, agents, discoverWorkItems }

/** @param {unknown} value */
const describeType = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value)

/** @param {unknown} err */
const errMsg = (err) => (err instanceof Error ? err.message : String(err))

// CLI entry — `node provider.mjs parse-url <url>` | `node provider.mjs discover-work-items` (stdin JSON).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [, , subcommand] = process.argv
	if (subcommand === 'parse-url') {
		const url = process.argv[3]
		if (!url) {
			process.stderr.write('Usage: node provider.mjs parse-url <url>\n')
			process.exit(1)
		}
		try {
			process.stdout.write(`${JSON.stringify(parsePrUrl(url))}\n`)
		} catch (err) {
			process.stderr.write(`${errMsg(err)}\n`)
			process.exit(1)
		}
	} else if (subcommand === 'discover-work-items') {
		if (process.stdin.isTTY) {
			process.stderr.write('discover-work-items expects a workItemRefs JSON array on stdin (pipe it in)\n')
			process.exit(1)
		}
		/** @type {Buffer[]} */
		const chunks = []
		process.stdin.on('data', (c) => chunks.push(c))
		process.stdin.on('end', () => {
			try {
				const refs = JSON.parse(Buffer.concat(chunks).toString('utf8'))
				process.stdout.write(`${JSON.stringify(discoverWorkItems(refs))}\n`)
			} catch (err) {
				process.stderr.write(`${errMsg(err)}\n`)
				process.exit(1)
			}
		})
		process.stdin.on('error', (err) => {
			process.stderr.write(`${errMsg(err)}\n`)
			process.exit(1)
		})
	} else {
		process.stderr.write(
			'Usage:\n  node provider.mjs parse-url <url>\n  node provider.mjs discover-work-items   (reads workItemRefs JSON array from stdin)\n'
		)
		process.exit(1)
	}
}
