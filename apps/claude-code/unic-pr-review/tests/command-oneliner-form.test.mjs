// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Regression guard: env assignments must precede `node` in command-prompt one-liners.
 *
 * IDENT='...' tokens that appear after `node` are positional argv, NOT process.env —
 * they produce undefined reads and silent failures (see issue #227 and AGENTS.md Conventions).
 *
 * Limitation: only detects trailing env on the same line as `node`.
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
	const blocks = /** @type {string[]} */ ([])
	const re = /```sh\n([\s\S]*?)```/g
	let m = re.exec(content)
	while (m !== null) {
		blocks.push(m[1])
		m = re.exec(content)
	}
	return blocks
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
	}
})
