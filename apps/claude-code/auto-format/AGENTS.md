# AGENTS.md — auto-format

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`auto-format` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It registers a `PostToolUse` hook that auto-formats and lints files after `Write` / `Edit` / `MultiEdit` / `NotebookEdit` events. The hook script (`scripts/format-hook.mjs`) uses only Node built-ins and shells out to whichever Formatter the Consumer project has configured locally. See [`CONTEXT.md`](CONTEXT.md) for the domain vocabulary (Format Hook, Formatter, Consumer).

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

Plugin-specific pnpm scripts (run from this directory or with `pnpm --filter auto-format <script>` from the repo root):

```sh
pnpm test                 # run node:test smoke tests
pnpm typecheck            # tsc --checkJs over the hook source
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version         # mirror plugin.json version into marketplace.json + package.json
pnpm tag                  # create the auto-format@<version> git tag locally
pnpm verify:changelog     # check CHANGELOG entry for the current version
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).

## Layout

```tree
.claude-plugin/           # Plugin manifest (plugin.json) and marketplace listing
hooks/                    # Hook registration — wires format-hook.mjs to PostToolUse events
scripts/                  # format-hook.mjs (the hook entrypoint) and helpers
tests/                    # node:test smoke tests for the hook script
docs/                     # Plugin-specific documentation
  adr/                    # Plugin Architecture Decision Records
```

## Plugin doctrines

Load-bearing invariants. These either originate in a Plugin ADR or are policy decisions that are not obvious from the code.

- **The Format Hook always exits zero.** A failing Formatter must never block Claude Code's tool loop. Diagnostics are surfaced via stderr/log files; exit codes are always `0`. See [ADR-0001](docs/adr/0001-hook-always-exits-zero.md).
- **Zero runtime dependencies.** The hook script imports only `node:*` builtins. No bundled formatter, linter, or runtime npm package. See [ADR-0002](docs/adr/0002-zero-runtime-dependencies.md).
- **Consumer owns the Formatters.** The Plugin discovers and invokes whichever formatter binary the Consumer project provides (Prettier, Biome, gofmt, …). It never bundles or installs Formatters. See [ADR-0003](docs/adr/0003-consumer-owns-formatters.md).
- **Per-project config merge.** Format Hook configuration is merged from user-global → project → file-pattern overrides, with project-level overrides winning. See [ADR-0004](docs/adr/0004-per-project-config-merge.md).
- **POSIX path normalisation on Windows.** All paths passed to spawned Formatters are POSIX-normalised so cross-platform Formatters behave consistently. See [ADR-0006](docs/adr/0006-posix-path-normalization-windows.md).
- **`spawnSync` with a timeout and kill signal.** Every Formatter invocation has an upper bound; a runaway Formatter cannot stall Claude Code. See [ADR-0005](docs/adr/0005-spawnsync-timeout-kill-signal.md).

## External dependencies

None. The hook script is pure `node:*`. Formatters themselves are Consumer-provided.

## Do not add

- **Bundled Formatters** (Prettier, ESLint, Biome, …) inside this Plugin — Consumers bring their own. See [ADR-0003](docs/adr/0003-consumer-owns-formatters.md).
- **MCP servers, agents, or sub-agents.** The Format Hook is a deterministic one-shot — no autonomy is warranted.
- **Bash hooks or pre-commit hooks.** Those belong in Consumer repos, not in this Plugin.
- **Blocking Format Hook behaviour.** Any change that lets the hook exit non-zero violates [ADR-0001](docs/adr/0001-hook-always-exits-zero.md).
- **External npm runtime dependencies.** The zero-deps bar is set by [ADR-0002](docs/adr/0002-zero-runtime-dependencies.md) and is the standard for the monorepo.

## Plugin ADRs

Plugin-specific architecture decisions live in [docs/adr/](docs/adr/).

The per-plugin `docs/plans/` directory (where present) is historical — it captured pre-migration specs and is not the intake path for new work. New work enters through the [issue tracker](../../../docs/agents/issue-tracker.md).
