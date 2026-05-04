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
// @ts-check
/** @import { HookEvent } from './lib/types.mjs' */
/** @import { FormatterDescriptor } from './lib/types.mjs' */

import { existsSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { loadConfig } from './lib/config.mjs'
import { runFormatter } from './lib/runners.mjs'

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()

const CONFIG = loadConfig(PROJECT_DIR)

const PRETTIER_EXTS = new Set(CONFIG.prettierExtensions)
const ESLINT_EXTS = new Set(CONFIG.eslintExtensions)

const PRETTIER_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/prettier')
const ESLINT_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/eslint')
const BIOME_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/biome')
const BIOME_CONFIG_PATH = [resolve(PROJECT_DIR, 'biome.json'), resolve(PROJECT_DIR, 'biome.jsonc')]

const BIOME_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx', '.json', '.jsonc'])

const BIOME_AVAILABLE = existsSync(BIOME_BIN) && BIOME_CONFIG_PATH.some((p) => existsSync(p))

/** @type {FormatterDescriptor} */
const PRETTIER_DESCRIPTOR = {
	name: 'prettier',
	bin: PRETTIER_BIN,
	args: (f) => ['--write', '--ignore-unknown', '--log-level', 'warn', f],
}

/** @type {FormatterDescriptor} */
const ESLINT_DESCRIPTOR = {
	name: 'eslint',
	bin: ESLINT_BIN,
	args: (f) => ['--fix', '--no-error-on-unmatched-pattern', f],
	toleratedStatuses: [1],
}

/** @type {FormatterDescriptor} */
const BIOME_DESCRIPTOR = {
	name: 'biome',
	bin: BIOME_BIN,
	args: (f) => ['check', '--write', '--no-errors-on-unmatched-pattern', f],
	warnIfMissing: true,
}

/**
 * Converts a native path to forward-slash separators (no-op on POSIX).
 *
 * @param {string} p
 * @returns {string}
 */
function toPosix(p) {
	return sep === '/' ? p : p.split(sep).join('/')
}

/**
 * Returns true if the relative posix path should be skipped by the formatter.
 *
 * @param {string} rel - Posix-style path relative to PROJECT_DIR.
 * @returns {boolean}
 */
function shouldSkip(rel) {
	if (rel.startsWith('..')) return true
	return CONFIG.skipPrefixes.some((p) => rel.startsWith(p))
}

/**
 * Entry point — reads the Claude Code hook event from stdin, resolves the
 * target file path, guards against skip conditions, and dispatches to the
 * appropriate formatter runner.
 *
 * @returns {Promise<void>}
 */
async function main() {
	let buf = ''
	for await (const chunk of process.stdin) buf += chunk
	if (!buf.trim()) return

	let event
	try {
		event = /** @type {HookEvent} */ (JSON.parse(buf))
	} catch {
		process.stderr.write('unic-format: could not parse hook input as JSON\n')
		return
	}

	const filePath = event?.tool_input?.file_path || event?.tool_input?.notebook_path
	if (!filePath || !existsSync(filePath)) return

	const rel = toPosix(relative(PROJECT_DIR, filePath))
	if (shouldSkip(rel)) return

	const ext = extname(rel).toLowerCase()
	if (!PRETTIER_EXTS.has(ext)) return

	const usesBiome =
		CONFIG.formatter === 'biome' || (CONFIG.formatter === 'auto' && BIOME_AVAILABLE && BIOME_EXTS.has(ext))

	const run = (/** @type {FormatterDescriptor} */ d) => runFormatter(d, filePath, PROJECT_DIR, CONFIG.formatTimeoutMs)
	if (usesBiome) {
		run(BIOME_DESCRIPTOR)
	} else {
		run(PRETTIER_DESCRIPTOR)
		if (ESLINT_EXTS.has(ext)) run(ESLINT_DESCRIPTOR)
	}
}

main()
	.catch((err) =>
		process.stderr.write(`unic-format: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`)
	)
	.finally(() => process.exit(0))
