// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import { pathToFileURL } from 'node:url'

/**
 * providers/index.mjs — Source Platform Provider registry (ADR-0010).
 *
 * Each Provider ships as a folder bundle `providers/<name>/`. This module is
 * the registry: `detectProvider(url)` returns the bundle whose `prUrlPattern`
 * matches a PR URL, or `null` when no Provider handles it.
 *
 * @typedef {{
 *   name: string,
 *   label: string,
 *   prUrlPattern: RegExp,
 *   parsePrUrl: (url: string) => { orgUrl: string, project: string, repo: string, prId: number },
 *   agents: { fetcher: string, writer: string },
 *   discoverWorkItems: (prMetadata: object) => Array<{ id: string, type: string, url: string, raw: object }>,
 * }} ProviderModule
 */

/**
 * Registered Providers. Order is first-match-wins.
 * @type {ProviderModule[]}
 */
const PROVIDERS = []

/** Lazy-load Provider bundles on first use to keep top-level imports cheap. */
async function ensureLoaded() {
	if (PROVIDERS.length > 0) return
	const { default: azureDevOps } = await import('./azure_devops/provider.mjs')
	PROVIDERS.push(azureDevOps)
}

/**
 * Detect which Provider handles `url`.
 * @param {string} url
 * @returns {Promise<ProviderModule | null>}
 */
export async function detectProvider(url) {
	await ensureLoaded()
	return PROVIDERS.find((p) => p.prUrlPattern.test(url)) ?? null
}

// CLI entry — `node providers/index.mjs detect <url>`. Writes provider summary
// JSON to stdout (exit 0) or an error to stderr (exit 1) when no Provider matches.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [, , subcommand, url] = process.argv
	if (subcommand === 'detect' && url) {
		const provider = await detectProvider(url)
		if (!provider) {
			process.stderr.write(`No provider matched: ${url}\n`)
			process.exit(1)
		}
		process.stdout.write(
			`${JSON.stringify({
				name: provider.name,
				label: provider.label,
				fetcher: provider.agents.fetcher,
				writer: provider.agents.writer,
			})}\n`
		)
	} else {
		process.stderr.write('Usage: node providers/index.mjs detect <url>\n')
		process.exit(1)
	}
}
