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
/** @import { HookEvent, ProjectConfig, FormatterName } from './lib/types.mjs' */
/** @import { FormatterDescriptor } from './lib/types.mjs' */

import { existsSync, readFileSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { runFormatter } from './lib/runners.mjs'

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()

/** @type {ProjectConfig} */
const DEFAULTS = {
	skipPrefixes: [
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
	],
	prettierExtensions: [
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
	],
	eslintExtensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.json', '.jsonc', '.md'],
	formatTimeoutMs: 30_000,
	formatter: 'auto',
}

/**
 * Reads .claude/unic-format.json from the consumer project root and merges
 * it with DEFAULTS. Returns DEFAULTS on missing file or parse error.
 *
 * @returns {ProjectConfig}
 */
function loadProjectConfig() {
	const configPath = resolve(PROJECT_DIR, '.claude/unic-format.json')
	if (!existsSync(configPath)) return DEFAULTS
	try {
		const cfg = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(configPath, 'utf8')))
		const raw = Number(cfg.formatTimeoutMs)
		const VALID_FORMATTERS = new Set(['auto', 'prettier', 'biome'])
		const hasFullReplacement = Array.isArray(cfg.skipPrefixes) && cfg.skipPrefixes.length > 0
		const hasAdditive = Array.isArray(cfg.additionalSkipPrefixes) && cfg.additionalSkipPrefixes.length > 0
		return {
			skipPrefixes: hasFullReplacement
				? /** @type {string[]} */ (cfg.skipPrefixes)
				: hasAdditive
					? [...DEFAULTS.skipPrefixes, .../** @type {string[]} */ (cfg.additionalSkipPrefixes)]
					: DEFAULTS.skipPrefixes,
			prettierExtensions: Array.isArray(cfg.prettierExtensions) ? cfg.prettierExtensions : DEFAULTS.prettierExtensions,
			eslintExtensions: Array.isArray(cfg.eslintExtensions) ? cfg.eslintExtensions : DEFAULTS.eslintExtensions,
			formatTimeoutMs: Number.isFinite(raw) ? Math.min(Math.max(raw, 1_000), 120_000) : DEFAULTS.formatTimeoutMs,
			formatter: /** @type {FormatterName} */ (
				VALID_FORMATTERS.has(/** @type {string} */ (cfg.formatter)) ? cfg.formatter : DEFAULTS.formatter
			),
		}
	} catch (err) {
		process.stderr.write(
			`unic-format: ignoring malformed .claude/unic-format.json: ${/** @type {Error} */ (err).message}\n`
		)
		return DEFAULTS
	}
}

const CONFIG = loadProjectConfig()

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
