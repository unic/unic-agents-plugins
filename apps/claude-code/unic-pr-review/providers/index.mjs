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

/** @param {unknown} err */
const errMsg = (err) => (err instanceof Error ? err.message : String(err))

// CLI entry — `node providers/index.mjs detect|parse-url|discover-work-items <url>`.
// Exits 0 on success (JSON to stdout); exits 1 on stderr when no Provider matches or usage is invalid.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [, , subcommand, url] = process.argv
	if (subcommand === 'detect' && url) {
		try {
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
		} catch (err) {
			process.stderr.write(`Provider registry error: ${errMsg(err)}\n`)
			process.exit(1)
		}
	} else if (subcommand === 'parse-url' && url) {
		try {
			const provider = await detectProvider(url)
			if (!provider) {
				process.stderr.write(`No provider matched: ${url}\n`)
				process.exit(1)
			}
			process.stdout.write(`${JSON.stringify(provider.parsePrUrl(url))}\n`)
		} catch (err) {
			process.stderr.write(`URL parse error: ${errMsg(err)}\n`)
			process.exit(1)
		}
	} else if (subcommand === 'discover-work-items' && url) {
		try {
			const provider = await detectProvider(url)
			if (!provider) {
				process.stderr.write(`No provider matched: ${url}\n`)
				process.exit(1)
			}
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
					process.stdout.write(`${JSON.stringify(provider.discoverWorkItems(meta))}\n`)
				} catch (err) {
					process.stderr.write(`${errMsg(err)}\n`)
					process.exit(1)
				}
			})
			process.stdin.on('error', (err) => {
				process.stderr.write(`${errMsg(err)}\n`)
				process.exit(1)
			})
		} catch (err) {
			process.stderr.write(`Provider registry error: ${errMsg(err)}\n`)
			process.exit(1)
		}
	} else {
		process.stderr.write(
			'Usage:\n  node providers/index.mjs detect <url>\n  node providers/index.mjs parse-url <url>\n  node providers/index.mjs discover-work-items <url>   (reads PR metadata JSON from stdin)\n'
		)
		process.exit(1)
	}
}
