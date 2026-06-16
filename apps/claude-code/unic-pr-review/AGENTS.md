# AGENTS.md — unic-pr-review

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-pr-review` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It runs an AI-powered PR Review with intent checking against Azure Boards and Jira Work Items, Confidence-scored Findings, and an interactive Approval Loop. See [`CONTEXT.md`](CONTEXT.md) for the domain vocabulary (Plugin, Review, Finding, Confidence, Severity, Intent Brief, Intent Check, Bot Signature, Iteration, Approval Loop, Mode, Provider, Work Item, Notice).

## Where to start

Root docs (monorepo-wide conventions live here — pnpm scripts, Gitflow, SemVer, Conventional Commits, code conventions, LICENSE policy, cross-platform requirement):

- [Root AGENTS.md](../../../AGENTS.md) — source of truth for cross-cutting rules
- [Root CONTEXT.md](../../../CONTEXT.md) — monorepo-wide vocabulary
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) — index of all bounded contexts in the repo
- [Root docs/adr/](../../../docs/adr/) — monorepo-wide architecture decisions
- [Root docs/process/](../../../docs/process/) — process and workflow guides

This Plugin's own decisions:

- [Plugin docs/adr/](docs/adr/) — ADRs 0001–0009 and a README listing them

## Commands

Plugin-specific pnpm scripts (run from this directory or with `pnpm --filter unic-pr-review <script>` from the repo root):

```sh
pnpm test                       # run the doctor unit-test suite via node:test
pnpm typecheck                  # tsc --noEmit over the Plugin's .mjs sources
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version               # mirror plugin.json version into marketplace.json + package.json
pnpm tag                        # create the unic-pr-review@<version> git tag locally
pnpm verify:changelog           # check CHANGELOG entry for the current version
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).

## Layout

```tree
.claude-plugin/          # Plugin manifest (plugin.json) and marketplace listing
agents/                  # Review Aspect prompts, Intent Assessor (intent-assessor.md), Provider agents (ado-fetcher.md, ado-writer.md), and the Re-review Coordinator (re-review-coordinator.md) — only Review Aspects belong in SPAWN_TABLE
commands/                # Claude Code slash command definitions (.md files)
providers/               # Source Platform Provider bundles (ADR-0010)
providers/azure_devops/  # Azure DevOps provider: provider.mjs, manifest.json, fixtures/, tests/
scripts/                 # Node.js implementation (.mjs, // @ts-check, no compilation)
scripts/lib/             # Pure-function library modules
tests/                   # node:test suites (*.test.mjs)
docs/adr/                # Plugin-scoped Architecture Decision Records
```

### Adding a new Review Aspect

Two changes are required — both are mandatory; omitting either causes the agent to be silently never spawned:

1. Create `agents/<name>.md` — the agent prompt following the structure of existing agents.
2. Add an entry to `SPAWN_TABLE` in `scripts/lib/changed-file-analyser.mjs` — the predicate that decides when to spawn it.

> **Important**: The Intent Assessor (`agents/intent-assessor.md`) is **not** a Review Aspect and must **not** be added to `SPAWN_TABLE`. It is spawned by intent presence (`intentBrief` defined **and** skeleton non-empty), not by changed-file categories — see ADR-0011. Adding it to the spawn table would break its spawn semantics.

> **Important**: The Re-review Coordinator (`agents/re-review-coordinator.md`) is also **not** a Review Aspect and must **not** be added to `SPAWN_TABLE`. It is spawned by `review-pr.md` only when `mode == "re-review"` and requires full Thread state as input — not a file-category predicate.

## Plugin doctrines

Load-bearing invariants captured as ADRs. All sixteen must be understood before editing:

- **ADR-0001** — Multi-source intent gathering with shared Atlassian credentials (`.unic-confluence.json` covers both Confluence and Jira)
- **ADR-0002** — Confidence-scored Findings with explicit Severity thresholds (Critical 90-100, Important 80-89, Minor 60-79; drop below 60)
- **ADR-0003** — Interactive Approval Loop as the default write path
- **ADR-0004** — Hard-stop when intent sources are unreachable; empty intent is legitimate
- **ADR-0005** — `az` CLI for Azure DevOps reads/writes; `node:https` (or global `fetch`) for Atlassian
- **ADR-0006** — Iteration state lives in the PR's Bot Signature (hidden `<!-- unic-pr-review:iteration=N -->` Iteration Marker), not on disk; detection keys on the Iteration Marker, never on ADO author identity; `doctor` does not probe `az devops user show`
- **ADR-0007** — Re-review uses a delta diff against the prior reviewed Revision
- **ADR-0008** — Conditional sub-agent spawning by changed-file analysis
- **ADR-0009** — Pre-PR Mode is a peer of the ADO Modes, not a special case
- **ADR-0010** — Provider as a folder bundle (`providers/<name>/`); accepted, landed with issue #148 (ADO first-review preview)
- **ADR-0011** — Intent Assessor is a dedicated agent for live AC verdicts; spawned by intent presence, not changed-file categories; never added to SPAWN_TABLE
- **ADR-0012** — First-review computes a checkout-free merge-base diff (`commonRefCommit→sourceRefCommit`) from ADO commit SHAs, guarded by a remote-URL match; REST diff fallback deferred
- **ADR-0013** — `code-simplifier` runs as a conditional Phase 2 post-pass (zero Critical/Important Phase 1 findings AND ≥3 non-test source files), not in the Phase 1 SPAWN_TABLE; gate is the pure function `shouldRunPhase2()`
- **ADR-0014** — The Approval Loop never deletes its own state directory; cleanup is owned by the `review-pr` orchestrator (Step 1.13), gated on ADO write `success: true`, so a failed write stays resumable
- **ADR-0015** — A surviving state directory + unchanged HEAD triggers a **Write Retry**: the re-run finishes the same Iteration (resumes saved approval state, posts only the Findings/Summary that failed) instead of routing to re-review; dedup is local (per-Finding post outcome persisted in `state.json`)
- **ADR-0016** — Human Threads (neither Iteration Marker nor system `commentType`) are **read-only** review context: surfaced post-fan-out as a Notice (unresolved) and Finding annotations (matched by `filePath`+line), never suppress/down-rank a Finding (Confidence stays the sole filter, ADR-0002), and never written to in any Mode; applies to first-review and re-review (the Coordinator gets them but emits no `threadActions` for them)

## Conventions

- SPDX header `// SPDX-License-Identifier: LGPL-3.0-or-later` on every `.mjs`
- Copyright header `// Copyright © 2026 Unic`
- `// @ts-check` at the top of every `.mjs`; types via JSDoc `@typedef` / `@param`
- Tabs for indentation, single quotes, no semicolons (Biome)
- No external runtime npm dependencies — every ADO read/write goes through `az`, every Atlassian call uses `node:https` or global `fetch`
- Tests use `node:test` + `node:assert/strict`; predicates accept injectable executor / fetch parameters so they are unit-testable without mocking the module system
- **In command-prompt one-liners, env assignments must precede `node`** — `VAR=value node -e "..."` is correct; `node -e "..." VAR=value` makes `VAR` an argv token, not `process.env.VAR`. Enforced by `tests/command-oneliner-form.test.mjs`.

## Clean-slate doctrine

This Plugin takes **no code, no prompts, no fixtures, and no soft dependency** on `apps/claude-code/pr-review/`. That directory is treated as out of scope. Every module is re-derived from the PRD and ADRs.

## Do not add

- External runtime npm dependencies (zero is the bar — the doctor uses only built-ins)
- A `LICENSE` file in this directory; per root AGENTS.md the maintainer manages LICENSE files manually
- Any file outside `apps/claude-code/unic-pr-review/` except the one-line entry in the root `CONTEXT-MAP.md`
