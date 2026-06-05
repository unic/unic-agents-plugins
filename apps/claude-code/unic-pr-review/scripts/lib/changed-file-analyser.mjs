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

/**
 * Spawn-decision table (ADR-0008). Each entry maps an agent name to its spawn
 * predicate. The table is evaluated in order; code-reviewer is always first.
 *
 * code-simplifier is absent deliberately — it runs as a Phase 2 post-pass only
 * when Phase 1 yields no Critical/Important findings and ≥3 source files changed
 * (ADR-0013). Use shouldRunPhase2() to evaluate that gate. Never add it here.
 *
 * @type {Array<{ agent: string, predicate: (files: string[]) => boolean }>}
 */
// Intent Assessor is absent deliberately — spawned by intent presence, not file categories (ADR-0011). Never add it here.
const SPAWN_TABLE = [
	{ agent: 'code-reviewer', predicate: () => true },
	{ agent: 'silent-failure-hunter', predicate: (files) => files.some(isSourceFile) },
	{ agent: 'type-design-analyzer', predicate: (files) => files.some(isTypeFile) },
	{ agent: 'pr-test-analyzer', predicate: (files) => files.some(isTestFile) },
	{ agent: 'comment-analyzer', predicate: (files) => files.some(isDocFile) },
]

/**
 * Decide which Review Aspect agents to spawn for a given set of changed files.
 *
 * Returns a Set of agent names. Returns an empty Set for an empty diff — the
 * orchestrator should warn the user and skip spawning.
 *
 * @param {string[]} changedFiles - relative paths of files changed in the diff
 * @returns {Set<string>} agent names to spawn
 * @throws {Error} when changedFiles is not an array
 */
export function decideSpawnSet(changedFiles) {
	if (!Array.isArray(changedFiles)) {
		throw new Error(`decideSpawnSet: changedFiles must be an array, got ${typeof changedFiles}`)
	}
	if (changedFiles.length === 0) return new Set()
	return new Set(SPAWN_TABLE.filter(({ predicate }) => predicate(changedFiles)).map(({ agent }) => agent))
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

/** @param {unknown} err */
const errMsg = (err) => (err instanceof Error ? err.message : String(err))

// CLI entry — reads newline-separated file paths from stdin, writes JSON array to stdout.
// Only runs when executed directly: `node scripts/lib/changed-file-analyser.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	/** @type {Buffer[]} */
	const chunks = []
	process.stdin.on('data', (chunk) => chunks.push(chunk))
	process.stdin.on('end', () => {
		try {
			const raw = Buffer.concat(chunks).toString('utf8')
			const files = parseStdin(raw)
			const agents = [...decideSpawnSet(files)]
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
