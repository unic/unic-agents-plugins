// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import { pathToFileURL } from 'node:url'

/**
 * changed-file-analyser.mjs — determine which Review Aspect agents to spawn
 * based on the changed-files list (ADR-0008: conditional sub-agent spawning).
 *
 * Classification is path/extension-based. code-reviewer always runs for any
 * non-empty diff; the other five aspects are conditional on file categories.
 */

/** @param {string} f */
const isTestFile = (f) =>
	/\.(test|spec)\.(mjs|cjs|js|ts|tsx|jsx)$/.test(f) || /(^|[/\\])(tests?|__tests?__)[/\\]/i.test(f)

/** @param {string} f */
const isSourceFile = (f) => /\.(mjs|cjs|js|ts|tsx|jsx)$/.test(f) && !isTestFile(f) && !/\.d\.ts$/.test(f)

/** @param {string} f */
const isTypeFile = (f) =>
	/\.d\.ts$/.test(f) || /(^|[/\\])(types?|schemas?|interfaces?)[/\\]/i.test(f) || /\.tsx?$/.test(f)

/** @param {string} f */
const isDocFile = (f) => /\.(md|mdx)$/.test(f) || /(^|[/\\])docs?[/\\]/i.test(f)

/** Lines matching SPDX / copyright boilerplate — excluded from comment detection */
const SPDX_RE = /SPDX-License-Identifier:|Copyright\s+(?:[©&(C)0-9])/i

// Tokens that identify a line as a comment in common languages.
// The optional leading `{` admits JSX expression-wrapped block comments.
// Anchored at line start (`^\s*`) by design: this matches comment-only lines and
// deliberately ignores trailing comments on a code line (e.g. `const x = 1 // note`).
// An unanchored `//` would match inside string/URL literals (`'https://…'`), producing
// false positives; the Y-det contract (ADR-0008) favours that miss over the false match.
const COMMENT_TOKEN_RE = /^\s*\{?\s*(?:\/\/|\/\*\*?|\*\/|\*[ \t]|#(?:[ \t!]|$)|<!--|-->)/

/**
 * Iterate over the added/removed hunk lines of a unified diff, calling predicate
 * for each line's content (the `+`/`-` prefix stripped). Returns true on the first
 * match, false when the diff is empty or no line matches.
 *
 * @param {string} diff
 * @param {(content: string) => boolean} predicate
 * @returns {boolean}
 */
function scanDiffLines(diff, predicate) {
	if (!diff) return false
	for (const line of diff.split(/\r?\n/)) {
		if (line.startsWith('+++') || line.startsWith('---')) continue
		if (!line.startsWith('+') && !line.startsWith('-')) continue
		if (predicate(line.slice(1))) return true
	}
	return false
}

/**
 * Returns true when the unified diff adds or removes at least one comment line,
 * excluding SPDX/license boilerplate. Per ADR-0008: the comments gate is biased
 * toward spawning on ambiguity — a false-positive is a cheap empty result block,
 * a false-negative silently omits a finding set (the PR #5612 miss).
 *
 * Detected tokens: `//`, `/**`, block-comment delimiters, `* ` (JSDoc continuation),
 * `<!--` `-->` (HTML/JSX), `#` (shell/Python/YAML/Ruby — includes shebangs and YAML
 * comments, intentionally broad per ADR-0008 spawning bias). SPDX/copyright lines excluded.
 *
 * @param {string} diff - unified diff string (may be empty)
 * @returns {boolean}
 */
export function hasCommentChanges(diff) {
	return scanDiffLines(diff, (c) => !SPDX_RE.test(c) && COMMENT_TOKEN_RE.test(c))
}

// Tokens that identify a line as containing a JSDoc type construct.
// Targets @typedef, @type {T}, @param {T}, @returns?{T}, and @satisfies —
// the JSDoc-in-.mjs surface that isTypeFile is blind to. Inline JSDoc casts
// (/** @type {T} */ (x)) are caught by the @type arm. Additive content gate
// for the types row in ADR-0008 (path trigger is fast path, this is additive).
const JSDOC_TYPE_RE = /@typedef\b|@type\s*\{|@param\s*\{|@returns?\s*\{|@satisfies\b/

/**
 * Returns true when the unified diff adds or removes at least one JSDoc type
 * construct (`@typedef`, `@type {T}`, `@param {T}`, `@returns {T}`, `@satisfies`,
 * or inline JSDoc cast) in any file. Used as the additive content gate for
 * `type-design-analyzer` — the path trigger (`isTypeFile`) already covers
 * `.ts`/`.tsx`/`.d.ts` files; this gate catches JSDoc-typed `.mjs`/`.js` files
 * the path classifier is blind to (ADR-0008 types row). Biased toward spawning
 * on ambiguity per ADR-0008.
 *
 * @param {string} diff - unified diff string (may be empty)
 * @returns {boolean}
 */
export function hasJsDocTypeChanges(diff) {
	return scanDiffLines(diff, (c) => JSDOC_TYPE_RE.test(c))
}

// Tokens that identify a line as touching error-handling control flow.
// Arms: `try {`, `catch (`, `finally {`, bare `throw`, `.catch(` (Promise chain —
// explicit arm for readability; `\bcatch\s*\(` already matches this since `.` creates
// a word boundary before `c`, but the leading `.` makes the Promise-chain intent obvious),
// `Promise.reject(`, and the broad `\b(?:error|err)\b` identifier arm.
const ERROR_HANDLING_RE =
	/\btry\s*\{|\bcatch\s*\(|\bfinally\s*\{|\bthrow\b|\.catch\s*\(|Promise\.reject\s*\(|\b(?:error|err)\b/

/**
 * Returns true when the unified diff adds or removes at least one error-handling
 * construct. Uses scanDiffLines to walk `+`/`-` hunk lines.
 *
 * Y-det gate for error-handling constructs (ADR-0008). This is the WEAKEST-FIDELITY
 * gate — "error handling changed" is genuinely semantic, not lexical. The
 * `\b(?:error|err)\b` arm over-fires on standalone `error`/`err` variable names used
 * in non-error-handling contexts (e.g. `const error = response.data`, `const err = count`);
 * `\b` prevents matching compound identifiers like `errorMessage` or `errCount`. The
 * `.catch(` arm matches Promise chains regardless of
 * whether they handle errors meaningfully. Both are deliberate per the ADR-0008 spawning
 * bias: a false-positive spawn is a cheap empty result block, a false-negative silently
 * omits a finding set. FIRST CANDIDATE FOR Y-llm PROMOTION (model-assisted gate
 * classification) if this gate proves too noisy or too blind in practice. See
 * ADR-0008 §Y-llm promotion caveat.
 *
 * @param {string} diff - unified diff string (may be empty)
 * @returns {boolean}
 */
export function hasErrorHandlingChanges(diff) {
	return scanDiffLines(diff, (c) => ERROR_HANDLING_RE.test(c))
}

/**
 * Spawn-decision table (ADR-0008). Each entry maps an agent name to its spawn
 * predicate. The table is evaluated in order; code-reviewer is always first.
 *
 * code-simplifier is absent deliberately — it runs as a Phase 2 post-pass only
 * when Phase 1 yields no Critical/Important findings and ≥3 source files changed
 * (ADR-0013). Use shouldRunPhase2() to evaluate that gate. Never add it here.
 *
 * @type {Array<{ agent: string, predicate: (files: string[], diff: string) => boolean }>}
 */
// Intent Assessor is absent deliberately — spawned by intent presence, not file categories (ADR-0011). Never add it here.
const SPAWN_TABLE = [
	{ agent: 'code-reviewer', predicate: () => true },
	{
		agent: 'silent-failure-hunter',
		predicate: (files, diff) => files.some(isSourceFile) || hasErrorHandlingChanges(diff),
	},
	{ agent: 'type-design-analyzer', predicate: (files, diff) => files.some(isTypeFile) || hasJsDocTypeChanges(diff) },
	{ agent: 'pr-test-analyzer', predicate: (files) => files.some(isTestFile) },
	{ agent: 'comment-analyzer', predicate: (files, diff) => files.some(isDocFile) || hasCommentChanges(diff) },
]

/**
 * Decide which Review Aspect agents to spawn for a given set of changed files.
 *
 * Returns a Set of agent names. Returns an empty Set for an empty diff — the
 * orchestrator should warn the user and skip spawning.
 *
 * @param {string[]} changedFiles - relative paths of files changed in the diff
 * @param {string} [diffContent] - optional unified diff string for content-aware gates
 * @returns {Set<string>} agent names to spawn
 * @throws {Error} when changedFiles is not an array
 */
export function decideSpawnSet(changedFiles, diffContent = '') {
	if (!Array.isArray(changedFiles)) {
		throw new Error(`decideSpawnSet: changedFiles must be an array, got ${typeof changedFiles}`)
	}
	if (changedFiles.length === 0) return new Set()
	return new Set(SPAWN_TABLE.filter(({ predicate }) => predicate(changedFiles, diffContent)).map(({ agent }) => agent))
}

/**
 * Decide whether to run the Phase 2 code-simplifier pass (ADR-0013).
 *
 * Returns true only when both conditions hold:
 *   1. No Critical or Important findings in Phase 1 (severity gate, ADR-0002).
 *   2. Three or more non-test source files changed (file-count gate).
 *
 * @param {string[]} changedFiles - relative paths of files changed in the diff
 * @param {Array<{ severity?: string }>} findings - merged Phase 1 findings
 * @returns {boolean}
 */
export function shouldRunPhase2(changedFiles, findings) {
	if (!Array.isArray(changedFiles))
		throw new Error(`shouldRunPhase2: changedFiles must be an array, got ${typeof changedFiles}`)
	if (!Array.isArray(findings)) throw new Error(`shouldRunPhase2: findings must be an array, got ${typeof findings}`)
	const hasBlocker = findings.some((f) => f.severity === 'critical' || f.severity === 'important')
	if (hasBlocker) return false
	return changedFiles.filter(isSourceFile).length >= 3
}

/**
 * Parse raw stdin into a clean list of changed-file paths.
 *
 * Splits on LF or CRLF and trims each line so trailing carriage returns on
 * CRLF platforms (e.g. `src/a.mjs\r`) do not break extension/path matching.
 * Blank and whitespace-only lines are dropped.
 *
 * @param {string} raw - raw stdin contents
 * @returns {string[]} trimmed, non-empty file paths
 */
export function parseStdin(raw) {
	return raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
}

/**
 * Parse raw stdin into a structured analyser input.
 *
 * Accepts two formats:
 * - JSON object `{"files":[...],"diff":"..."}` — new content-aware path
 * - Plain newline-separated file paths — backward-compatible legacy path
 *
 * @param {string} raw - raw stdin contents
 * @returns {{ files: string[], diff: string }}
 * @throws {SyntaxError} when raw starts with '{' and is not valid JSON
 */
export function parseInput(raw) {
	const trimmed = raw.trimStart()
	if (trimmed.startsWith('{')) {
		const parsed = JSON.parse(trimmed)
		return {
			files: Array.isArray(parsed.files) ? parsed.files : [],
			diff: typeof parsed.diff === 'string' ? parsed.diff : '',
		}
	}
	return { files: parseStdin(raw), diff: '' }
}

/** @param {unknown} err */
const errMsg = (err) => (err instanceof Error ? err.message : String(err))

// CLI entry — reads stdin (plain file list or JSON {files,diff}), writes JSON array to stdout.
// Only runs when executed directly: `node scripts/lib/changed-file-analyser.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	/** @type {Buffer[]} */
	const chunks = []
	process.stdin.on('data', (chunk) => chunks.push(chunk))
	process.stdin.on('end', () => {
		try {
			const raw = Buffer.concat(chunks).toString('utf8')
			const { files, diff } = parseInput(raw)
			const agents = [...decideSpawnSet(files, diff)]
			process.stdout.write(`${JSON.stringify(agents)}\n`)
		} catch (err) {
			process.stderr.write(`changed-file-analyser: ${errMsg(err)}\n`)
			process.exit(1)
		}
	})
	process.stdin.on('error', (err) => {
		process.stderr.write(`changed-file-analyser: ${errMsg(err)}\n`)
		process.exit(1)
	})
}
