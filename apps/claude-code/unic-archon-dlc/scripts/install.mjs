#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
//
// Idempotent install hook for unic-archon-dlc.
// Run: node scripts/install.mjs

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { exploreProject } from './lib/explorer.mjs'
import { createTrackerAdapter } from './lib/tracker.mjs'

const PROJECT_ROOT = process.cwd()

// ── 1. Check archon is on PATH ────────────────────────────────────────────────

const archonCheck = spawnSync('archon', ['--version'], { encoding: 'utf8' })
if (archonCheck.status !== 0 || archonCheck.error) {
	process.stderr.write(
		'Error: archon is not installed or not on PATH.\n' +
			'Install Archon first: https://github.com/mikeyobrien/archon\n',
	)
	process.exit(1)
}

// ── 2. Explore existing project state ────────────────────────────────────────

const snapshot = exploreProject(PROJECT_ROOT)

// ── 3. Interactive prompts ────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

/**
 * Prompts the user for input with a default value.
 * Pressing Enter returns the default.
 *
 * @param {string} question
 * @param {string} defaultValue
 * @returns {Promise<string>}
 */
function prompt(question, defaultValue) {
	return new Promise((resolve) => {
		const display = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `
		rl.question(display, (answer) => {
			resolve(answer.trim() || defaultValue)
		})
	})
}

/**
 * Auto-detects the issue tracker from a git remote URL.
 *
 * @param {string | null} remoteUrl
 * @returns {'github' | 'ado' | 'jira' | 'local'}
 */
function detectTrackerFromRemote(remoteUrl) {
	if (!remoteUrl) return 'local'
	if (remoteUrl.includes('github.com')) return 'github'
	if (remoteUrl.includes('dev.azure.com') || remoteUrl.includes('visualstudio.com')) return 'ado'
	if (remoteUrl.includes('atlassian.net') || remoteUrl.includes('atlassian.com')) return 'jira'
	return 'local'
}

process.stdout.write('\n🔧 unic-archon-dlc setup\n\n')

const existingTracker = snapshot.existingConfig?.issueTracker ?? detectTrackerFromRemote(snapshot.gitRemote)
const existingStrategy = snapshot.existingConfig?.branchingStrategy ?? 'gitflow'
const existingE2e = snapshot.existingConfig?.e2eCommand ?? ''

const issueTracker = await prompt(
	'Issue tracker (github | ado | jira | local)',
	existingTracker,
)
const branchingStrategy = await prompt(
	'Branching strategy (gitflow | github-flow)',
	existingStrategy,
)
const e2eCommandRaw = await prompt(
	'E2e test command (leave blank for none)',
	existingE2e,
)

rl.close()

/** @type {import('./lib/config.mjs').DlcConfig} */
const config = {
	issueTracker: /** @type {import('./lib/config.mjs').IssueTracker} */ (issueTracker),
	branchingStrategy: /** @type {import('./lib/config.mjs').BranchingStrategy} */ (branchingStrategy),
	tddMode: snapshot.existingConfig?.tddMode ?? true,
	nyquistValidation: snapshot.existingConfig?.nyquistValidation ?? true,
	slopsquattingGate: snapshot.existingConfig?.slopsquattingGate ?? true,
	modelProfile: snapshot.existingConfig?.modelProfile ?? 'balanced',
	e2eCommand: e2eCommandRaw.length > 0 ? e2eCommandRaw : null,
	labels: snapshot.existingConfig?.labels ?? {
		state: {
			'needs-triage': 'needs-triage',
			'needs-info': 'needs-info',
			'needs-specs': 'needs-specs',
			'ready-for-agent': 'ready-for-agent',
			'ready-for-human': 'ready-for-human',
			resolved: 'resolved',
			closed: 'closed',
			rejected: 'rejected',
		},
		type: {
			feature: 'enhancement',
			bug: 'bug',
		},
		priority: {
			p0: 'critical',
			p1: 'high',
			p2: 'medium',
			p3: 'low',
		},
	},
}

// ── 4. Write config ───────────────────────────────────────────────────────────

const archonDir = join(PROJECT_ROOT, '.archon')
mkdirSync(archonDir, { recursive: true })
const configPath = join(archonDir, 'unic-dlc.config.json')
const configJson = JSON.stringify(config, null, 2)

if (!existsSync(configPath) || readFileSync(configPath, 'utf8') !== configJson) {
	writeFileSync(configPath, configJson, 'utf8')
	process.stdout.write(`✓ Wrote ${configPath}\n`)
} else {
	process.stdout.write(`✓ ${configPath} unchanged\n`)
}

// ── 5. Create tracker adapter for docs ───────────────────────────────────────

const adapter = createTrackerAdapter(config)

// ── 6. Write docs/agents/ files ──────────────────────────────────────────────

const docsAgentsDir = join(PROJECT_ROOT, 'docs', 'agents')
mkdirSync(docsAgentsDir, { recursive: true })

/**
 * Writes a file only when content has changed (idempotent).
 * @param {string} filePath
 * @param {string} content
 */
function writeIfChanged(filePath, content) {
	if (existsSync(filePath) && readFileSync(filePath, 'utf8') === content) {
		process.stdout.write(`✓ ${filePath} unchanged\n`)
	} else {
		writeFileSync(filePath, content, 'utf8')
		process.stdout.write(`✓ Wrote ${filePath}\n`)
	}
}

const issueTrackerMd = `# Issue Tracker

This project uses **${config.issueTracker}** as its issue tracker backend.

## CLI Commands

- Create issue: \`${adapter.createIssue('<title>', '<body>', ['needs-triage'])}\`
- Update labels: \`${adapter.updateLabels('<id>', ['ready-for-agent'])}\`
- Close issue: \`${adapter.closeIssue('<id>')}\`
- Merge PR: \`${config.issueTracker === 'local' ? '(not applicable for local backend)' : adapter.mergePr('<id>')}\`

## Label States

${Object.entries(config.labels.state)
	.map(([k, v]) => `- \`${k}\` → \`${v}\``)
	.join('\n')}
`

const labelsMd = `# Labels

Three-tier label taxonomy used across all workflows.

## State Labels

${Object.entries(config.labels.state)
	.map(([k, v]) => `| \`${k}\` | \`${v}\` |`)
	.join('\n')}

## Type Labels

${Object.entries(config.labels.type)
	.map(([k, v]) => `| \`${k}\` | \`${v}\` |`)
	.join('\n')}

## Priority Labels

${Object.entries(config.labels.priority)
	.map(([k, v]) => `| \`${k}\` | \`${v}\` |`)
	.join('\n')}
`

const branchingMd = `# Branching Strategy

This project uses **${config.branchingStrategy}**.

${
	config.branchingStrategy === 'gitflow'
		? `## Branch Naming
- Feature: \`feature/<slug>\`
- Hotfix: \`hotfix/<slug>\`
- Release: \`release/<version>\`

## PR Targets
- Feature branches → \`develop\`
- Hotfix branches → \`main\` and \`develop\`
- Release branches → \`main\``
		: `## Branch Naming
- Feature: \`feature/<slug>\`
- Hotfix: \`hotfix/<slug>\`

## PR Targets
- All branches → \`main\``
}
`

const domainMd = `# Domain Documentation

## Context Layout

${
	snapshot.isMultiContext
		? `This is a **multi-context** repository. \`CONTEXT-MAP.md\` at the root describes the domain map.
Individual plugin/package contexts live in per-package \`CONTEXT.md\` files.`
		: `This is a **single-context** repository. The domain model lives in \`CONTEXT.md\` at the project root.`
}

## ADR Location

Architecture Decision Records live under \`docs/adr/\`.
Each ADR captures a key architectural decision with context, decision, and consequences.
`

const workflowMd = `# Workflow Phases

The unic-archon-dlc lifecycle consists of six phases:

| Phase | Workflow | Artifact Outputs |
|-------|----------|-----------------|
| Explore | \`archon run explore\` | \`docs/workflow/<slug>/findings.md\` |
| Plan | \`archon run plan\` | \`docs/workflow/<slug>/PRD.md\`, \`issues.json\`, \`.archon/workflows/build-<slug>.yaml\` |
| Build | \`archon run build-<slug>\` | Code changes, tests |
| QA | \`archon run qa\` | Coverage report, UAT sign-off |
| Cleanup | \`archon run cleanup\` | \`docs/adr/\`, \`docs/workflow/ROADMAP.md\` |
| Triage | \`archon run triage\` | \`docs/workflow/HANDOFF.md\` |
`

writeIfChanged(join(docsAgentsDir, 'issue-tracker.md'), issueTrackerMd)
writeIfChanged(join(docsAgentsDir, 'labels.md'), labelsMd)
writeIfChanged(join(docsAgentsDir, 'branching.md'), branchingMd)
writeIfChanged(join(docsAgentsDir, 'domain.md'), domainMd)
writeIfChanged(join(docsAgentsDir, 'workflow.md'), workflowMd)

// ── 7. Append Agent skills block to CLAUDE.md ─────────────────────────────────

const claudeMdPath = join(PROJECT_ROOT, 'CLAUDE.md')
const agentSkillsBlock = `
## Agent skills

- [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) — Issue tracker backend and CLI commands
- [docs/agents/labels.md](docs/agents/labels.md) — Three-tier label taxonomy
- [docs/agents/branching.md](docs/agents/branching.md) — Branching strategy and PR conventions
- [docs/agents/domain.md](docs/agents/domain.md) — Context layout and ADR paths
- [docs/agents/workflow.md](docs/agents/workflow.md) — Workflow phases and artifact outputs
`

if (existsSync(claudeMdPath)) {
	const claudeMd = readFileSync(claudeMdPath, 'utf8')
	if (!claudeMd.includes('## Agent skills')) {
		writeFileSync(claudeMdPath, claudeMd + agentSkillsBlock, 'utf8')
		process.stdout.write(`✓ Appended Agent skills block to CLAUDE.md\n`)
	} else {
		process.stdout.write(`✓ CLAUDE.md already has Agent skills block\n`)
	}
} else {
	process.stdout.write(`ℹ CLAUDE.md not found — skipping Agent skills block\n`)
}

process.stdout.write('\n✅ unic-archon-dlc setup complete\n\n')
process.stdout.write('Next steps:\n')
process.stdout.write('  archon run explore    # Start with an exploration session\n')
process.stdout.write('  archon run plan       # Or jump straight to planning\n')
