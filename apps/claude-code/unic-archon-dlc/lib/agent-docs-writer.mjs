// @ts-check
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const AGENT_SKILLS_BEGIN = '<!-- unic-archon-dlc:begin -->'
const AGENT_SKILLS_END = '<!-- unic-archon-dlc:end -->'

const AGENT_SKILLS_LINKS = `- [issue-tracker.md](docs/agents/issue-tracker.md) — issue tracker backend, CLI, create/update conventions
- [labels.md](docs/agents/labels.md) — three-tier label taxonomy: state, type, priority
- [branching.md](docs/agents/branching.md) — branching strategy, branch names, PR targets
- [domain.md](docs/agents/domain.md) — single-context vs multi-context, CONTEXT.md and ADR locations
- [workflow.md](docs/agents/workflow.md) — seven workflow phases, artifact outputs, docs/workflow/ paths`

/**
 * @typedef {import('./labels-config.mjs').LabelMapping} LabelMapping
 * @typedef {import('./tracker-adapter.mjs').TrackerBackend} TrackerBackend
 * @typedef {import('./config-loader.mjs').PrStrategy} PrStrategy
 * @typedef {import('./config-loader.mjs').BranchingStrategy} BranchingStrategy
 */

/**
 * @typedef {Object} AgentDocsConfig
 * @property {TrackerBackend} tracker
 * @property {PrStrategy} pr_strategy
 * @property {BranchingStrategy} branching
 * @property {string} [repo_layout]
 * @property {LabelMapping} labels
 */

/**
 * Write all five docs/agents/*.md files.
 * These files are fully auto-generated; the function overwrites them on each run.
 * @param {string} projectDir
 * @param {AgentDocsConfig} config
 */
export function writeAgentDocs(projectDir, config) {
	const dir = join(projectDir, 'docs', 'agents')
	mkdirSync(dir, { recursive: true })

	writeFileSync(join(dir, 'issue-tracker.md'), buildIssueTrackerDoc(config))
	writeFileSync(join(dir, 'labels.md'), buildLabelsDoc(config))
	writeFileSync(join(dir, 'branching.md'), buildBranchingDoc(config))
	writeFileSync(join(dir, 'domain.md'), buildDomainDoc(config, projectDir))
	writeFileSync(join(dir, 'workflow.md'), buildWorkflowDoc())
}

/**
 * Append or refresh the ## Agent skills block in CLAUDE.md using marker-delimited regions.
 * Does not destroy any content outside the marked block.
 * Creates CLAUDE.md with only the skills block if the file does not yet exist.
 * @param {string} projectDir
 */
export function updateAgentSkillsBlock(projectDir) {
	const claudePath = join(projectDir, 'CLAUDE.md')

	const block = `## Agent skills\n\n${AGENT_SKILLS_BEGIN}\n${AGENT_SKILLS_LINKS}\n${AGENT_SKILLS_END}`

	let content
	try {
		content = readFileSync(claudePath, 'utf8')
	} catch (err) {
		// File absent — create it from scratch.
		if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
			writeFileSync(claudePath, `${block}\n`)
			return
		}
		throw err
	}
	const beginIdx = content.indexOf(AGENT_SKILLS_BEGIN)
	const endIdx = content.indexOf(AGENT_SKILLS_END)

	if (beginIdx !== -1 && endIdx !== -1) {
		// Replace only the content between markers (inclusive)
		content = `${content.slice(0, beginIdx) + AGENT_SKILLS_BEGIN}\n${AGENT_SKILLS_LINKS}\n${content.slice(endIdx)}`
		writeFileSync(claudePath, content)
		return
	}

	// No markers yet — append the full block
	const separator = content.endsWith('\n') ? '\n' : '\n\n'
	writeFileSync(claudePath, `${content + separator + block}\n`)
}

// --- template builders ---

/** @param {AgentDocsConfig} c */
function buildIssueTrackerDoc(c) {
	const cliMap = {
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
			update: 'Edit the Status: line in docs/issues/<slug>/index.md',
		},
	}
	const cli =
		/** @type {Record<string,{create:string;update:string}>} */ (cliMap)[c.tracker] ?? cliMap['local-markdown']

	return `# Issue Tracker: ${c.tracker}

Configured by unic-archon-dlc.

## Backend

**Tracker:** \`${c.tracker}\`
**PR strategy:** \`${c.pr_strategy}\`

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
- Dependency links use the tracker's native "blocked by" field; for local-markdown, use a \`## Blocked by\` heading.
- The tracker adapter (\`lib/tracker-adapter.mjs\`) translates canonical label names to tracker strings at write time.
`
}

/** @param {AgentDocsConfig} c */
function buildLabelsDoc(c) {
	const stateRows = Object.entries(c.labels.state)
		.map(([k, v]) => `| ${k} | ${v} |`)
		.join('\n')
	const typeRows = Object.entries(c.labels.type)
		.map(([k, v]) => `| ${k} | ${v} |`)
		.join('\n')
	const priorityRows = Object.entries(c.labels.priority)
		.map(([k, v]) => `| ${k} | ${v} |`)
		.join('\n')

	return `# Labels

Three-tier taxonomy for \`${c.tracker}\`. Canonical names are used inside workflows; the tracker adapter maps them to tracker strings at write time.

## State labels

| Canonical | Tracker string |
|-----------|---------------|
${stateRows}

## Type labels

| Canonical | Tracker string |
|-----------|---------------|
${typeRows}

## Priority labels

| Canonical | Tracker string |
|-----------|---------------|
${priorityRows}
`
}

/** @param {AgentDocsConfig} c */
function buildBranchingDoc(c) {
	const isGitflow = c.branching === 'gitflow'
	// Both Gitflow and GitHub Flow use 'main' as the production branch by convention
	const mainBranch = 'main'
	const devBranch = isGitflow ? 'develop' : 'main'
	const featurePrefix = 'feature/'
	const prTarget = isGitflow ? 'develop' : 'main'

	return `# Branching Strategy

Configured by unic-archon-dlc.

## Strategy: ${isGitflow ? 'Gitflow' : 'GitHub Flow'}

| Branch type | Pattern | PR target |
|-------------|---------|-----------|
| Production | \`${mainBranch}\` | — |
${isGitflow ? `| Integration | \`${devBranch}\` | — |\n` : ''}| Feature | \`${featurePrefix}<name>\` | \`${prTarget}\` |
${isGitflow ? '| Hotfix | `hotfix/<name>` | `main` + `develop` |' : ''}

## Default branch names

- **Main branch:** \`${mainBranch}\`
${isGitflow ? `- **Integration branch:** \`${devBranch}\`\n` : ''}- **Feature branch prefix:** \`${featurePrefix}\`

## PR conventions

All PRs target \`${prTarget}\`. Merge strategy: \`${c.pr_strategy}\`.
`
}

/**
 * @param {AgentDocsConfig} c
 * @param {string} projectDir
 */
function buildDomainDoc(c, projectDir) {
	const layout = c.repo_layout ?? 'single-context'
	const isMulti = layout === 'multi-context'

	return `# Domain

Configured by unic-archon-dlc.

## Repository layout: ${layout}

${
	isMulti
		? `This repository uses **multi-context** layout. Each package/app has its own \`CONTEXT.md\` file. A \`CONTEXT-MAP.md\` at the repo root maps each context to its location.

- **Context map:** \`${relative(projectDir, join(projectDir, 'CONTEXT-MAP.md'))}\`
- **ADRs:** \`docs/adr/\` (repo-level decisions)`
		: `This repository uses **single-context** layout. One \`CONTEXT.md\` file lives at the repo root.

- **Domain context:** \`CONTEXT.md\`
- **ADRs:** \`docs/adr/\``
}

## How agents use this

Every agent working in this repo should read \`CONTEXT.md\` (and the ADRs in \`docs/adr/\`) before proposing terminology changes or architectural decisions.
`
}

function buildWorkflowDoc() {
	return `# Workflow Phases

unic-archon-dlc ships seven Archon workflow YAML DAGs. The six lifecycle phases below produce persistent artifacts committed to \`docs/workflow/<slug>/\`; the \`review\` workflow is on-demand and posts a single comment on the current PR.

| Phase | Command | Artifact outputs |
|-------|---------|-----------------|
| explore | \`/unic-dlc-explore <slug>\` | \`docs/workflow/<slug>/findings.md\` |
| plan | \`/unic-dlc-plan <slug>\` | \`docs/workflow/<slug>/PRD.md\`, \`issues.json\`, \`build-<slug>.yaml\` |
| build | \`/unic-dlc-build <slug>\` | \`docs/workflow/<slug>/report.md\` |
| qa | \`/unic-dlc-qa <slug>\` | merged PR |
| cleanup | \`/unic-dlc-cleanup <slug>\` | \`docs/workflow/<slug>/arch-review.md\` |
| triage | \`/unic-dlc-triage\` | \`HANDOFF.md\`, \`docs/workflow/ROADMAP.md\` |
| review | \`/unic-dlc-review\` | structured comment on the current PR (idempotent re-runs) |

## State separation

| Layer | Storage | Who owns it |
|-------|---------|-------------|
| Transient workflow state | \`$ARTIFACTS_DIR\` (Archon native) | Archon runtime |
| Persistent project artifacts | \`docs/workflow/<slug>/\` | Committed to repo |
| Issue / ticket tracking | Configured tracker | Tracker backend |
`
}
