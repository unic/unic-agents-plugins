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
import { existsSync, readFileSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()

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

function loadProjectConfig() {
	const configPath = resolve(PROJECT_DIR, '.claude/unic-format.json')
	if (!existsSync(configPath)) return DEFAULTS
	try {
		const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
		const raw = Number(cfg.formatTimeoutMs)
		const VALID_FORMATTERS = new Set(['auto', 'prettier', 'biome'])
		const hasFullReplacement = Array.isArray(cfg.skipPrefixes) && cfg.skipPrefixes.length > 0
		const hasAdditive = Array.isArray(cfg.additionalSkipPrefixes) && cfg.additionalSkipPrefixes.length > 0
		return {
			skipPrefixes: hasFullReplacement
				? cfg.skipPrefixes
				: hasAdditive
					? [...DEFAULTS.skipPrefixes, ...cfg.additionalSkipPrefixes]
					: DEFAULTS.skipPrefixes,
			prettierExtensions: Array.isArray(cfg.prettierExtensions) ? cfg.prettierExtensions : DEFAULTS.prettierExtensions,
			eslintExtensions: Array.isArray(cfg.eslintExtensions) ? cfg.eslintExtensions : DEFAULTS.eslintExtensions,
			formatTimeoutMs: Number.isFinite(raw) ? Math.min(Math.max(raw, 1_000), 120_000) : DEFAULTS.formatTimeoutMs,
			formatter: VALID_FORMATTERS.has(cfg.formatter) ? cfg.formatter : DEFAULTS.formatter,
		}
	} catch (err) {
		process.stderr.write(`unic-format: ignoring malformed .claude/unic-format.json: ${err.message}\n`)
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

const BIOME_AVAILABLE =
	existsSync(BIOME_BIN) && BIOME_CONFIG_PATH.some((p) => existsSync(p))

function toPosix(p) {
	return sep === '/' ? p : p.split(sep).join('/')
}

function shouldSkip(rel) {
	if (rel.startsWith('..')) return true
	return CONFIG.skipPrefixes.some((p) => rel.startsWith(p))
}

function runPrettier(filePath) {
	if (!existsSync(PRETTIER_BIN)) return
	const r = spawnSync('node', [PRETTIER_BIN, '--write', '--ignore-unknown', '--log-level', 'warn', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
		timeout: CONFIG.formatTimeoutMs,
		killSignal: 'SIGTERM',
	})
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: prettier timed out after ${CONFIG.formatTimeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	if (r.status !== 0) {
		process.stderr.write(`unic-format: prettier failed: ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}

function runEslint(filePath) {
	if (!existsSync(ESLINT_BIN)) return
	const r = spawnSync('node', [ESLINT_BIN, '--fix', '--no-error-on-unmatched-pattern', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
		timeout: CONFIG.formatTimeoutMs,
		killSignal: 'SIGTERM',
	})
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: eslint timed out after ${CONFIG.formatTimeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	// Status 1 = lint warnings/errors remain after --fix (not a hook failure).
	// Status >1 = ESLint crash or misconfiguration.
	if (r.status !== 0 && r.status !== 1) {
		process.stderr.write(`unic-format: eslint failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}

function runBiome(filePath) {
	if (!existsSync(BIOME_BIN)) {
		process.stderr.write(`unic-format: biome binary not found at ${BIOME_BIN}\n`)
		return
	}
	const r = spawnSync(
		'node',
		[BIOME_BIN, 'check', '--write', '--no-errors-on-unmatched-pattern', filePath],
		{
			cwd: PROJECT_DIR,
			stdio: ['ignore', 'ignore', 'pipe'],
			timeout: CONFIG.formatTimeoutMs,
			killSignal: 'SIGTERM',
		},
	)
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: biome timed out after ${CONFIG.formatTimeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	if (r.status !== 0) {
		process.stderr.write(`unic-format: biome failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`)
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

	const rel = toPosix(relative(PROJECT_DIR, filePath))
	if (shouldSkip(rel)) return

	const ext = extname(rel).toLowerCase()
	if (!PRETTIER_EXTS.has(ext)) return

	const usesBiome =
		CONFIG.formatter === 'biome' ||
		(CONFIG.formatter === 'auto' && BIOME_AVAILABLE && BIOME_EXTS.has(ext))

	if (usesBiome) {
		runBiome(filePath)
	} else {
		runPrettier(filePath)
		if (ESLINT_EXTS.has(ext)) runEslint(filePath)
	}
}

main()
	.catch((err) => process.stderr.write(`unic-format: unexpected error: ${err?.message || err}\n`))
	.finally(() => process.exit(0))
