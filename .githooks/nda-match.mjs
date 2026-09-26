#!/usr/bin/env node
// @ts-check
// The matching rule both NDA guards share: `.githooks/pre-commit` and `.githooks/commit-msg` run
// this file, and `.claude/hooks/block-nda-terms.mjs` imports it. One rule in one place, so the
// guards cannot disagree on what counts as a match.
//
// The rule, in two steps:
//   1. Remove base64 data first. Remove the payload of every `data:…;base64,` URI whose payload has
//      80 or more characters, and keep the media type. Remove every run of 80 or more characters
//      made only of letters, digits, `+` and `/` that holds a digit and either is followed by `=`
//      or holds a `+` right after a letter or digit. A sha512 hash, 88 characters ending in `==`,
//      is such a run. A `+` must follow a letter or digit, so neither the `+` that starts every
//      staged diff line, the second `+` of a diff line inside Markdown, nor the `+` of a SvelteKit
//      `/+page` route counts. A short term inside embedded font or image data identifies nobody,
//      and random base64 is full of case changes that step 2 would read as boundaries. A long path
//      or URL rarely has a `+` right after a letter or digit, or an `=` right after it, so the rule
//      still matches one.
//   2. Match a term, case-insensitively, only on a word boundary at both ends. A boundary is the
//      edge of the text, any character that is not a letter or digit, a change between letter and
//      digit, a change from lower to upper case, or the capital that starts a capitalised word
//      after another capital. So `acme`, `acme-site`, `acme_site`, `acme2026`, `acmeSite`,
//      `myAcme`, `XAcme` and `ACMESite` all match `acme`.
//
// The rule lets four shapes through. The first is a term joined to a letter where the join is
// neither a change from lower to upper case nor the capital that starts a capitalised word after
// another capital, such as `acmesite`, `Acmesite` or `ACMEsite`. The second is a term inside a
// `data:…;base64,` payload of 80 or more characters. The third is a term inside a run of 80 or more
// characters made only of letters, digits, `+` and `/`, where the run holds a digit and either is
// followed by `=` or holds a `+` right after a letter or digit, such as form-encoded text or a path
// under a `c++` directory. The fourth is a term that starts or ends with a digit and is joined
// there to another digit, such as `acme2` inside `acme26`. Only a term that starts or ends with a
// digit can take this shape.
//
// CLI: `node nda-match.mjs <label> [file]` reads the text from the file, or from stdin, and exits 1
// on a match or when the term list cannot be read. With the label `pre-commit` the text is a diff,
// and its deleted lines do not count: they are already in the published history, and refusing them
// would block the commit that removes a term. The list lives outside every repository:
// $UNIC_NDA_DENYLIST, else ~/.config/unic/nda-denylist.txt.

import { readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const getListPath = () => process.env.UNIC_NDA_DENYLIST ?? join(homedir(), '.config', 'unic', 'nda-denylist.txt')

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

/**
 * A diff without its deleted lines, and without the context git copies into a hunk header from a line
 * above the hunk. File headers stay, so a path that carries a term is still read.
 * @param {string} diff
 */
export const dropDeletedLines = (diff) =>
	diff
		.split('\n')
		.filter((line) => !line.startsWith('-') || line.startsWith('--- '))
		.map((line) => line.replace(/^(@@ [^@]* @@).*/, '$1'))
		.join('\n')

/** @param {string} term */
export const redact = (term) => term.slice(0, 2) + '*'.repeat(Math.max(1, term.length - 2))

// Only the payload goes, so a short media type is still matched. A media type that is itself a
// base64 run falls to BASE64_RUN, as the third let-through shape says.
const DATA_URI = /(data:[^,\s]*;base64,)[A-Za-z0-9+/=]{80,}/g
// Match each run once and test it after. A lookahead that fails rescans the run at every start
// position, which takes seconds on a long hex string.
const BASE64_RUN = /[A-Za-z0-9+/]{80,}={0,2}/g
// A path is also a run of letters, digits and `/`, so the run must also be followed by `=` or hold
// a `+` right after a letter or digit. The `+` that starts a staged diff line, the second `+` of a
// Markdown diff line and the `+` of a SvelteKit `/+page` route do not count.
const isBase64 = (/** @type {string} */ run) => /\d/.test(run) && /[A-Za-z0-9]\+|=$/.test(run)

const isLetter = (/** @type {string | undefined} */ c) => c !== undefined && /\p{L}/u.test(c)
const isDigit = (/** @type {string | undefined} */ c) => c !== undefined && /\p{N}/u.test(c)
const isUpper = (/** @type {string | undefined} */ c) => isLetter(c) && c === c?.toUpperCase() && c !== c?.toLowerCase()
const isLower = (/** @type {string | undefined} */ c) => isLetter(c) && c === c?.toLowerCase() && c !== c?.toUpperCase()

/**
 * Is there a word boundary between the character that ends at `i` and the one that starts there?
 * @param {string} text
 * @param {number} i
 */
function isBoundary(text, i) {
	const before = charBefore(text, i)
	const after = charAt(text, i)
	if (!isLetter(before) && !isDigit(before)) return true
	if (!isLetter(after) && !isDigit(after)) return true
	if (isLetter(before) !== isLetter(after)) return true
	if (isLower(before) && isUpper(after)) return true
	// `ACMESite`: an upper-case run ends where the next word's capital starts.
	return isUpper(before) && isUpper(after) && isLower(charAt(text, i + (after?.length ?? 0)))
}

// Read whole code points: a letter outside the BMP is two UTF-16 units, and neither one alone is a letter.
const charAt = (/** @type {string} */ text, /** @type {number} */ i) => {
	const code = text.codePointAt(i)
	return code === undefined ? undefined : String.fromCodePoint(code)
}
const charBefore = (/** @type {string} */ text, /** @type {number} */ i) => {
	const code = i >= 2 ? text.codePointAt(i - 2) : undefined
	return code !== undefined && code > 0xffff ? String.fromCodePoint(code) : text[i - 1]
}

/**
 * The first term that `text` carries under the rule above, or null.
 * @param {string} text
 * @param {string[]} terms
 */
export function findTerm(text, terms) {
	const cleaned = text.replace(DATA_URI, '$1 ').replace(BASE64_RUN, (run) => (isBase64(run) ? ' ' : run))
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
	const path = getListPath()
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

	const term = findTerm(label === 'pre-commit' ? dropDeletedLines(text) : text, terms)
	if (term === null) return
	// Redact the term: the transcript of a refusal must not republish it.
	process.stderr.write(
		`${label}: refusing this commit.\n` +
			`  It carries the NDA term ${redact(term)}, and this repository is public.\n` +
			'  Remove it, or move the detail to a file the repository does not track.\n'
	)
	process.exit(1)
}

// Node resolves symlinks in `import.meta.url` but not in `argv[1]`, so compare the real paths. A
// `core.hooksPath` set through a symlink would otherwise run nothing and exit 0. An import must never
// throw here: `.claude/hooks/block-nda-terms.mjs` imports this file, and a throw there does not block.
function isRunDirectly() {
	try {
		return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href
	} catch {
		// `argv[1]` names no file, so this file is not the one node was asked to run.
		return false
	}
}
if (isRunDirectly()) main()
