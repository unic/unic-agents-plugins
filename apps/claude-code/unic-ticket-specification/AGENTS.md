# AGENTS.md — unic-ticket-specification

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-ticket-specification` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It packages a **portable Archon workflow** that takes a tracker ticket from intake to "ready for implementation": detect input → analyse (across all configured repos + linked docs) → classify Bug vs Change-Request/Story → rewrite to the configured template → non-blocking completeness check → PERT estimate → persist locally → human approval gate → write back to the tracker → report. It is tracker-agnostic (Jira, Azure DevOps, GitHub), multi-repo, and OS-independent (Windows / macOS). See [`CONTEXT.md`](CONTEXT.md) for the domain vocabulary (Ticket reference, Mode, Kind, Per-project config, Analysis, Proposal, Approval gate).

## Where to start

Root docs (monorepo-wide conventions live here — pnpm scripts, Gitflow, SemVer, Conventional Commits, code conventions, LICENSE policy, cross-platform requirement):

- [Root AGENTS.md](../../../AGENTS.md) — source of truth for cross-cutting rules
- [Root CONTEXT.md](../../../CONTEXT.md) — monorepo-wide vocabulary (Plugin, Workspace Package, Release, Feature, Consumer)
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) — index of all bounded contexts in the repo
- [Root docs/adr/](../../../docs/adr/) — monorepo-wide architecture decisions
- [Root docs/process/](../../../docs/process/) — process and workflow guides

This Plugin's own surfaces:

- [`.archon/`](.archon/) — the installable bundle: the workflow DAG, seven command templates, the tracker MCP config, the config template, and the bundle README
- [`.archon/unic-ticket-specification.README.md`](.archon/unic-ticket-specification.README.md) — per-project install + setup instructions
- [`commands/setup.md`](commands/setup.md) — the `/unic-ticket-specification:setup` slash command (zero-config install + configuration)
- [`docs/adr/`](docs/adr/) — Plugin-specific architecture decisions

## Commands

Plugin-specific pnpm scripts (run from this directory or with `pnpm --filter unic-ticket-specification <script>` from the repo root):

```sh
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version               # mirror plugin.json version into marketplace.json + package.json
pnpm tag                        # create the unic-ticket-specification@<version> git tag locally
pnpm verify:changelog           # check CHANGELOG entry for the current version
```

This Plugin ships no JavaScript — it is pure Archon workflow YAML, command markdown, and config templates — so it has no `test` or `typecheck` script. Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).

## Layout

```tree
.archon/                              # The installable bundle — copy into a Consumer's .archon/ to install
  workflows/
    unic-ticket-specification.yaml    # the DAG
  commands/
    uts-*.md                          # seven Archon command templates rendered inside workflow nodes
  mcp/
    ticket-spec-tracker.json          # tracker MCP server (per project)
  ticket-spec.config.example.yaml     # documented per-project config template (Consumer copies → ticket-spec.config.yaml)
  unic-ticket-specification.README.md # bundle install + setup instructions
.claude-plugin/                       # Plugin manifest (plugin.json) and marketplace listing
commands/                             # Claude Code slash command definitions — only setup.md today
docs/                                 # Plugin-specific documentation
  adr/                                # Plugin Architecture Decision Records
CONTEXT.md                            # Domain vocabulary for ticket specification
```

## Plugin doctrines

Load-bearing invariants. These either originate in a Plugin ADR or are policy decisions that are not obvious from the files.

- **No tracker/tenant/repo/OS detail is hardcoded in the workflow.** Everything specific lives in the per-project config `.archon/ticket-spec.config.yaml`. The workflow YAML and the seven command templates must stay generic across Jira, Azure DevOps, and GitHub. When editing, never leak a tracker name, tenant, cloud id, repo path, or OS-specific command into the workflow or commands. See [ADR-0001](docs/adr/0001-tool-agnostic-config-driven.md).
- **MCP-first, CLI fallback.** Tracker nodes load the MCP server from the fixed path `.archon/mcp/ticket-spec-tracker.json`; when no MCP is configured they fall back to the CLI named in config (`jira` / `az` / `gh`). Keep both paths working. See [ADR-0002](docs/adr/0002-mcp-first-cli-fallback.md).
- **OS-independent.** Paths are relative and forward-slash; no shell-specific or OS-specific commands. The bundle must behave identically on Windows and macOS.
- **Markdown-only descriptions.** Ticket descriptions are plain Markdown so they render across all three trackers. Do not introduce tracker-specific markup (e.g. Jira ADF) into the templates or commands. See [ADR-0003](docs/adr/0003-markdown-only-descriptions.md).
- **Setup is the zero-config entry point.** `/unic-ticket-specification:setup` (`commands/setup.md`) configures the plugin conversationally — it writes `.archon/ticket-spec.config.yaml` and the MCP server so users never hand-edit YAML. It is idempotent (fresh / partial / full / reconfigure / targeted-tweak) and ships **no JavaScript**. See [ADR-0004](docs/adr/0004-setup-conversational-no-lib.md).
- **The human approval gate is mandatory.** Nothing is written to the tracker before `approval-gate`. Rejection revises the draft / estimate / target and re-presents, up to 3 attempts.
- **Completeness is non-blocking.** The completeness assessment annotates but never cancels — incomplete tickets are still estimated, with explicit caveats.
- **`.archon/` is the bundle.** The Plugin's `.archon/` directory is exactly what a Consumer copies into their own `.archon/` to install. Ship the config **template** (`ticket-spec.config.example.yaml`) only — never a project-specific `ticket-spec.config.yaml`.

## External dependencies

- **Archon workflow engine** in the Consumer project (the workflow uses `interactive` approval gates, `when` branches, `output_format`, `mcp`, and `retry`).
- **Tracker access** in the Consumer: either an MCP server placed in `.archon/mcp/ticket-spec-tracker.json`, or the configured tracker CLI (`jira` / `az` / `gh`) installed and authenticated on each machine.

## Do not add

- **Tracker-specific markup or hardcoded tenant/repo/OS detail** in the workflow or commands — see doctrines above.
- **A shipped `ticket-spec.config.yaml`.** Only the `.example` template is part of the bundle; the active config is created per Consumer.
- **Estimation methods beyond PERT** until a real Consumer asks for one with a concrete use case.
- **A `lib/` + `test/` + `tsconfig.json` toolchain** unless `commands/setup.md` grows genuinely complex, drift-prone config logic. ADR-0004 deliberately keeps this a pure-content plugin with no JavaScript; that ADR names the trigger for revisiting.

## Plugin ADRs

Plugin-specific architecture decisions live in [docs/adr/](docs/adr/).
