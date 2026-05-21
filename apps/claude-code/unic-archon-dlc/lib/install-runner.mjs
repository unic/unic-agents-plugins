// @ts-check
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { updateAgentSkillsBlock, writeAgentDocs } from './agent-docs-writer.mjs'
import { getDefaultLabels } from './labels-config.mjs'

/**
 * @typedef {import('./tracker-adapter.mjs').TrackerBackend} TrackerBackend
 * @typedef {import('./config-loader.mjs').DlcConfig} DlcConfig
 * @typedef {import('./config-loader.mjs').PrStrategy} PrStrategy
 * @typedef {import('./config-loader.mjs').BranchingStrategy} BranchingStrategy
 */

/**
 * @typedef {{ ok: true, configPath: string, workflowsCopied: number, commandsCopied: number }} RunInstallOk
 * @typedef {{ ok: false, stage: 'validate' | 'config' | 'workflows' | 'commands' | 'docs' | 'claude-md', message: string }} RunInstallFail
 * @typedef {RunInstallOk | RunInstallFail} RunInstallResult
 */

/**
 * @param {string | null} remoteUrl
 * @returns {'github' | 'ado' | 'jira' | 'local-markdown' | null}
 */
export function detectTracker(remoteUrl) {
	if (!remoteUrl) return null
	if (remoteUrl.includes('github.com')) return 'github'
	if (remoteUrl.includes('dev.azure.com') || remoteUrl.includes('visualstudio.com')) return 'ado'
	return null
}

/** @param {string} tracker */
export function deducePrStrategy(tracker) {
	if (tracker === 'github' || tracker === 'ado') return 'squash'
	return 'merge'
}

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
 * Writes .archon/unic-dlc.config.json, copies bundled workflows, writes docs/agents/,
 * and updates the CLAUDE.md Agent skills block.
 * Merge precedence: defaults < existing < partialAnswers.
 * Does not call checkArchon() or prompt — the slash command owns both.
 *
 * @param {string} projectDir
 * @param {Partial<DlcConfig>} [partialAnswers]
 * @param {string | null} [pluginRoot] - plugin installation directory; defaults to CLAUDE_PLUGIN_ROOT env var
 * @returns {RunInstallResult}
 */
export function runInstall(projectDir, partialAnswers = {}, pluginRoot = process.env['CLAUDE_PLUGIN_ROOT'] ?? null) {
	const configPath = join(projectDir, '.archon', 'unic-dlc.config.json')

	let existing = /** @type {Record<string, unknown>} */ ({})
	if (existsSync(configPath)) {
		let raw
		try {
			raw = readFileSync(configPath, 'utf8')
		} catch (err) {
			return {
				ok: false,
				stage: 'config',
				message: `Cannot read existing config at ${configPath}: ${/** @type {Error} */ (err).message}`,
			}
		}
		try {
			existing = /** @type {Record<string, unknown>} */ (JSON.parse(raw))
		} catch (err) {
			return {
				ok: false,
				stage: 'config',
				message: `Existing config at ${configPath} contains invalid JSON. Fix or delete the file and re-run setup. Parse error: ${/** @type {Error} */ (err).message}`,
			}
		}
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

	if (!merged.labels) merged.labels = getDefaultLabels(/** @type {string} */ (merged.tracker))

	try {
		mkdirSync(join(projectDir, '.archon'), { recursive: true })
		writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`)
	} catch (err) {
		return { ok: false, stage: 'config', message: `Failed to write config: ${/** @type {Error} */ (err).message}` }
	}

	let workflowsCopied = 0
	let commandsCopied = 0
	if (pluginRoot) {
		const archonAssets =
			/** @type {Array<{ subdir: string, ext: string, stageName: 'workflows' | 'commands', counter: (n: number) => void }>} */ ([
				{
					subdir: 'workflows',
					ext: '.yaml',
					stageName: 'workflows',
					counter: (n) => {
						workflowsCopied = n
					},
				},
				{
					subdir: 'commands',
					ext: '.md',
					stageName: 'commands',
					counter: (n) => {
						commandsCopied = n
					},
				},
			])
		for (const { subdir, ext, stageName, counter } of archonAssets) {
			const srcDir = join(pluginRoot, '.archon', subdir)
			const destDir = join(projectDir, '.archon', subdir)
			try {
				if (existsSync(srcDir)) {
					mkdirSync(destDir, { recursive: true })
					const files = readdirSync(srcDir).filter((f) => f.endsWith(ext))
					for (const file of files) {
						copyFileSync(join(srcDir, file), join(destDir, file))
					}
					counter(files.length)
				}
			} catch (err) {
				return {
					ok: false,
					stage: stageName,
					message: `Config written to ${configPath}. Failed to copy ${subdir}: ${/** @type {Error} */ (err).message}`,
				}
			}
		}
	}

	try {
		writeAgentDocs(projectDir, {
			tracker: /** @type {TrackerBackend} */ (merged.tracker),
			pr_strategy: /** @type {PrStrategy} */ (merged.pr_strategy),
			branching: /** @type {BranchingStrategy} */ (merged.branching),
			repo_layout: /** @type {string | undefined} */ (merged.repo_layout),
			labels: /** @type {import('./labels-config.mjs').LabelMapping} */ (merged.labels),
		})
	} catch (err) {
		return {
			ok: false,
			stage: 'docs',
			message: `Config written to ${configPath}. Failed to write docs/agents/: ${/** @type {Error} */ (err).message}`,
		}
	}

	try {
		updateAgentSkillsBlock(projectDir)
	} catch (err) {
		return {
			ok: false,
			stage: 'claude-md',
			message: `Config and docs written. Failed to update CLAUDE.md: ${/** @type {Error} */ (err).message}`,
		}
	}

	return { ok: true, configPath, workflowsCopied, commandsCopied }
}
