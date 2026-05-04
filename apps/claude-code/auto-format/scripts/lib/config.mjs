// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/** @import { ProjectConfig, FormatterName } from './types.mjs' */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** @type {ProjectConfig} */
export const DEFAULTS = {
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

const VALID_FORMATTERS = new Set(['auto', 'prettier', 'biome'])

/**
 * Reads `.claude/unic-format.json` from `projectDir` and merges it with DEFAULTS.
 * Returns DEFAULTS on missing file or parse error.
 *
 * @param {string} projectDir - Absolute path to the consumer project root.
 * @returns {ProjectConfig}
 */
export function loadConfig(projectDir) {
	const configPath = resolve(projectDir, '.claude/unic-format.json')
	if (!existsSync(configPath)) return DEFAULTS
	try {
		const cfg = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(configPath, 'utf8')))
		const raw = Number(cfg.formatTimeoutMs)
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
			`unic-format: ignoring malformed .claude/unic-format.json: ${err instanceof Error ? err.message : String(err)}\n`
		)
		return DEFAULTS
	}
}
