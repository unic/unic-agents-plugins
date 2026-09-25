#!/usr/bin/env node
// @ts-check
// The matching rule both NDA guards share: `.githooks/pre-commit` and `.githooks/commit-msg` run
// this file, and `.claude/hooks/block-nda-terms.mjs` imports it. One rule in one place, so the
// guards cannot disagree on what counts as a match.
//
// The rule, in two steps:
//   1. Remove base64 data first: every `data:…;base64,` URI with a payload of 80 or more
//      characters, and every run of 80 or more base64 characters that holds a digit and either a
//      `+` or `=` padding, as a sha512 hash (88) does. A short term inside embedded font or image
//      data identifies nobody, and random base64 is full of case changes that step 2 would read as
//      boundaries. A path or URL rarely holds a `+`, so a long one is still matched.
//   2. Match a term, case-insensitively, only where it starts and ends on a word boundary. A
//      boundary is the start or end of the text, a character that is not a letter or digit, a
//      change between letter and digit, or a camelCase change: `acmeSite`, `myAcme` and
//      `ACMESite` all match `acme`. A term buried inside a longer lowercase word, such as
//      `acmesite`, does not.
//
// CLI: `node nda-match.mjs <label> [file]` reads the text from the file, or from stdin, and exits 1
// on a match or when the term list cannot be read. The list lives outside every repository:
// $UNIC_NDA_DENYLIST, else ~/.config/unic/nda-denylist.txt.

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const listPath = () => process.env.UNIC_NDA_DENYLIST ?? join(homedir(), '.config', 'unic', 'nda-denylist.txt')

/**
 * Throws when the list cannot be read: the callers turn that into a refusal.
 * @param {string} path
 */
export function readTerms(path) {
	return readFileSync(path, 'utf8')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'))
}

/** @param {string} term */
export const redact = (term) => term.slice(0, 2) + '*'.repeat(Math.max(1, term.length - 2))

const DATA_URI = /data:[^,\s]*;base64,[A-Za-z0-9+/=]{80,}/g
// A path is also a run of letters, digits and `/`, so a run must hold a `+` or end in `=` as well.
// That `+` cannot be the first character: a diff line starts with one.
const BASE64_RUN = /(?=[A-Za-z0-9+/]*\d)(?=[A-Za-z0-9+/]+[+=])[A-Za-z0-9+/]{80,}={0,2}/g

const isLetter = (/** @type {string | undefined} */ c) => c !== undefined && /\p{L}/u.test(c)
const isDigit = (/** @type {string | undefined} */ c) => c !== undefined && /\p{N}/u.test(c)
const isUpper = (/** @type {string | undefined} */ c) => isLetter(c) && c === c?.toUpperCase() && c !== c?.toLowerCase()
const isLower = (/** @type {string | undefined} */ c) => isLetter(c) && c === c?.toLowerCase() && c !== c?.toUpperCase()

/**
 * Is there a word boundary between `text[i - 1]` and `text[i]`?
 * @param {string} text
 * @param {number} i
 */
function isBoundary(text, i) {
	const before = text[i - 1]
	const after = text[i]
	if (!isLetter(before) && !isDigit(before)) return true
	if (!isLetter(after) && !isDigit(after)) return true
	if (isLetter(before) !== isLetter(after)) return true
	if (isLower(before) && isUpper(after)) return true
	// `ACMESite`: an upper-case run ends where the next word's capital starts.
	return isUpper(before) && isUpper(after) && isLower(text[i + 1])
}

/**
 * The first term that `text` carries under the rule above, or null.
 * @param {string} text
 * @param {string[]} terms
 */
export function findTerm(text, terms) {
	const cleaned = text.replace(DATA_URI, ' ').replace(BASE64_RUN, ' ')
	for (const term of terms) {
		// Search the original text case-insensitively, so every index points into `cleaned` even
		// where lower-casing would change the length (`İ`).
		const needle = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
		// Step one character at a time, so overlapping matches are all checked.
		for (let match = needle.exec(cleaned); match; needle.lastIndex = match.index + 1, match = needle.exec(cleaned)) {
			if (isBoundary(cleaned, match.index) && isBoundary(cleaned, match.index + match[0].length)) return term
		}
	}
	return null
}

async function main() {
	const [label = 'nda-match', file] = process.argv.slice(2)
	const path = listPath()
	let terms
	try {
		terms = readTerms(path)
	} catch {
		process.stderr.write(
			`${label}: cannot read the NDA term list at ${path}, so this commit is refused.\n` +
				"  Create it with one term per line, or 'touch' it to opt out deliberately.\n" +
				'  See AGENTS.md, "The NDA publish guard".\n'
		)
		process.exit(1)
	}

	let text = ''
	if (file) text = readFileSync(file, 'utf8')
	else for await (const chunk of process.stdin) text += chunk

	const term = findTerm(text, terms)
	if (term === null) return
	// Redact the term: the transcript of a refusal must not republish it.
	process.stderr.write(
		`${label}: refusing this commit.\n` +
			`  It carries the NDA term ${redact(term)}, and this repository is public.\n` +
			'  Remove it, or move the detail to a file the repository does not track.\n'
	)
	process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
