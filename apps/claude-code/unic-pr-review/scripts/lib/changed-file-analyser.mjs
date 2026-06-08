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
const COMMENT_TOKEN_RE = /^\s*\{?\s*(?:\/\/|\/\*\*?|\*\/|\*[ \t]|#(?:[ \t!]|$)|<!--|-->)/

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
	if (!diff) return false
	for (const line of diff.split(/\r?\n/)) {
		if (line.startsWith('+++') || line.startsWith('---')) continue
		if (!line.startsWith('+') && !line.startsWith('-')) continue
		const content = line.slice(1)
		if (SPDX_RE.test(content)) continue
		if (COMMENT_TOKEN_RE.test(content)) return true
	}
	return false
}

/**
 * Spawn-decision table (ADR-0008). Each entry maps an agent name to its spawn
 * predicate. The table is evaluated in order; code-reviewer is always first.
 *
 * @type {Array<{ agent: string, predicate: (files: string[], diff: string) => boolean }>}
 */
// Intent Assessor is absent deliberately — spawned by intent presence, not file categories (ADR-0011). Never add it here.
const SPAWN_TABLE = [
	{ agent: 'code-reviewer', predicate: () => true },
	{ agent: 'silent-failure-hunter', predicate: (files) => files.some(isSourceFile) },
	{ agent: 'type-design-analyzer', predicate: (files) => files.some(isTypeFile) },
	{ agent: 'pr-test-analyzer', predicate: (files) => files.some(isTestFile) },
	{ agent: 'comment-analyzer', predicate: (files, diff) => files.some(isDocFile) || hasCommentChanges(diff) },
	{ agent: 'code-simplifier', predicate: (files) => files.filter(isSourceFile).length >= 3 },
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
