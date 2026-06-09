// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Regression guard for the issue #227 env-vs-argv defect class in command-prompt one-liners.
 *
 * Two rules, both rooted in the same trap — getting `process.env` vs `process.argv` wrong:
 *
 *  1. Env assignments must precede `node`. `IDENT='...'` tokens after `node` are positional
 *     argv, NOT process.env — they produce undefined reads and silent failures.
 *  2. Inline `node -e`/`--eval` blocks must not read `process.argv`. Inline eval has no
 *     script-path slot, so the first user arg lands at `process.argv[1]`, not `[2]` — the
 *     exact bug that shipped on the Step 1.13 state-dir one-liner. Pass data via env
 *     (vars-before-node) or extract to a tested `scripts/lib/*.mjs` file (where argv works).
 *
 * See issue #227 and AGENTS.md Conventions.
 *
 * Limitation (rule 1 only): trailing env is detected only on the same line as `node`.
 * A multi-line sh block where an env var trails the closing `"` on a separate line is not caught here.
 */

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const COMMANDS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../commands')

/**
 * Extract all fenced `sh` code blocks from a markdown string.
 * @param {string} content
 * @returns {string[]}
 */
function extractShBlocks(content) {
	return [...content.matchAll(/```sh\n([\s\S]*?)```/g)].map((m) => m[1])
}

/**
 * Strip single-line quoted strings so IDENT= inside inline scripts
 * (e.g. `node -e "const FOO='bar'"`) don't trigger false positives.
 * @param {string} line
 * @returns {string}
 */
function stripQuotedStrings(line) {
	let s = line.replace(/"[^"]*"/g, '""')
	s = s.replace(/'[^']*'/g, "''")
	return s
}

/**
 * Return the first IDENT= token found after `node` on the line, or null.
 * Uppercase identifiers only — node flags like --input-type=module are lowercase.
 * @param {string} line
 * @returns {string | null}
 */
function trailingEnvAssignment(line) {
	const stripped = stripQuotedStrings(line)
	const nodeIdx = stripped.search(/\bnode\b/)
	if (nodeIdx === -1) return null
	const afterNode = stripped.slice(nodeIdx + 4)
	const m = afterNode.match(/\s+([A-Z_][A-Z0-9_]*)=/)
	return m ? m[1] : null
}

/**
 * True if a block runs an inline `node -e`/`--eval` AND reads `process.argv`.
 * Inline eval has no script-path argv slot, so positional indices are off-by-one
 * (the first arg is argv[1], not argv[2]) — the issue #227 trap. The `node`+flag
 * detection is line-scoped; `process.argv` is searched across the whole block.
 * @param {string} block
 * @returns {boolean}
 */
function evalBlockReadsArgv(block) {
	const hasInlineEval = /\bnode\b[^\n]*?(?:--eval\b|\s-e\b)/.test(block)
	return hasInlineEval && /process\.argv\b/.test(block)
}

describe('command one-liner env form', () => {
	const files = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'))

	for (const file of files) {
		it(`${file}: no env assignments trail node in sh blocks`, () => {
			const content = readFileSync(join(COMMANDS_DIR, file), 'utf8')
			const violations = /** @type {string[]} */ ([])
			for (const block of extractShBlocks(content)) {
				for (const line of block.split('\n')) {
					const envVar = trailingEnvAssignment(line)
					if (envVar) {
						violations.push(`${envVar}=... trails node in: ${line.trim()}`)
					}
				}
			}
			assert.deepEqual(
				violations,
				[],
				`Env assignments must precede node (see AGENTS.md Conventions):\n${violations.join('\n')}`
			)
		})

		it(`${file}: no inline node -e/--eval block reads process.argv`, () => {
			const content = readFileSync(join(COMMANDS_DIR, file), 'utf8')
			const violations = extractShBlocks(content)
				.filter(evalBlockReadsArgv)
				.map((b) => b.trim())
			assert.deepEqual(
				violations,
				[],
				`Inline node -e/--eval must not read process.argv — pass via env or a tested scripts/lib/*.mjs file (issue #227):\n${violations.join('\n---\n')}`
			)
		})
	}
})
