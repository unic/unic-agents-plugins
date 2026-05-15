#!/usr/bin/env node

// @ts-check
/**
 * unic-archon-dlc install hook
 *
 * Run in target project: node ${CLAUDE_PLUGIN_ROOT}/hooks/install.mjs
 * Re-run to fill in missing config: same command
 * Force reconfiguration:           node ${CLAUDE_PLUGIN_ROOT}/hooks/install.mjs --reconfigure
 *
 * Requires: archon on PATH. See README for installation.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { loadConfig } from '../lib/config-loader.mjs'
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

/**
 * @param {string} tracker
 * @returns {string}
 */
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

/** @type {Record<string, { create: string; update: string }>} */
const CLI_MAP = {
	github: {
		create: 'gh issue create --title "<title>" --label "<label>"',
		update: 'gh issue edit <number> --add-label "<label>"',
	},
	ado: {
		create: 'az boards work-item create --title "<title>" --type Bug',
		update: 'az boards work-item update --id <id> --fields "System.Tags=<label>"',
	},
	jira: {
		create: 'jira issue create --project <KEY> --summary "<title>"',
		update: 'jira issue edit <KEY>-<number> --custom label:"<label>"',
	},
	'local-markdown': {
		create: 'Create docs/issues/<slug>/index.md with Status: needs-triage',
		update: 'Edit Status: line in docs/issues/<slug>/index.md',
	},
}

/**
 * @param {string} projectDir
 * @param {{ tracker: string; pr_strategy: string; branching: string }} config
 */
function writeIssueTrackerDoc(projectDir, config) {
	mkdirSync(join(projectDir, 'docs', 'agents'), { recursive: true })

	const cli = CLI_MAP[config.tracker] ?? CLI_MAP['local-markdown']

	const content = `# Issue Tracker: ${config.tracker}

Configured by unic-archon-dlc install hook.

## Backend

**Tracker:** \`${config.tracker}\`
**PR strategy:** \`${config.pr_strategy}\`

## Create a new issue

\`\`\`sh
${cli.create}
\`\`\`

## Update issue state

\`\`\`sh
${cli.update}
\`\`\`

## Conventions

- Issue state is tracked via labels matching the canonical triage vocabulary (see \`docs/agents/labels.md\`).
- Dependency links use the tracker's native "blocked by" field where available; for local-markdown, use a \`## Blocked by\` heading.
- The tracker adapter module (\`lib/tracker-adapter.mjs\`) translates canonical label names to tracker strings at write time.
`

	writeFileSync(join(projectDir, 'docs', 'agents', 'issue-tracker.md'), content)
}

async function main() {
	const projectDir = process.cwd()
	const reconfigure = process.argv.includes('--reconfigure')

	checkArchon()

	const snapshot = await exploreProject(projectDir)
	const configPath = join(projectDir, '.archon', 'unic-dlc.config.json')

	// Load existing config
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

	// --- tracker ---
	let trackerDetected = detectTracker(snapshot.gitRemote)
	if (trackerDetected) {
		console.log(`\nAuto-detected tracker: ${trackerDetected}  (from ${snapshot.gitRemote})`)
		const ans = await rl.question(`Use ${trackerDetected}? [Y/n] `)
		if (ans.trim().toLowerCase() === 'n') trackerDetected = null
	}
	const trackerRaw =
		trackerDetected ?? (await rl.question('\nIssue tracker (github / ado / jira / local-markdown): ')).trim()
	const tracker = trackerRaw || 'local-markdown'

	// --- pr_strategy (deduced) ---
	const prStrategy = deducePrStrategy(tracker)
	console.log(`PR strategy: ${prStrategy}  (deduced from tracker)`)

	// --- branching ---
	const branchRaw = await rl.question('\nBranching strategy [gitflow / github-flow]  (default: gitflow): ')
	const branching = branchRaw.trim() === 'github-flow' ? 'github-flow' : 'gitflow'

	rl.close()

	// Merge with existing; mandatory tier always wins
	const config = { ...existing, tracker, pr_strategy: prStrategy, branching }

	mkdirSync(join(projectDir, '.archon'), { recursive: true })
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
	console.log('\nWrote .archon/unic-dlc.config.json')

	writeIssueTrackerDoc(projectDir, { tracker, pr_strategy: prStrategy, branching })
	console.log('Wrote docs/agents/issue-tracker.md')

	console.log('\nunic-archon-dlc install complete.\n')
}

main().catch((err) => {
	console.error(/** @type {Error} */ (err).message)
	process.exit(1)
})
