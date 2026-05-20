// @ts-check
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { updateAgentSkillsBlock, writeAgentDocs } from './agent-docs-writer.mjs'
import { loadConfig } from './config-loader.mjs'
import { getDefaultLabels } from './labels-config.mjs'

/**
 * @typedef {import('./tracker-adapter.mjs').TrackerBackend} TrackerBackend
 * @typedef {import('./config-loader.mjs').DlcConfig} DlcConfig
 * @typedef {import('./config-loader.mjs').PrStrategy} PrStrategy
 * @typedef {import('./config-loader.mjs').BranchingStrategy} BranchingStrategy
 */

/**
 * @typedef {{ ok: true, configPath: string, wroteDocs: boolean, wroteClaudeMd: boolean }} RunInstallOk
 * @typedef {{ ok: false, stage: 'validate' | 'config' | 'docs' | 'claude-md', message: string }} RunInstallFail
 * @typedef {RunInstallOk | RunInstallFail} RunInstallResult
 */

/** @type {Record<string, unknown>} */
const DEFAULTS = {
	model_profile: 'balanced',
	tdd_mode: true,
	nyquist_validation: true,
	slopsquatting_gate: true,
}

/**
 * @param {string} projectDir
 * @returns {string}
 */
export function detectRepoLayout(projectDir) {
	return existsSync(join(projectDir, 'CONTEXT-MAP.md')) ? 'multi-context' : 'single-context'
}

/**
 * Writes .archon/unic-dlc.config.json, docs/agents/, and the CLAUDE.md Agent skills block.
 * Merge precedence: defaults < existing < partialAnswers.
 * Does not call checkArchon() or prompt — the slash command owns both.
 *
 * @param {string} projectDir
 * @param {Partial<DlcConfig>} [partialAnswers]
 * @returns {RunInstallResult}
 */
export function runInstall(projectDir, partialAnswers = {}) {
	const configPath = join(projectDir, '.archon', 'unic-dlc.config.json')

	let existing = /** @type {Record<string, unknown>} */ ({})
	if (existsSync(configPath)) {
		const loaded = loadConfig(configPath)
		if (!('error' in loaded)) existing = /** @type {Record<string, unknown>} */ (loaded)
	}

	const merged = /** @type {Record<string, unknown>} */ ({
		...DEFAULTS,
		...existing,
		.../** @type {Record<string, unknown>} */ (partialAnswers),
		repo_layout: detectRepoLayout(projectDir),
	})

	const missing = ['tracker', 'pr_strategy', 'branching'].filter((f) => !(f in merged))
	if (missing.length > 0) {
		return { ok: false, stage: 'validate', message: `Missing mandatory fields: ${missing.join(', ')}` }
	}

	merged.labels = getDefaultLabels(/** @type {string} */ (merged.tracker))

	try {
		mkdirSync(join(projectDir, '.archon'), { recursive: true })
		writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`)
	} catch (err) {
		return { ok: false, stage: 'config', message: `Failed to write config: ${/** @type {Error} */ (err).message}` }
	}

	let wroteDocs = false
	try {
		writeAgentDocs(projectDir, {
			tracker: /** @type {TrackerBackend} */ (merged.tracker),
			pr_strategy: /** @type {PrStrategy} */ (merged.pr_strategy),
			branching: /** @type {BranchingStrategy} */ (merged.branching),
			repo_layout: /** @type {string | undefined} */ (merged.repo_layout),
			labels: /** @type {import('./labels-config.mjs').LabelMapping} */ (merged.labels),
		})
		wroteDocs = true
	} catch (err) {
		return { ok: false, stage: 'docs', message: `Failed to write docs/agents/: ${/** @type {Error} */ (err).message}` }
	}

	let wroteClaudeMd = false
	try {
		updateAgentSkillsBlock(projectDir)
		wroteClaudeMd = true
	} catch (err) {
		return {
			ok: false,
			stage: 'claude-md',
			message: `Failed to update CLAUDE.md: ${/** @type {Error} */ (err).message}`,
		}
	}

	return { ok: true, configPath, wroteDocs, wroteClaudeMd }
}
