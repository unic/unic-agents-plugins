// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const FILENAME = 'confluence-pages.json'

/**
 * @param {string} cwd
 * @returns {{ pages: Record<string, unknown>, path: string, existed: boolean }}
 */
export function readPagesFile(cwd) {
	const p = path.join(cwd, FILENAME)
	if (!existsSync(p)) return { pages: {}, path: p, existed: false }
	const pages = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(p, 'utf8')))
	return { pages, path: p, existed: true }
}

/**
 * @param {Record<string, unknown>} pages
 * @param {number} pageId
 * @returns {string | null}
 */
export function findAliasForId(pages, pageId) {
	for (const [k, v] of Object.entries(pages)) {
		if (k === '_comment') continue
		if (typeof v === 'number' && v === pageId) return k
	}
	return null
}

/**
 * @param {Record<string, unknown>} pages
 * @param {string} baseSlug
 * @param {number} pageId
 * @returns {string}
 */
export function pickAvailableAlias(pages, baseSlug, pageId) {
	const start = baseSlug || `page-${pageId}`
	if (!Object.hasOwn(pages, start)) return start
	for (let i = 2; ; i++) {
		const candidate = `${start}-${i}`
		if (!Object.hasOwn(pages, candidate)) return candidate
	}
}

/**
 * Returns a new object with the alias appended, preserving existing key order.
 *
 * @param {Record<string, unknown>} pages
 * @param {string} alias
 * @param {number} pageId
 * @returns {Record<string, unknown>}
 */
export function appendAlias(pages, alias, pageId) {
	return { ...pages, [alias]: pageId }
}

/**
 * @param {string} filePath
 * @param {Record<string, unknown>} pages
 */
export function writePagesFile(filePath, pages) {
	writeFileSync(filePath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8')
}

/**
 * @param {Record<string, unknown>} pages
 * @returns {Array<[string, number]>}
 */
export function listAliases(pages) {
	const out = /** @type {Array<[string, number]>} */ ([])
	for (const [k, v] of Object.entries(pages)) {
		if (k === '_comment') continue
		if (typeof v === 'number') out.push([k, v])
	}
	out.sort(([a], [b]) => a.localeCompare(b))
	return out
}
