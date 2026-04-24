// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Returns true if arg is a non-empty string of decimal digits.
 * @param {string} arg
 * @returns {boolean}
 */
export function isNumericId(arg) {
	return /^\d+$/.test(arg);
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
		const id = Number.parseInt(arg, 10);
		if (!Number.isInteger(id) || id <= 0) {
			console.error(`Invalid page ID: ${arg}`);
			process.exit(1);
		}
		return id;
	}

	const pagesPath = path.join(process.cwd(), "confluence-pages.json");
	if (!existsSync(pagesPath)) {
		console.error("confluence-pages.json not found — create it or pass a page ID directly");
		process.exit(1);
	}

	/** @type {Record<string, unknown>} */
	let pages;
	try {
		pages = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(pagesPath, "utf8")));
	} catch {
		console.error("invalid JSON in confluence-pages.json — check syntax");
		process.exit(1);
	}

	if (!(arg in pages)) {
		const keys = Object.keys(pages)
			.filter((k) => k !== "_comment")
			.join(", ");
		console.error(`'${arg}' not found in confluence-pages.json — available keys: ${keys}`);
		process.exit(1);
	}

	const id = pages[arg];
	if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
		console.error(`Invalid page ID for key '${arg}': ${id} — must be a positive integer`);
		process.exit(1);
	}

	return id;
}
