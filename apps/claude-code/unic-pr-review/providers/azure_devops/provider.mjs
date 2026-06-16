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
 * Read the Work Item refs that the ADO Fetcher populated on `prMetadata` from the
 * PR's linked work-item endpoint (`pullrequestworkitems`, Step 1.5). Never
 * regex-scrapes the description — this is the ADR-0001 amendment contract.
 *
 * @param {{ workItemRefs?: Array<{ id: string | number, url: string }> }} prMetadata
 * @returns {Array<{ id: string, type: string, url: string, raw: object }>}
 * @throws {Error} when `prMetadata` is not a PR-metadata object (guards against a
 *   malformed stdin payload silently yielding zero Work Items)
 */
export function discoverWorkItems(prMetadata) {
	if (prMetadata === null || typeof prMetadata !== 'object' || Array.isArray(prMetadata)) {
		throw new Error(`Expected PR metadata object with optional workItemRefs[], got ${describeType(prMetadata)}`)
	}
	return (prMetadata.workItemRefs ?? []).map((ref) => ({
		id: String(ref.id),
		type: 'ado-work-item',
		url: ref.url,
		raw: ref,
	}))
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
			process.stderr.write('discover-work-items expects PR metadata JSON on stdin (pipe it in)\n')
			process.exit(1)
		}
		/** @type {Buffer[]} */
		const chunks = []
		process.stdin.on('data', (c) => chunks.push(c))
		process.stdin.on('end', () => {
			try {
				const meta = JSON.parse(Buffer.concat(chunks).toString('utf8'))
				process.stdout.write(`${JSON.stringify(discoverWorkItems(meta))}\n`)
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
			'Usage:\n  node provider.mjs parse-url <url>\n  node provider.mjs discover-work-items   (reads PR metadata JSON from stdin)\n'
		)
		process.exit(1)
	}
}
