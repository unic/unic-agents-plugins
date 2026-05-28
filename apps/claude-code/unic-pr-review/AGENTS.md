# AGENTS.md — unic-pr-review

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-pr-review` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It reviews Azure DevOps pull requests by analysing the diff, enriching context from Confluence documentation and optional Jira work items, and posting structured findings as ADO comments. The `/unic-pr-review:doctor` command verifies all environmental preconditions before a Review starts. See [`CONTEXT.md`](CONTEXT.md) for the domain vocabulary (Plugin, Review, Finding, Confidence, Severity, Intent Brief, Intent Check, Bot Signature, Iteration, Approval Loop, Mode, Provider, Work Item, Notice).

## Where to start

Root docs (monorepo-wide conventions live here — pnpm scripts, Gitflow, SemVer, Conventional Commits, code conventions, LICENSE policy, cross-platform requirement):

- [Root AGENTS.md](../../../AGENTS.md) — source of truth for cross-cutting rules
- [Root CONTEXT.md](../../../CONTEXT.md) — monorepo-wide vocabulary
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) — index of all bounded contexts in the repo
- [Root docs/adr/](../../../docs/adr/) — monorepo-wide architecture decisions
- [Root docs/process/](../../../docs/process/) — process and workflow guides

This Plugin's own decisions:

- [Plugin docs/adr/](docs/adr/) — Plugin-specific architecture decisions

## Commands

Plugin-specific pnpm scripts (run from this directory or with `pnpm --filter unic-pr-review <script>` from the repo root):

```sh
pnpm test                 # run node:test suite over the doctor predicates
pnpm typecheck            # tsc --noEmit over the Plugin's .mjs sources
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version         # mirror plugin.json version into marketplace.json + package.json
pnpm tag                  # create the unic-pr-review@<version> git tag locally
pnpm verify:changelog     # check CHANGELOG entry for the current version
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).

## Layout

```tree
.claude-plugin/           # Plugin manifest (plugin.json) and marketplace listing
commands/                 # Claude Code slash command definitions (doctor.md)
scripts/                  # doctor.mjs and lib/credentials.mjs
tests/                    # node:test suite for the doctor predicates
docs/                     # Plugin-specific documentation
  adr/                    # Plugin Architecture Decision Records
```

## Plugin doctrines

Load-bearing invariants. These either originate in a Plugin ADR or are policy decisions that are not obvious from the code.

- **Azure CLI is the ADO transport.** All ADO calls go through `az devops` subcommands, never a direct REST call. See [ADR-0001](docs/adr/0001-azure-cli-as-ado-transport.md).
- **Dual credential file schema.** `~/.unic-confluence.json` for Confluence + optional Jira; `~/.unic-azure.json` for Azure DevOps. See [ADR-0002](docs/adr/0002-dual-credential-file-schema.md).
- **Env-var override.** Every credential field can be overridden by an environment variable. See [ADR-0003](docs/adr/0003-env-var-credential-override.md).
- **Jira is optional and silent.** When `jiraUrl` is absent from credentials, the Jira check and all Jira enrichment are silently skipped. See [ADR-0004](docs/adr/0004-jira-optional-silent.md).
- **Doctor exits non-zero on critical failure.** Any failing preflight check causes doctor to exit 1; all checks run before exit so the user sees every failure. See [ADR-0005](docs/adr/0005-doctor-exits-nonzero-on-failure.md).
- **Identity pre-warm via `az devops user show`.** Doctor runs `az devops user show --user me` to pre-warm the identity cache before Reviews start. See [ADR-0006](docs/adr/0006-identity-prewarm-via-az-user-show.md).
- **Zero runtime dependencies in the scaffold slice.** No runtime npm packages in this Plugin. See [ADR-0007](docs/adr/0007-zero-runtime-deps-in-scaffold.md).
- **JSDoc + `tsc --checkJs`, no compilation.** Type safety via `// @ts-check` and JSDoc only. See [ADR-0008](docs/adr/0008-jsdoc-tsc-check-no-compile.md).
- **Version starts at 2.0.0.** Signals a clean-slate break from the legacy `pr-review` plugin. See [ADR-0009](docs/adr/0009-version-starts-at-2-0-0.md).
- **Confluence reachability via HTTP ping.** Doctor issues a HEAD request to the Confluence base URL — no full auth exchange. See [ADR-0010](docs/adr/0010-confluence-http-ping-check.md).

## External dependencies

- **Azure CLI** (`az`) with the `azure-devops` extension — Consumer-installed, verified by doctor.
- **Confluence v2 REST API** — base URL from `~/.unic-confluence.json` or the `CONFLUENCE_URL` env var.
- **Jira REST API** — optional, URL from the `jiraUrl` field in `~/.unic-confluence.json` or the `JIRA_URL` env var.

## Do not add

- **Direct Azure DevOps REST calls** — always use `az devops`. See [ADR-0001](docs/adr/0001-azure-cli-as-ado-transport.md).
- **Runtime npm dependencies** in the scaffold slice. See [ADR-0007](docs/adr/0007-zero-runtime-deps-in-scaffold.md).
- **Any code copied from `apps/claude-code/pr-review/`.** Clean-slate doctrine applies permanently — write modules fresh from the PRD and ADRs.

## Plugin ADRs

Plugin-specific architecture decisions live in [docs/adr/](docs/adr/).
