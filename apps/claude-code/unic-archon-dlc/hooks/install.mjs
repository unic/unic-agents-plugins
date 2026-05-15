#!/usr/bin/env node
// @ts-check
/**
 * unic-archon-dlc install hook
 *
 * Run in target project: node ${CLAUDE_PLUGIN_ROOT}/hooks/install.mjs
 * Re-run to fill in missing config: same command (additive — only fills missing fields)
 * Force reconfiguration:           node ${CLAUDE_PLUGIN_ROOT}/hooks/install.mjs --reconfigure
 *
 * Requires: archon on PATH. See README for installation.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { updateAgentSkillsBlock, writeAgentDocs } from '../lib/agent-docs-writer.mjs'
import { loadConfig } from '../lib/config-loader.mjs'
import { getDefaultLabels } from '../lib/labels-config.mjs'
import { exploreProject } from '../lib/setup-explorer.mjs'

// Populated as schema-incompatible Archon versions are observed
const INCOMPATIBLE_ARCHON_VERSIONS = /** @type {string[]} */ ([])

/**
 * @param {string | null} remoteUrl
 * @returns {'github' | 'ado' | 'jira' | 'local-markdown' | null}
 */
function detectTracker(remoteUrl) {
	if (!remoteUrl) return null
	if (remoteUrl.includes('github.com')) return 'github'
	if (remoteUrl.includes('dev.azure.com') || remoteUrl.includes('visualstudio.com')) return 'ado'
	return null
}

/** @param {string} tracker */
function deducePrStrategy(tracker) {
	if (tracker === 'github' || tracker === 'ado') return 'squash'
	return 'merge'
}

/** @returns {string} */
function checkArchon() {
	try {
		const version = execFileSync('archon', ['--version'], {
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout: 5000,
		})
			.toString()
			.trim()
		if (INCOMPATIBLE_ARCHON_VERSIONS.includes(version)) {
			console.warn(
				`\nWarning: Archon ${version} has known schema incompatibilities with unic-archon-dlc. Please upgrade Archon.\n`
			)
		}
		return version
	} catch {
		console.error('\nError: archon binary not found on PATH.')
		console.error('Install Archon before using this plugin. See the README for instructions.\n')
		process.exit(1)
	}
}

/**
 * @param {string} projectDir
 * @returns {string}
 */
function detectRepoLayout(projectDir) {
	return existsSync(join(projectDir, 'CONTEXT-MAP.md')) ? 'multi-context' : 'single-context'
}

async function main() {
	const projectDir = process.cwd()
	const reconfigure = process.argv.includes('--reconfigure')

	checkArchon()

	const snapshot = await exploreProject(projectDir)
	const configPath = join(projectDir, '.archon', 'unic-dlc.config.json')

	let existing = /** @type {Record<string, unknown>} */ ({})
	if (snapshot.archonConfigPresent) {
		const loaded = loadConfig(configPath)
		if (!('error' in loaded)) existing = /** @type {Record<string, unknown>} */ (loaded)
	}

	const mandatoryFilled = 'tracker' in existing && 'pr_strategy' in existing && 'branching' in existing

	if (mandatoryFilled && !reconfigure) {
		console.log('\nunic-archon-dlc is already configured:')
		console.log(`  tracker:     ${existing.tracker}`)
		console.log(`  pr_strategy: ${existing.pr_strategy}`)
		console.log(`  branching:   ${existing.branching}`)
		console.log('\nRun with --reconfigure to update these values.\n')
		process.exit(0)
	}

	const rl = createInterface({ input: process.stdin, output: process.stdout })

	// --- mandatory tier ---
	let trackerDetected = detectTracker(snapshot.gitRemote)
	if (trackerDetected) {
		console.log(`\nAuto-detected tracker: ${trackerDetected}  (from ${snapshot.gitRemote})`)
		const ans = await rl.question(`Use ${trackerDetected}? [Y/n] `)
		if (ans.trim().toLowerCase() === 'n') trackerDetected = null
	}
	const trackerRaw =
		trackerDetected ?? (await rl.question('\nIssue tracker (github / ado / jira / local-markdown): ')).trim()
	const tracker = trackerRaw || 'local-markdown'

	const prStrategy = deducePrStrategy(tracker)
	console.log(`PR strategy: ${prStrategy}  (deduced from tracker)`)

	const branchRaw = await rl.question('\nBranching strategy [gitflow / github-flow]  (default: gitflow): ')
	const branching = branchRaw.trim() === 'github-flow' ? 'github-flow' : 'gitflow'

	// --- skippable tier: e2e_command ---
	const e2eRaw = await rl.question('\nE2E test command (leave blank to configure later): ')
	const e2eCommand = e2eRaw.trim() || null

	rl.close()

	// --- multi-context detection ---
	const repoLayout = detectRepoLayout(projectDir)
	if (repoLayout === 'multi-context') {
		console.log('Multi-context repo detected (CONTEXT-MAP.md found).')
	}

	// --- defaulted tier (never prompted unless --reconfigure) ---
	const defaults = {
		model_profile: 'balanced',
		tdd_mode: true,
		nyquist_validation: true,
		slopsquatting_gate: true,
	}

	// --- label tier ---
	const labels = getDefaultLabels(tracker)

	// Merge: defaults < existing < mandatory tier
	const config = {
		...defaults,
		...existing,
		tracker,
		pr_strategy: prStrategy,
		branching,
		e2e_command: e2eCommand,
		repo_layout: repoLayout,
		labels,
	}

	mkdirSync(join(projectDir, '.archon'), { recursive: true })
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
	console.log('\nWrote .archon/unic-dlc.config.json')

	writeAgentDocs(projectDir, {
		tracker,
		pr_strategy: prStrategy,
		branching,
		repo_layout: repoLayout,
		labels,
	})
	console.log('Wrote docs/agents/ (5 files)')

	updateAgentSkillsBlock(projectDir)
	console.log('Updated CLAUDE.md ## Agent skills block')

	console.log('\nunic-archon-dlc install complete.\n')
}

main().catch((err) => {
	console.error(/** @type {Error} */ (err).message)
	process.exit(1)
})
