# AGENTS.md — unic-archon-dlc

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-archon-dlc` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It scaffolds a **thin process layer** for an AI development lifecycle: it owns the _what_ (the box set — main line `/specs` → `/tickets` → `/build` → `/pr-review` → `/qa`; on-ramps `/triage` + `/qa` findings; off-line `/setup`, `/explore`, `/improve-architecture`, `/cleanup`, `/handoff`) and **composes the team's system-skills for the _how_** (tracker/docs/design access). Each box's **container follows its structural need** — Archon workflows for the AFK-isolated legs (`/build`, `/qa`, `/pr-review`, `/explore`), Claude Code commands/skills for the interactive/repo-global ones (the rest, composing Matt Pocock's skills rather than reimplementing them). Configuration is via the `/unic-archon-dlc:setup` slash command. See [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)–[ADR-0018](docs/adr/0018-generic-core-config-compose.md) for the two-axis architecture, [ADR-0014](docs/adr/0014-workflow-per-box-decomposition.md) for the box set, and [`CONTEXT.md`](CONTEXT.md) for the vocabulary.

## Where to start

Root docs (monorepo-wide conventions live here — pnpm scripts, Gitflow, SemVer, Conventional Commits, code conventions, LICENSE policy, cross-platform requirement):

- [Root AGENTS.md](../../../AGENTS.md) — source of truth for cross-cutting rules
- [Root CONTEXT.md](../../../CONTEXT.md) — monorepo-wide vocabulary (Plugin, Workspace Package, Release, Feature, Consumer)
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) — index of all bounded contexts in the repo
- [Root docs/adr/](../../../docs/adr/) — monorepo-wide architecture decisions
- [Root docs/process/](../../../docs/process/) — process and workflow guides

This Plugin's own decisions:

- [Plugin docs/adr/](docs/adr/) — Plugin-specific architecture decisions

## Commands

Plugin-specific pnpm scripts (run from this directory or with `pnpm --filter unic-archon-dlc <script>` from the repo root):

```sh
pnpm test                 # run node:test suite for this Plugin
pnpm typecheck            # tsc --checkJs over this Plugin's .mjs sources
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version         # mirror plugin.json version into marketplace.json + package.json
pnpm tag                  # create the unic-archon-dlc@<version> git tag locally
pnpm verify:changelog     # check CHANGELOG entry for the current version
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).

## Layout

```tree
.archon/                  # Archon assets installed into Consumer projects — workflow YAMLs and command stubs
.claude-plugin/           # Plugin manifest (plugin.json) and marketplace listing
commands/                 # Claude Code slash command / skill definitions (setup + the interactive boxes)
lib/                      # Tested helper modules — tracker-agnostic deterministic IP only (ESM, // @ts-check)
test/                     # node:test suites covering lib/ and command behaviour
CONTEXT.md                # Domain vocabulary for the Archon-powered AI development lifecycle
docs/                     # Plugin-specific documentation
  adr/                    # Plugin Architecture Decision Records
```

## Plugin doctrines

Load-bearing invariants. These either originate in a Plugin ADR or are policy decisions that are not obvious from the code.

- **Setup is the sole configuration entry point — conversational and idempotent.** The `/unic-archon-dlc:setup` slash command is the one user-facing config surface. It conducts the conversation, **composes the team's system-skills** to detect/register their stack, and writes `.archon/unic-dlc.config.yaml`; only a thin tested lib does schema-validate + idempotent merge (a re-run prints/patches, never clobbers). See [ADR-0019](docs/adr/0019-conversational-setup.md) (supersedes [ADR-0001](docs/adr/0001-setup-as-slash-command.md)).
- **The DLC owns the _what_; it composes team system-skills for the _how_.** No box hardcodes a tracker/docs/design system; each reads `.archon/unic-dlc.config.yaml` and composes the configured skill/CLI/MCP (MCP-first, CLI-fallback). See [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md).
- **Container follows structural need.** Archon workflows only for AFK-isolated, no-live-conversation work (`/build`, `/qa`, `/pr-review`, `/explore`); Claude Code commands/skills for interactive or repo-global work, composing Matt's originals. See [ADR-0017](docs/adr/0017-container-follows-structural-need.md).
- **Tested lib only for tracker-agnostic deterministic IP** (slopcheck, stub-detector, issues/PRD schema-validation, thin config validate/merge). Everything tracker/tenant/OS-specific lives in config + composition, never bespoke lib. See [ADR-0018](docs/adr/0018-generic-core-config-compose.md). (`dag-builder` was dissolved by [ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) — `/build` uses a generic loop, not codegen.)
- **Session is scoped by Slug.** Every Session artefact (Findings, PRD, Issues JSON, `build-state.json`, report) is keyed by a single Slug under `<artifacts_dir>/<slug>/`. No cross-Session bleed. See [CONTEXT.md](CONTEXT.md).
- **The issue tracker is the single source of truth for "where are we."** `HANDOFF.md` and `ROADMAP.md` are dropped, and the old state-snapshot `triage` workflow is retired — no workflow writes either file. Per-thread continuity is handled by the `/handoff` command/skill (it compacts the live conversation, so it cannot be an Archon workflow — see [ADR-0017](docs/adr/0017-container-follows-structural-need.md)), which writes a throwaway file, not a durable repo snapshot. See [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md).
- **`/triage` is the intake on-ramp — a thin wrapper over Matt's method, bound to DLC config.** It turns raw work (bugs, requests, QA findings, external PRs) into agent-ready tracker issues feeding `/tickets`. It **composes Matt's `triage` method but injects `classification.labels` from `.archon/unic-dlc.config.yaml` as the single source of truth** and forbids reading Matt's `docs/agents/triage-labels.md` / `issue-tracker.md`, so labels can't drift from what `/tickets` + `/build` read. Consequently `setup-matt-pocock-skills` is **not** a Plugin dependency — only Matt's skill _methods_ are. It writes only to the tracker + `<triage.out_of_scope_dir>` (human present → no PR gate); it produces no `issues.json`/PRD. See [ADR-0024](docs/adr/0024-triage-intake-on-ramp.md).
- **The `## Agent skills` block in a Consumer's `CLAUDE.md` is auto-managed.** Setup writes content between `<!-- unic-archon-dlc:begin -->` and `<!-- unic-archon-dlc:end -->` markers. Everything outside the markers is preserved verbatim across re-runs.
- **Slopcheck before build.** Every new package referenced in `package.json` is verified against the npm registry before any RED/GREEN/REFACTOR phase runs. Packages that fail are flagged `[ASSUMED]` and require explicit human approval.
- **Nyquist map gates the build.** Every issue in Issues JSON must carry a `test_command` (or `test_command_planned`) before `/build` consumes it — the gate runs in `/tickets` ([ADR-0022](docs/adr/0022-tickets-slice-to-build.md)); `/build` reads the build-ready `issues.json` directly ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md)).
- **`/qa` gates on `gates.qa` and fail-closes the merge.** The QA Archon pipeline (e2e → coverage → UAT → verify-pr-base → merge) has two `approval:` gates (UAT + merge), both HITL by default and skipped in AFK; downstream nodes use `trigger_rule: all_done` so AFK auto-merges a clean build, while the merge node's fail-closed `when` blocks auto-merging a red e2e/coverage or a wrong PR base. `/qa` is also an **issue-producing on-ramp**: a UAT rejection files each defect directly as a `ready-for-agent` tracker issue (composing the configured tracker + `classification.labels`, Matt's `qa` brief shape, AI disclaimer) that feeds `/tickets` — it does not just halt. Never `lib/tracker-adapter.mjs` (dissolved). See [ADR-0025](docs/adr/0025-qa-pipeline-onramp.md).
- **Dogfooding note.** This monorepo has had Setup run against it; the generated artefacts live under [`docs/agents/`](../../../docs/agents/) at the repo root and are managed by the marker-delimited block in the root [`AGENTS.md`](../../../AGENTS.md). Those files describe the target two-axis architecture (see [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)–[ADR-0018](docs/adr/0018-generic-core-config-compose.md)) with the tracker as the single source of truth, and should be treated as the canonical agent guidance for this repo, not as a current-practice snapshot.

## External dependencies

- **Archon workflow engine, version ≥ 0.5.0** (the 0.x line churns fast — 0.3.12 → 0.5.0 inside a week; the node schema is the stable contract, not the release number), present in the Consumer project. Setup verifies this before writing any artefacts. Workflows follow the key-discriminated node schema — see [ADR-0011](docs/adr/0011-archon-schema-target.md).

## Do not add

- **Parallel-runner support before the linear path is operational.** The current happy path runs one Session at a time. Until that is rock-solid in real Consumers, do not add parallel-Session orchestration.
- **Per-plugin variants of the Slug scheme.** Slug is monorepo-wide vocabulary; do not introduce a Plugin-specific Slug format.
- **Consumer-side opt-out flags for individual boxes.** Until a real Consumer asks with a concrete use case, the box set ships as one bundle. See [ADR-0014](docs/adr/0014-workflow-per-box-decomposition.md).
- **Hardcoded tracker/tenant/OS specifics, or bespoke lib for what a team system-skill already does.** Read config and compose (MCP-first, CLI-fallback); keep tested lib to tracker-agnostic deterministic IP. See [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) / [ADR-0018](docs/adr/0018-generic-core-config-compose.md).
- **`HANDOFF.md` / `ROADMAP.md` revival, or any workflow that writes durable repo-state snapshots.** The tracker is the single source of truth. See [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md).

## Plugin ADRs

Plugin-specific architecture decisions live in [docs/adr/](docs/adr/).
