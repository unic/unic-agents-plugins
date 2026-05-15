# unic-archon-dlc — Product Requirements

## Overview

**Problem**: Development teams using AI coding agents lack a structured, repeatable lifecycle that takes a feature from raw idea all the way to shipped code with human approval gates at every critical decision point. Existing approaches either own the entire process rigidly (GSD, BMAD) or are fully manual sequences of composable skills (Matt Pocock's skills repo). Neither fits teams that want Archon's DAG execution engine — with its parallel nodes, loop primitives, and interactive gates — while preserving deliberate human checkpoints and a clean separation between transient workflow state and persistent project artifacts.

**Solution**: `unic-archon-dlc` is a Claude Code plugin that installs into any project and scaffolds six Archon workflows covering the full development lifecycle: **explore**, **plan**, **build**, **qa**, **cleanup**, and **triage**. Each workflow is a YAML DAG file consumable by the Archon runtime. Human approval gates (`interactive: true` nodes) are placed at every phase boundary where human judgement adds irreplaceable value.

**Branch**: `ralph/unic-archon-dlc`

---

## Goals & Success

### Primary Goal

Ship an installable Claude Code plugin that gives any team a complete, Archon-powered AI development lifecycle in six composable YAML workflows, with human approval gates at every phase boundary and zero external runtime dependencies.

### Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Workflows shipped | 6 (explore, plan, build, qa, cleanup, triage) | File existence checks |
| Tested modules | 4 (config, explorer, tracker adapter, dep-tree+yaml-gen) | `pnpm test` pass |
| Install hook coverage | All mandatory config fields + 5 docs/agents/ files | Manual install dry-run |
| Type check | Zero errors | `pnpm typecheck` |

### Non-Goals (Out of Scope)

- Visual Archon workflow builder UI — YAML files are the authoring format
- Linear integration — GitHub Issues, ADO, Jira, and local markdown are the supported backends for v1
- Managed/hosted version of the workflows — self-hosted in the target project
- Automatic promotion of issues through states without human approval
- A `ralph`-style loop runner for this plugin — Archon runtime is the execution engine
- Command file prompt translations outside English
- GSD's 6-pillar UI contract phase — separate command if needed later
- Cross-AI execution delegation
- LICENSE file management — maintainer adds these manually per monorepo convention

---

## User & Context

### Target User

- **Who**: Developers using Claude Code with Archon installed in their project
- **Role**: Feature owner who wants AI to accelerate implementation without losing control
- **Current Pain**: No structured lifecycle; AI work is ad-hoc, human checkpoints are manual and easily skipped, post-merge entropy is never addressed

### User Journey

1. **Trigger**: Developer installs `unic-archon-dlc` from the Claude Code plugin marketplace
2. **Action**: Runs the install hook → answers 3 questions → config + docs/agents/ files are written → runs `archon run explore` (or skips to `plan`)
3. **Outcome**: A feature moves from raw idea → PRD → dependency-mapped issues → TDD implementation → QA sign-off → merged, documented, and triaged

---

## UX Requirements

### Interaction Model

CLI-first. All workflows are invoked via `archon run <workflow-name>`. The install hook is an interactive Node.js script. Human gates pause execution and wait for terminal input before continuing.

### States to Handle

| State | Description | Behavior |
|-------|-------------|----------|
| Not configured | `.archon/unic-dlc.config.json` absent | Install hook guides through setup |
| Partial config | Config exists but missing optional fields | Hook shows existing values, skips already-set |
| Archon missing | `archon` not on PATH | Install hook surfaces clear error before any prompt |
| Slopcheck missing | `slopcheck` not on PATH | `slopcheck` node marks all new packages `[ASSUMED]` and creates human checkpoint |
| Stall detected | Issue count unchanged between plan-checker iterations | Immediate escalation to human gate (not burn all retries) |
| E2e not configured | `e2eCommand` is null | `qa` workflow skips e2e with warning, still runs coverage-gate |

---

## Technical Context

### Patterns to Follow

- **Plugin structure**: `apps/claude-code/auto-format/` and `apps/claude-code/pr-review/` — exact directory layout, file naming, package.json shape
- **Plugin.json schema**: `apps/claude-code/auto-format/.claude-plugin/plugin.json` — name, version, author, license LGPL-3.0-or-later
- **Test pattern**: `apps/claude-code/pr-review/tests/parse-signature.test.mjs` — `node:test` + `node:assert/strict`, `describe`/`it` blocks, fixture JSON files in `tests/fixtures/`
- **Config/errors pattern**: `packages/release-tools/scripts/lib/errors.mjs` + `scripts/verify-changelog.mjs` — structured `{ ok: true, value }` / `{ ok: false, errors: string[] }` result types
- **Release scripts**: `packages/release-tools/` — `unic-bump`, `unic-sync-version`, `unic-tag`, `unic-verify-changelog` binaries wired via package.json scripts
- **Hook pattern**: `apps/claude-code/auto-format/hooks/hooks.json` — hook registration manifest, `${CLAUDE_PLUGIN_ROOT}` root reference
- **Command pattern**: `apps/claude-code/pr-review/commands/review-pr.md` — YAML frontmatter (allowed-tools, argument-hint, description), markdown instruction body

### Types & Interfaces

```javascript
// @ts-check
// scripts/lib/config.mjs

/**
 * @typedef {'github' | 'ado' | 'jira' | 'local'} IssueTracker
 * @typedef {'gitflow' | 'github-flow'} BranchingStrategy
 * @typedef {'balanced' | 'fast' | 'quality'} ModelProfile
 *
 * @typedef {Object} DlcConfig
 * @property {IssueTracker} issueTracker
 * @property {BranchingStrategy} branchingStrategy
 * @property {boolean} tddMode
 * @property {boolean} nyquistValidation
 * @property {boolean} slopsquattingGate
 * @property {ModelProfile} modelProfile
 * @property {string | null} e2eCommand
 * @property {{ state: Record<string, string>, type: Record<string, string>, priority: Record<string, string> }} labels
 *
 * @typedef {{ ok: true, config: DlcConfig } | { ok: false, errors: string[] }} ConfigResult
 */
```

```javascript
// scripts/lib/explorer.mjs

/**
 * @typedef {Object} ProjectSnapshot
 * @property {string | null} gitRemote
 * @property {boolean} hasClaudeMd
 * @property {boolean} hasContextMd
 * @property {boolean} hasContextMapMd
 * @property {DlcConfig | null} existingConfig
 * @property {boolean} archonInstalled
 * @property {boolean} isMultiContext
 */
```

```javascript
// scripts/lib/dep-tree.mjs

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string[]} blocked_by
 * @property {string} testCommand
 *
 * @typedef {{ ok: true, groups: string[][] } | { ok: false, error: string, cycle: string[] }} DepTreeResult
 */
```

### Architecture Notes

- **State separation (3 layers)**:
  1. Transient workflow state → `$ARTIFACTS_DIR` (Archon native, not committed)
  2. Persistent project artifacts → `docs/workflow/<feature-slug>/` (committed to repo)
  3. Issue/ticket tracking → configured tracker (GitHub Issues, ADO, Jira, local markdown)
- **Persistent artifact layout**: `docs/workflow/ROADMAP.md`, `docs/workflow/<slug>/findings.md`, `PRD.md`, `issues.json`, `report.md`, `arch-review.md`
- **Dynamic parallelisation**: `to-issues` → `issues.json` → `yaml-gen` bash node → `build-<slug>.yaml` at runtime; the build YAML is never shipped, always generated
- **Archon hard dependency**: install hook verifies `archon` on PATH; clear error if absent
- **Distribution via Claude Code plugin marketplace**: workflows delivered as plugin; install hook scaffolds them into target project's `.archon/workflows/`
- **Cross-platform**: use `node:fs`, `node:path`, `node:os`, `node:child_process` only — no shell commands in core modules
- **Install hook**: `scripts/install.mjs`, ESM, zero external deps, idempotent, writes `.archon/unic-dlc.config.json` + `docs/agents/` 5-file set
- **Docs/agents/ files written**: `issue-tracker.md`, `labels.md`, `branching.md`, `domain.md`, `workflow.md`
- **Plugin root**: `apps/claude-code/unic-archon-dlc/`
- **Archon workflows ship under**: `apps/claude-code/unic-archon-dlc/.archon/workflows/`
- **Archon commands ship under**: `apps/claude-code/unic-archon-dlc/.archon/commands/`

---

## User Stories (52 from PRD)

The full user stories from the original PRD are preserved below, grouped by domain. These map to the implementation stories in the section that follows.

**Setup (US-PRD-1–10)**: Idempotent install hook, auto-detect issue tracker from git remote, skip e2e during install, accumulative setup, single/multi-context detection, configurable label taxonomy, issue type and priority labels, Gitflow vs GitHub Flow choice, docs/agents/ directory, CLAUDE.md Agent skills block.

**Explore Workflow (US-PRD-11–16)**: 4 parallel research agents, synthesize node, prototype with VALIDATED/INVALIDATED/PARTIAL verdicts, code-preserve interactive gate, `findings.md` committed to docs/workflow/, spike ticket creation.

**Plan Workflow (US-PRD-17–28)**: CONTEXT.md + ADR loading, adversarial grill-with-docs interview, live ADR writing, to-prd synthesis, first human PR gate, to-issues decomposition with validation, nyquist-map, plan-checker loop (max 3 iterations + stall detection), yaml-gen bash node, second human PR gate.

**Build Workflow (US-PRD-29–37)**: code-red before code-green enforced by DAG, parallel nodes for independent issues, slopcheck bash node with [ASSUMED] tagging, verification node (tests + coverage + stubs + wiring), goals-check node (PRD acceptance matrix), report.md node, human PR gate, self-contained review command.

**QA Workflow (US-PRD-38–41)**: e2e first, coverage-gate bash node, uat-gate interactive node, merge via tracker CLI.

**Cleanup Workflow (US-PRD-42–45)**: arch-review (PRD + report + codebase), adr-consolidation with per-ADR gate, triage node, ROADMAP.md update.

**Triage Workflow (US-PRD-46–47)**: Standalone triage, HANDOFF.md output.

**Documentation (US-PRD-48–52)**: Mermaid diagram, node reference table, quick-start (3 steps), config reference, docs/workflow/ layout.

---

## Implementation Summary

### Story Overview

| ID | Title | Priority | Dependencies |
|----|-------|----------|--------------|
| US-001 | Plugin scaffold | 1 | — |
| US-002 | Config module | 2 | US-001 |
| US-003 | Setup explorer | 3 | US-001 |
| US-004 | Dep-tree builder | 4 | US-001 |
| US-005 | Tracker adapter | 5 | US-002 |
| US-006 | YAML generator | 6 | US-004 |
| US-007 | Install hook | 7 | US-002, US-003, US-005 |
| US-008 | Explore workflow | 8 | US-001 |
| US-009 | Plan workflow | 9 | US-006 |
| US-010 | Build workflow template | 10 | US-006 |
| US-011 | QA workflow | 11 | US-001 |
| US-012 | Cleanup workflow | 12 | US-001 |
| US-013 | Triage workflow | 13 | US-001 |
| US-014 | Review command | 14 | US-001 |
| US-015 | README documentation | 15 | US-008 through US-014 |
| US-016 | Version bump + CHANGELOG | 16 | US-015, US-007 |

### Dependency Graph

```
US-001 (scaffold)
  ├── US-002 (config) ──────┐
  │     └── US-005 (tracker)──┤
  ├── US-003 (explorer) ────┤
  │                         └── US-007 (install hook)
  ├── US-004 (dep-tree)                               │
  │     └── US-006 (yaml-gen) ──┬── US-009 (plan)    │
  │                              └── US-010 (build)   │
  ├── US-008 (explore) ──────────────────────────────┐│
  ├── US-011 (qa) ───────────────────────────────────┤│
  ├── US-012 (cleanup) ──────────────────────────────┤│
  ├── US-013 (triage) ───────────────────────────────┤│
  └── US-014 (review cmd) ───────────────────────────┘│
                                                       │
  US-015 (README) ◄─── all above ────────────────────┘
    └── US-016 (release) ◄── US-007
```

---

## Validation Requirements

Every story must pass before moving to the next:

- [ ] Type-check: `pnpm --filter unic-archon-dlc typecheck`
- [ ] Tests: `pnpm --filter unic-archon-dlc test`
- [ ] Format: `pnpm check`
- [ ] Changelog (final story): `pnpm --filter unic-archon-dlc verify:changelog`

---

*Generated: 2026-05-15T00:00:00.000Z*
