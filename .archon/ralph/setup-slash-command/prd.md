# Setup Slash Command — Product Requirements

## Overview

**Problem**: The plugin advertises `/unic-dlc-install` in the README quick-start but no slash command exists. The real entry point is `hooks/install.mjs`, a readline terminal script that Claude Code never auto-executes. Users who install the plugin and try the advertised command get nothing. The hook is also undiscoverable — it requires running `node ${CLAUDE_PLUGIN_ROOT}/hooks/install.mjs` from a terminal, a path documented nowhere in the README.

**Solution**: Ship `commands/setup.md` as the first-class entry point invoked as `/unic-archon-dlc:setup`. Extract the post-prompt write logic into `lib/install-runner.mjs` and the archon preflight into `lib/archon-check.mjs` — both pure, testable, and reused by the slash command. Delete the hook and remove it from `plugin.json`.

**Branch**: `ralph/setup-slash-command`

---

## Goals & Success

### Primary Goal

Replace the undiscoverable readline hook with a proper Claude Code slash command that users can invoke directly from Claude Code after installing the plugin.

### Success Metrics

| Metric               | Target                              | How Measured                                            |
| -------------------- | ----------------------------------- | ------------------------------------------------------- |
| Slash command exists | `/unic-archon-dlc:setup` registered | `commands/setup.md` present + referenced in plugin.json |
| Hook deleted         | `hooks/install.mjs` absent          | File no longer exists                                   |
| Tests pass           | All new lib tests green             | `pnpm --filter unic-archon-dlc test`                    |
| Type-check clean     | Zero JSDoc regressions              | `pnpm typecheck`                                        |
| README accurate      | Quick-start references new command  | Lines 129–136 updated                                   |

### Non-Goals (Out of Scope)

- Migrating `.archon/commands/*` to Claude Code slash commands — separate spec
- Wiring archon preflight into workflow commands — ADR-0001 leaves preflight in setup only
- Non-interactive CLI wrapper around `runInstall()` — trivial to add later if needed
- Changing the slash command name (locked in ADR-0001)
- `.gitignore` changes for `.archon/` — config is team config, presumed committed

---

## User & Context

### Target User

- **Who**: Developer adding unic-archon-dlc to a project for the first time
- **Role**: Team lead or senior dev setting up the AI development lifecycle
- **Current Pain**: Installs the plugin, sees `/unic-dlc-install` in the README, types it in Claude Code, gets nothing. Falls back to reading the README more carefully and finds no terminal path documented.

### User Journey

1. **Trigger**: Developer installs `unic-archon-dlc` via Claude Code plugin marketplace and reads the README quick-start
2. **Action**: Types `/unic-archon-dlc:setup` in Claude Code
3. **Outcome**: Claude conducts a short 3-question configuration conversation, writes `.archon/unic-dlc.config.json`, generates `docs/agents/*.md`, and merges the `## Agent skills` block into `CLAUDE.md`

---

## UX Requirements

### Interaction Model

Slash command with optional argument:

- `/unic-archon-dlc:setup` — detect state; ask only missing fields (fresh: all three; partial: missing ones; full config: print summary and exit)
- `/unic-archon-dlc:setup reconfigure` — re-prompt all three mandatory fields
- `/unic-archon-dlc:setup <free-form intent>` — targeted conversational tweak (e.g. "change branching to github-flow")

### States to Handle

| State               | Description                                | Behavior                                   |
| ------------------- | ------------------------------------------ | ------------------------------------------ |
| Fresh               | No `.archon/unic-dlc.config.json`          | Ask all three mandatory fields             |
| Partial             | Config exists but missing mandatory fields | Ask only missing fields                    |
| Full + no args      | All mandatory fields present               | Print current values, exit without writing |
| Full + reconfigure  | User passed `reconfigure`                  | Re-prompt all three fields, overwrite      |
| Full + free-form    | User passed intent string                  | Conversational targeted tweak              |
| Archon missing      | `archon` not on PATH                       | Friendly error message, no partial writes  |
| Archon incompatible | Known bad version                          | Warning message, proceed                   |

---

## Technical Context

### Patterns to Follow

- **Result-object error handling**: `lib/config-loader.mjs` — returns `{ error, … } | ValidConfig`, never throws for expected failure branches
- **Three-tier merge**: `hooks/install.mjs:145–155` — `{ ...defaults, ...existing, ...partialAnswers }` then labels appended
- **JS module pattern**: `lib/setup-explorer.mjs` — `// @ts-check`, named exports, JSDoc types, no default export
- **Test pattern**: `test/setup-explorer.test.mjs:1–36` — `node:test`, `node:assert/strict`, `tmpdir()` + `Date.now()` isolation, one assertion per behavior
- **Discriminated union test**: check `'error' in result` before destructuring (see `test/config-loader.test.mjs`)

### Types & Interfaces

```javascript
// lib/archon-check.mjs — new result type
/** @typedef {{ ok: true, version: string }} ArchonOk */
/** @typedef {{ ok: false, code: 'enoent' | 'incompatible' | 'other', message: string }} ArchonFail */
/** @typedef {ArchonOk | ArchonFail} ArchonCheckResult */

// lib/install-runner.mjs — new result type
/** @typedef {{ ok: true, configPath: string, wroteDocs: boolean, wroteClaudeMd: boolean }} RunInstallOk */
/** @typedef {{ ok: false, stage: 'validate' | 'config' | 'docs' | 'claude-md', message: string }} RunInstallFail */
/** @typedef {RunInstallOk | RunInstallFail} RunInstallResult */

// Existing types consumed by install-runner
// - TrackerBackend: 'github' | 'ado' | 'jira' | 'local-markdown' (lib/tracker-adapter.mjs)
// - loadConfig(): ValidConfig | { error: string } (lib/config-loader.mjs)
// - getDefaultLabels(tracker): Labels (lib/labels-config.mjs)
// - writeAgentDocs(projectDir, config): void (lib/agent-docs-writer.mjs)
// - updateAgentSkillsBlock(projectDir): void (lib/agent-docs-writer.mjs)
// - exploreProject(projectDir): ProjectSnapshot (lib/setup-explorer.mjs)
```

### Architecture Notes

- `lib/archon-check.mjs` must not call `process.exit()` — returns a result object for every branch including ENOENT
- `lib/install-runner.mjs` must not prompt or call `checkArchon` — the slash command owns both
- Mandatory fields after merge: `tracker`, `pr_strategy`, `branching` — missing any must return `{ ok: false, stage: 'validate', message: … }` not throw
- `repo_layout` detection uses `detectRepoLayout()` from `hooks/install.mjs:73–75` — moves into `install-runner.mjs`
- `detectTracker()` and `deducePrStrategy()` are also in `hooks/install.mjs:30–41` — the slash command calls them directly or they stay in the hook file until it's deleted; copy to install-runner or keep inline in the slash command

---

## Implementation Summary

### Story Overview

| ID     | Title                                                              | Priority | Dependencies   |
| ------ | ------------------------------------------------------------------ | -------- | -------------- |
| US-001 | Create `lib/archon-check.mjs` with result-object API and tests     | 1        | —              |
| US-002 | Create `lib/install-runner.mjs` with `runInstall()` and tests      | 2        | —              |
| US-003 | Create `commands/setup.md` slash command                           | 3        | US-001, US-002 |
| US-004 | Delete `hooks/install.mjs` and remove `"hooks"` from `plugin.json` | 4        | US-003         |
| US-005 | Update `README.md` quick-start and `CHANGELOG.md`                  | 5        | US-003         |

### Dependency Graph

```
US-001 (archon-check lib + tests)
    ↘
      US-003 (commands/setup.md) → US-004 (delete hook) → US-005 (docs)
    ↗
US-002 (install-runner lib + tests)
```

---

## Validation Requirements

Every story must pass:

- [ ] Type-check: `pnpm --filter unic-archon-dlc typecheck`
- [ ] Lint: `pnpm check`
- [ ] Tests: `pnpm --filter unic-archon-dlc test`
- [ ] Format: `pnpm format`

---

_Source spec_: `apps/claude-code/unic-archon-dlc/docs/plans/00-setup-slash-command.md`
_ADR_: `apps/claude-code/unic-archon-dlc/docs/adr/0001-setup-as-slash-command.md`
_Generated_: 2026-05-20T00:00:00Z
