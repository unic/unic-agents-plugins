// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * remote-match.mjs — compare an ADO remote URL against a list of local git remote URLs.
 *
 * Normalises https/ssh forms, .git suffix, host casing, and embedded credentials so
 * that semantically identical URLs compare equal. ADO HTTPS and SSH URLs use different
 * hostnames and path structures, so ADO-specific identity extraction is applied before
 * the generic fallback.
 *
 * CLI: node scripts/lib/remote-match.mjs <adoRemoteUrl>
 *   stdin: raw output of `git remote -v`
 *   stdout: "true" or "false"
 *   exit 0 on success, exit 1 on usage error
 */

import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

/**
 * Extract an ADO canonical identity string `ado:<org>/<project>/<repo>` from a
 * parsed URL, or null if the URL is not a recognised ADO host.
 *
 * Recognised patterns:
 *   HTTPS  https://dev.azure.com/ORG/PROJECT/_git/REPO[.git]
 *   SSH    ssh://ssh.dev.azure.com/v3/ORG/PROJECT/REPO[.git]  (after shorthand expansion)
 *   Legacy https://ORG.visualstudio.com/PROJECT/_git/REPO[.git]
 *
 * @param {URL} parsed
 * @returns {string | null}
 */
function adoIdentity(parsed) {
	const host = parsed.hostname.toLowerCase()
	const parts = parsed.pathname.replace(/^\//, '').split('/')

	if (host === 'dev.azure.com' && parts.length >= 4 && parts[2] === '_git') {
		return `ado:${parts[0].toLowerCase()}/${parts[1].toLowerCase()}/${parts[3].replace(/\.git$/i, '').toLowerCase()}`
	}
	// ssh://ssh.dev.azure.com/v3/ORG/PROJECT/REPO after git shorthand expansion
	if (host === 'ssh.dev.azure.com' && parts.length >= 4 && parts[0] === 'v3') {
		return `ado:${parts[1].toLowerCase()}/${parts[2].toLowerCase()}/${parts[3].replace(/\.git$/i, '').toLowerCase()}`
	}
	if (host.endsWith('.visualstudio.com')) {
		const org = host.split('.')[0]
		if (parts.length >= 3 && parts[1] === '_git') {
			return `ado:${org}/${parts[0].toLowerCase()}/${parts[2].replace(/\.git$/i, '').toLowerCase()}`
		}
	}
	return null
}

/**
 * Normalise a git remote URL to a canonical string for equality comparison.
 * Returns an `ado:<org>/<project>/<repo>` token for ADO hosts, a bare
 * `<host>/<path>` string for parseable non-ADO URLs, or a best-effort
 * lowercased string for URLs that cannot be parsed.
 *
 * @param {string} rawUrl
 * @returns {string}
 */
function normalise(rawUrl) {
	const original = rawUrl.trim()
	let url = original

	// Expand git shorthand  git@host:path  →  ssh://host/path
	const shorthand = url.match(/^(?:[a-zA-Z0-9._-]+@)([^:]+):(.+)$/)
	if (shorthand != null && !url.startsWith('http') && !url.startsWith('ssh://')) {
		url = `ssh://${shorthand[1]}/${shorthand[2]}`
	}

	try {
		const parsed = new URL(url)
		const ado = adoIdentity(parsed)
		if (ado != null) return ado

		// Generic: strip credentials, lowercase host, strip .git suffix + trailing slashes
		parsed.username = ''
		parsed.password = ''
		parsed.hostname = parsed.hostname.toLowerCase()
		let path = parsed.pathname
		if (path.endsWith('.git')) path = path.slice(0, -4)
		while (path.endsWith('/')) path = path.slice(0, -1)
		return `${parsed.hostname}${path}`
	} catch {
		// URL not parseable — best-effort lowercase + strip .git suffix + trailing slash
		return original
			.toLowerCase()
			.replace(/\.git$/, '')
			.replace(/\/$/, '')
	}
}

/**
 * Return true if any URL in localRemoteUrls normalises to the same identity as
 * adoRemoteUrl, false otherwise (including when localRemoteUrls is empty).
 *
 * @param {string} adoRemoteUrl
 * @param {string[]} localRemoteUrls
 * @returns {boolean}
 */
export function remotesMatch(adoRemoteUrl, localRemoteUrls) {
	if (typeof adoRemoteUrl !== 'string' || !adoRemoteUrl) return false
	if (!Array.isArray(localRemoteUrls) || localRemoteUrls.length === 0) return false
	const adoNorm = normalise(adoRemoteUrl)
	return localRemoteUrls.some((u) => typeof u === 'string' && normalise(u) === adoNorm)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	async function main() {
		const adoUrl = process.argv[2]
		if (!adoUrl) {
			process.stderr.write(
				'remote-match: usage: node scripts/lib/remote-match.mjs <adoRemoteUrl>  (git remote -v output on stdin)\n'
			)
			process.exit(1)
		}

		const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })
		const seen = new Set()
		/** @type {string[]} */
		const localUrls = []
		for await (const line of rl) {
			const url = line.split(/\s+/)[1]
			if (url && !seen.has(url)) {
				seen.add(url)
				localUrls.push(url)
			}
		}

		process.stdout.write(`${remotesMatch(adoUrl, localUrls)}\n`)
	}

	main().catch((err) => {
		process.stderr.write(`remote-match: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`)
		process.exit(1)
	})
}
