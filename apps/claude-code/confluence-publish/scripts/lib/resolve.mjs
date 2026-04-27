// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { CliError } from './errors.mjs'

/**
 * Returns true if arg is a non-empty string of decimal digits.
 * @param {string} arg
 * @returns {boolean}
 */
export function isNumericId(arg) {
	return /^\d+$/.test(arg)
}

/**
 * Resolves a page argument to a numeric Confluence page ID.
 * Accepts either a bare numeric string ("987654321") or a key name looked up
 * in `confluence-pages.json` at the current working directory.
 *
 * @param {string} arg - Raw user input: numeric ID or confluence-pages.json key.
 * @returns {number} Positive integer Confluence page ID.
 */
export function resolvePageId(arg) {
	if (isNumericId(arg)) {
		const id = Number.parseInt(arg, 10)
		if (!Number.isInteger(id) || id <= 0) {
			throw new CliError(`Invalid page ID: ${arg}`)
		}
		return id
	}

	const pagesPath = path.join(process.cwd(), 'confluence-pages.json')
	if (!existsSync(pagesPath)) {
		throw new CliError('confluence-pages.json not found — create it or pass a page ID directly')
	}

	/** @type {Record<string, unknown>} */
	let pages
	try {
		pages = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(pagesPath, 'utf8')))
	} catch {
		throw new CliError('invalid JSON in confluence-pages.json — check syntax')
	}

	if (!(arg in pages)) {
		const keys = Object.keys(pages)
			.filter((k) => k !== '_comment')
			.join(', ')
		throw new CliError(`'${arg}' not found in confluence-pages.json — available keys: ${keys}`)
	}

	const id = pages[arg]
	if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
		throw new CliError(`Invalid page ID for key '${arg}': ${id} — must be a positive integer`)
	}

	return id
}
