# AGENTS.md — unic-archon-dlc

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-archon-dlc` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It scaffolds an Archon-powered AI development lifecycle — six workflow DAGs (`explore`, `plan`, `build`, `qa`, `cleanup`, `triage`) plus agent-skill docs — into any Consumer project. Configuration is performed once via the `/unic-archon-dlc:setup` slash command. See [`CONTEXT.md`](CONTEXT.md) for the domain vocabulary (Session, Slug, PRD, Findings, Issues JSON, Nyquist map, yaml-gen, Setup).

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
commands/                 # Claude Code slash command definitions — only setup.md today
lib/                      # Pure helper modules consumed by the setup command (ESM, // @ts-check)
test/                     # node:test suites covering lib/ and command behaviour
CONTEXT.md                # Domain vocabulary for the Archon-powered AI development lifecycle
docs/                     # Plugin-specific documentation
  adr/                    # Plugin Architecture Decision Records
```

## Plugin doctrines

Load-bearing invariants. These either originate in a Plugin ADR or are policy decisions that are not obvious from the code.

- **Setup is the sole entry point and is idempotent.** The `/unic-archon-dlc:setup` slash command is the one and only user-facing surface. Re-running it on a fully configured Consumer prints the current config; on a partial config it asks only for missing fields; on a fresh project it prompts for everything. See [ADR-0001](docs/adr/0001-setup-as-slash-command.md).
- **Session is scoped by Slug.** Every Session artefact (Findings, PRD, Issues JSON, `build-<slug>.yaml`) is keyed by a single Slug. No cross-Session bleed. See [CONTEXT.md](CONTEXT.md).
- **HANDOFF.md and ROADMAP.md are written exclusively by the triage workflow.** No other node, command, or workflow may write either file. Human-written content outside the `<!-- unic-archon-dlc:begin/end -->` markers in `ROADMAP.md` is never overwritten.
- **The `## Agent skills` block in a Consumer's `CLAUDE.md` is auto-managed.** Setup writes content between `<!-- unic-archon-dlc:begin -->` and `<!-- unic-archon-dlc:end -->` markers. Everything outside the markers is preserved verbatim across re-runs.
- **Slopcheck before build.** Every new package referenced in `package.json` is verified against the npm registry before any `code-red`/`code-green` node runs. Packages that fail are flagged `[ASSUMED]` and require explicit human approval.
- **Nyquist map gates yaml-gen.** Every issue in Issues JSON must carry a `test_command` before the `yaml-gen` node generates `.archon/workflows/build-<slug>.yaml`.
- **Dogfooding note.** This monorepo has had Setup run against it; the generated artefacts live under [`docs/agents/`](../../../docs/agents/) at the repo root and are managed by the marker-delimited block in the root [`AGENTS.md`](../../../AGENTS.md). Those files describe the target workflow and should be treated as the canonical agent guidance for this repo, not as a current-practice snapshot.

## External dependencies

- **Archon workflow engine, version ≥ 0.10**, present in the Consumer project. Setup verifies this before writing any artefacts.

## Do not add

- **Parallel-runner support before the linear path is operational.** The current happy path runs one Session at a time. Until that is rock-solid in real Consumers, do not add parallel-Session orchestration.
- **Per-plugin variants of the Slug scheme.** Slug is monorepo-wide vocabulary; do not introduce a Plugin-specific Slug format.
- **Consumer-side opt-out flags for individual workflow phases.** Until a real Consumer asks for it with a concrete use case, all six phases (`explore`, `plan`, `build`, `qa`, `cleanup`, `triage`) ship as one bundle.
- **Direct edits to `HANDOFF.md` / `ROADMAP.md` from any non-triage node.** See doctrines above.

## Plugin ADRs

Plugin-specific architecture decisions live in [docs/adr/](docs/adr/).

The per-plugin `docs/plans/` directory (where present) is historical — it captured pre-migration specs and is not the intake path for new work. New work enters through the [issue tracker](../../../docs/agents/issue-tracker.md); the seven workflow phases are documented under [root docs/process/](../../../docs/process/) and [root docs/agents/workflow.md](../../../docs/agents/workflow.md).
