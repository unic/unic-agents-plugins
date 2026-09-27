#!/usr/bin/env node
// @ts-check
// The matching rule every NDA guard shares: `.githooks/pre-commit` and `.githooks/commit-msg` run
// this file, and `.githooks/nda-push.mjs` and `.claude/hooks/block-nda-terms.mjs` import it. One rule
// in one place, so the guards cannot disagree on what counts as a match.
//
// The rule, in three steps:
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
//   3. When the text holds a NUL byte and step 2 found nothing, run steps 1 and 2 again on the text
//      with every NUL byte removed. UTF-16 text in the ASCII range reads as letters with a NUL
//      between each pair, so this finds a term in it. The first run keeps a NUL next to a term as a
//      boundary.
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
// on a match or when the term list cannot be read. With the label `pre-commit` and no file, it reads
// the staged diff itself and exits 1 when git cannot produce it. That text is a diff,
// and its deleted lines do not count: they are already in the published history, and refusing them
// would block the commit that removes a term. An added or modified PNG is read from its blob, every
// chunk but `IDAT`, as `readDiffTexts` says. The list lives outside every repository:
// $UNIC_NDA_DENYLIST, else ~/.config/unic/nda-denylist.txt.

import { execFileSync } from 'node:child_process'
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
 * Git options that make a diff show every added line as text, whatever the git config says.
 * `--text` shows a binary file's content, `--no-ext-diff` and `--no-textconv` stop a `diff.external`
 * command, a `-diff` attribute or a textconv filter from replacing it, and `--no-color` keeps
 * `color.ui=always` from putting escape codes before the `-` and `+` of each line. `--full-index`
 * gives the whole post-image id that `readDiffTexts` reads a PNG blob by. `--src-prefix=a/` and
 * `--dst-prefix=b/` keep `diff.noprefix`, `diff.mnemonicPrefix` and `diff.dstPrefix` from changing the
 * `+++ b/` line that `readDiffTexts` finds a PNG by. `--default-prefix` would do the same, but it needs
 * git 2.41.
 */
export const DIFF_FLAGS = [
	'-U0',
	'--text',
	'--no-ext-diff',
	'--no-textconv',
	'--no-color',
	'--full-index',
	'--src-prefix=a/',
	'--dst-prefix=b/',
]

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
// The path of a file section's new side, from `+++ b/<path>`, `rename to <path>` or `copy to <path>`.
// Git quotes a path with special characters, and ends a `+++` line with a tab when the path holds a space.
const PNG_PATH_LINE = /^(?:\+\+\+ "?b\/|rename to "?|copy to "?)(.*\.png)"?\t?$/i
const POST_IMAGE_ID = /^index [0-9a-f]+\.\.([0-9a-f]+)/

/**
 * The texts a diff publishes, each with the path of the PNG it comes from, or null. The first text
 * holds the added lines of every file, as `dropDeletedLines` keeps them. For an added or modified
 * `*.png`, the guard scans the file header but not the hunks, and reads the file's post-image blob
 * by the id on its `index` line, which `--full-index` makes whole. That works in a `git log -p`
 * stream too, which has no commit boundary to read the file at. When the blob parses as a PNG, the
 * guard adds one text per chunk except `IDAT`, whose compressed bytes match a short term by chance
 * and hold no text anyone wrote. Each chunk is its own text, so no match spans two chunks. When the
 * blob does not parse, the guard adds the whole blob as one text. When git cannot read the blob, the
 * guard scans the hunks as for any other file. For every file the guard drops the `index` lines,
 * because they hold only object ids. The file header stays, so the guard still reads the path.
 * @param {string} diff
 * @param {(id: string, path: string) => Buffer | null} readBlob
 * @returns {Array<[string | null, string]>}
 */
export function readDiffTexts(diff, readBlob) {
	/** @type {string[]} */
	const kept = []
	/** @type {Array<[string, string]>} */
	const blobTexts = []
	for (const section of diff.split(/^(?=diff --git )/m)) {
		const lines = section.split('\n')
		const hunkStart = lines.findIndex((line) => line.startsWith('@@'))
		const header = hunkStart === -1 ? lines : lines.slice(0, hunkStart)
		const postImageId = header.map((line) => POST_IMAGE_ID.exec(line)?.[1]).find(Boolean)
		const pngPath = header.map((line) => PNG_PATH_LINE.exec(line)?.[1]).find(Boolean)
		const blob = pngPath && postImageId && !/^0+$/.test(postImageId) ? readBlob(postImageId, pngPath) : null
		const headerOnly = header.filter((line) => !line.startsWith('index '))
		if (blob === null) {
			kept.push([...headerOnly, ...(hunkStart === -1 ? [] : lines.slice(hunkStart))].join('\n'))
			continue
		}
		kept.push(`${headerOnly.join('\n')}\n`)
		for (const text of readPngChunkTexts(blob) ?? [blob.toString('utf8')]) blobTexts.push([pngPath, text])
	}
	return [[null, dropDeletedLines(kept.join(''))], ...blobTexts]
}

/**
 * The type and data of every chunk but `IDAT`, one text per chunk, or null when the blob is not a
 * PNG: a wrong signature, a chunk that runs past the end, or fewer than 12 bytes after the last whole
 * chunk.
 * @param {Buffer} blob
 */
export function readPngChunkTexts(blob) {
	if (!blob.subarray(0, 8).equals(PNG_SIGNATURE)) return null
	/** @type {string[]} */
	const texts = []
	for (let at = 8; at < blob.length; ) {
		// Four bytes of length, four of type, the data, and four of CRC.
		if (at + 12 > blob.length) return null
		const end = at + 12 + blob.readUInt32BE(at)
		if (end > blob.length) return null
		const type = blob.toString('latin1', at + 4, at + 8)
		if (type !== 'IDAT') texts.push(`${type}\n${blob.toString('utf8', at + 8, end - 4)}`)
		at = end
	}
	return texts
}

/**
 * A blob's content, or null when git cannot read it. The caller then scans the file's diff lines.
 * @param {string} id
 * @param {string} path
 * @param {string} label the hook that reads it
 */
export function readBlob(id, path, label) {
	try {
		return execFileSync('git', ['--no-replace-objects', 'cat-file', 'blob', id], {
			encoding: 'buffer',
			maxBuffer: 512 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe'],
		})
	} catch (error) {
		const { stderr, message } = /** @type {{ stderr?: unknown, message?: unknown }} */ (error)
		process.stderr.write(
			`${label}: cannot read the blob ${id} of ${path}, so its diff lines are scanned instead (${
				String(stderr || message)
					.trim()
					.split('\n')[0]
			}).\n`
		)
		return null
	}
}

/**
 * A diff without its deleted text. Inside a hunk, a line that starts with `-` goes. In a file header,
 * `--- a/<name>`, `deleted file mode`, `rename from` and `copy from` go, and so does the `diff --git`
 * line of a file that is deleted, renamed or copied. Any other `diff --git` line stays whole. A hunk header loses the context git copies into it from a
 * line above the hunk. So an added path or line that carries a term is still read.
 * @param {string} diff
 */
export function dropDeletedLines(diff) {
	/** @type {string[]} */
	const kept = []
	let isInHunk = false
	/** @type {string | null} */
	let pendingHeader = null
	const flush = () => {
		if (pendingHeader !== null) kept.push(pendingHeader)
		pendingHeader = null
	}
	for (const line of diff.split('\n')) {
		if (line.startsWith('diff --git ')) {
			flush()
			isInHunk = false
			// Kept whole: a path can hold ` b/`, so the new side cannot be cut out reliably.
			pendingHeader = line
		} else if (line.startsWith('@@')) {
			flush()
			isInHunk = true
			kept.push(line.replace(/^(@@ [^@]* @@).*/, '$1'))
		} else if (isInHunk) {
			if (!line.startsWith('-')) kept.push(line)
		} else if (/^(?:deleted file mode|rename from |copy from )/.test(line)) {
			// The old name is published already. `rename to` or `copy to` carries the new one.
			pendingHeader = null
		} else if (!line.startsWith('--- ')) {
			kept.push(line)
		}
	}
	flush()
	return kept.join('\n')
}

const SCISSORS = '------------------------ >8 ------------------------'

/**
 * Returns the commit message without every line from the scissors line down and every line that
 * starts with the comment string. Under `auto` git picks the character at commit time, so it comes
 * from the scissors line and from every template line that names it in quotes. When those name no
 * character, or name more than one, it removes no comment line. Git keeps some of these lines, and the hook cannot see when.
 * `AGENTS.md`, "The NDA publish guard", lists those cases in its accepted gaps. `pre-push` refuses a
 * term there.
 * @param {string} message
 * @param {string} comment the comment string, or `auto` in any case
 */
export function dropCommentLines(message, comment) {
	const lines = message.split('\n')
	const active = comment.toLowerCase() === 'auto' ? findAutoComment(lines) : comment
	if (active === null) return message
	const end = lines.indexOf(`${active} ${SCISSORS}`)
	return lines
		.slice(0, end === -1 ? undefined : end)
		.filter((line) => !line.startsWith(active))
		.join('\n')
}

// Under `auto`, git picks the comment character from this set only.
const AUTO_COMMENT_CHARS = '#;@!$%^&|:'

/** @param {string[]} lines */
function findAutoComment(lines) {
	// Candidates are the scissors line and every line that starts with one of those characters and
	// names it in quotes, as git's template does in `# with '#' will be ignored`. The match is loose.
	const found = new Set(
		lines
			.filter(
				(line) =>
					AUTO_COMMENT_CHARS.includes(line[0]) && (line === `${line[0]} ${SCISSORS}` || /^(.) .*'\1'/u.test(line))
			)
			.map((line) => line[0])
	)
	// Candidates that disagree mean the user typed one of them, so the hook removes no line and reads the whole file.
	return found.size === 1 ? [...found][0] : null
}

// Git reads `core.commentString` and `core.commentChar` as one setting, and the value read last wins,
// across scopes too. Git uses `#` when neither is set.
function readCommentString() {
	try {
		const output = execFileSync('git', ['config', '--get-regexp', '^core\\.comment(char|string)$'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		const last =
			output
				.replace(/\r?\n$/, '')
				.split(/\r?\n/)
				.at(-1) ?? ''
		// Git refuses an empty value, and an empty prefix would drop every line.
		return last.includes(' ') ? last.slice(last.indexOf(' ') + 1) : '#'
	} catch (error) {
		const { status, stderr, message } = /** @type {{ status?: unknown, stderr?: unknown, message?: unknown }} */ (error)
		// Exit 1 means neither key is set.
		if (status === 1) return '#'
		process.stderr.write(
			`commit-msg: cannot read core.commentString or core.commentChar, so this commit is refused (${
				String(stderr || message)
					.trim()
					.split('\n')[0]
			}).\n`
		)
		process.exit(1)
	}
}

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
	const before = getCharBefore(text, i)
	const after = getCharAt(text, i)
	if (!isLetter(before) && !isDigit(before)) return true
	if (!isLetter(after) && !isDigit(after)) return true
	if (isLetter(before) !== isLetter(after)) return true
	if (isLower(before) && isUpper(after)) return true
	// `ACMESite`: an upper-case run ends where the next word's capital starts.
	return isUpper(before) && isUpper(after) && isLower(getCharAt(text, i + (after?.length ?? 0)))
}

// Read whole code points: a letter outside the BMP is two UTF-16 units, and neither one alone is a letter.
const getCharAt = (/** @type {string} */ text, /** @type {number} */ i) => {
	const code = text.codePointAt(i)
	return code === undefined ? undefined : String.fromCodePoint(code)
}
const getCharBefore = (/** @type {string} */ text, /** @type {number} */ i) => {
	const code = i >= 2 ? text.codePointAt(i - 2) : undefined
	return code !== undefined && code > 0xffff ? String.fromCodePoint(code) : text[i - 1]
}

/**
 * The first term that `text` carries under the rule above, or null.
 * @param {string} text
 * @param {string[]} terms
 */
export function findTerm(text, terms) {
	// UTF-16 text in the ASCII range reads as letters with a NUL between each pair. Read it again with
	// the NULs removed, and keep the first read, where a NUL next to a term is a boundary.
	return findTermOnce(text, terms) ?? (text.includes('\0') ? findTermOnce(text.replaceAll('\0', ''), terms) : null)
}

/**
 * @param {string} text
 * @param {string[]} terms
 */
function findTermOnce(text, terms) {
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

// Read inside node, not through a shell variable: `$(...)` drops NUL bytes, which joins a term to the
// text around it, and a failing `git diff` in a pipe would hand over an empty diff that passes.
function readStagedDiff() {
	try {
		return execFileSync(
			'git',
			['--no-replace-objects', '-c', 'core.quotePath=false', 'diff', '--cached', ...DIFF_FLAGS],
			{
				encoding: 'utf8',
				maxBuffer: 512 * 1024 * 1024,
				stdio: ['ignore', 'pipe', 'pipe'],
			}
		)
	} catch (error) {
		const { stderr, message } = /** @type {{ stderr?: unknown, message?: unknown }} */ (error)
		process.stderr.write(
			`pre-commit: cannot read the staged diff, so this commit is refused (${
				String(stderr || message)
					.trim()
					.split('\n')[0]
			}).\n`
		)
		process.exit(1)
	}
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
	if (file) text = dropCommentLines(readFileSync(file, 'utf8'), readCommentString())
	else if (label === 'pre-commit') text = readStagedDiff()
	else for await (const chunk of process.stdin) text += chunk

	const texts =
		label === 'pre-commit'
			? readDiffTexts(text, (id, path) => readBlob(id, path, label)).map(([, each]) => each)
			: [text]
	const term = texts.map((each) => findTerm(each, terms)).find((found) => found !== null) ?? null
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
