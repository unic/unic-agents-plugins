#!/usr/bin/env node
/**
 * unic-claude-code-format — PostToolUse hook
 * Runs Prettier (and ESLint --fix where applicable) on the file
 * Claude just wrote or edited in the consumer project.
 *
 * Invariants:
 *   - Always exits 0 — never blocks Claude's tool flow.
 *   - Silent on success; diagnostics go to stderr only.
 *   - Defensively skips _bmad/, BMad-installed skills, generated dirs,
 *     and any path outside the consumer project root.
 *   - Does not bundle Prettier/ESLint — uses the consumer's node_modules
 *     so each repo keeps its own pinned versions and configs.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()

// Defensive skip list. Kept in sync with the convention in .prettierignore and
// eslint.config.js so the hook short-circuits before invoking any external tool.
// _bmad/ is intentionally excluded: BMad source is never modified by end-users.
const SKIP_PREFIXES = [
	'_bmad/',
	'.claude/skills/bmad-',
	'.claude/worktrees/',
	'.history/',
	'.git/',
	'node_modules/',
	'dist/',
	'build/',
	'.next/',
	'coverage/',
]

const ALLOWED_PRETTIER_EXT = new Set([
	'.md',
	'.mdx',
	'.json',
	'.jsonc',
	'.yml',
	'.yaml',
	'.js',
	'.mjs',
	'.cjs',
	'.ts',
	'.mts',
	'.cts',
	'.tsx',
	'.feature',
])

const ALLOWED_ESLINT_EXT = new Set([
	'.js',
	'.mjs',
	'.cjs',
	'.ts',
	'.mts',
	'.cts',
	'.tsx',
	'.json',
	'.jsonc',
	'.md',
])

const PRETTIER_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/prettier')
const ESLINT_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/eslint')

function shouldSkip(rel) {
	if (rel.startsWith('..')) return true
	return SKIP_PREFIXES.some((p) => rel.startsWith(p))
}

function runPrettier(filePath) {
	if (!existsSync(PRETTIER_BIN)) return
	const r = spawnSync('node', [PRETTIER_BIN, '--write', '--ignore-unknown', '--log-level', 'warn', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
	})
	if (r.status !== 0) {
		process.stderr.write(`unic-format: prettier failed: ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}

function runEslint(filePath) {
	if (!existsSync(ESLINT_BIN)) return
	const r = spawnSync('node', [ESLINT_BIN, '--fix', '--no-error-on-unmatched-pattern', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
	})
	// Status 1 = lint warnings/errors remain after --fix (not a hook failure).
	// Status >1 = ESLint crash or misconfiguration.
	if (r.status !== 0 && r.status !== 1) {
		process.stderr.write(`unic-format: eslint failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}

async function main() {
	let buf = ''
	for await (const chunk of process.stdin) buf += chunk
	if (!buf.trim()) return

	let event
	try {
		event = JSON.parse(buf)
	} catch {
		process.stderr.write('unic-format: could not parse hook input as JSON\n')
		return
	}

	const filePath = event?.tool_input?.file_path || event?.tool_input?.notebook_path
	if (!filePath || !existsSync(filePath)) return

	const rel = relative(PROJECT_DIR, filePath)
	if (shouldSkip(rel)) return

	const ext = extname(rel).toLowerCase()
	if (!ALLOWED_PRETTIER_EXT.has(ext)) return

	runPrettier(filePath)
	if (ALLOWED_ESLINT_EXT.has(ext)) runEslint(filePath)
}

main()
	.catch((err) => process.stderr.write(`unic-format: unexpected error: ${err?.message || err}\n`))
	.finally(() => process.exit(0))
