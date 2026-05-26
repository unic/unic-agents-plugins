# AGENTS.md — unic-confluence

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-confluence` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It Publishes Markdown files into Confluence pages by injecting rendered HTML into named Injection Zones, via the Confluence v2 REST API. The Plugin ships both as a Claude Code slash command (`/unic-confluence`) and as a plain Node.js script that Consumers can wire into their own pipelines. See [`CONTEXT.md`](CONTEXT.md) for the domain vocabulary (Publish, Injection Zone, Zone Label, Page Map, Page Alias, Auto-aliasing).

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

Plugin-specific pnpm scripts (run from this directory or with `pnpm --filter unic-confluence <script>` from the repo root):

```sh
pnpm test                 # run node:test suite over the pure-function library
pnpm typecheck            # tsc --noEmit over the Plugin's .mjs sources
pnpm confluence           # run the Publish CLI (node scripts/push-to-confluence.mjs)
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version         # mirror plugin.json version into marketplace.json + package.json
pnpm tag                  # create the unic-confluence@<version> git tag locally
pnpm verify:changelog     # check CHANGELOG entry for the current version
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).

## Layout

```tree
.claude-plugin/           # Plugin manifest (plugin.json) and marketplace listing
commands/                 # Claude Code slash command definition (unic-confluence.md)
scripts/                  # push-to-confluence.mjs (the CLI) and pure-function library
docs/                     # Plugin-specific documentation
  adr/                    # Plugin Architecture Decision Records
```

## Plugin doctrines

Load-bearing invariants. These either originate in a Plugin ADR or are policy decisions that are not obvious from the code.

- **Refuse to Publish without Injection Zone markers** — unless the legacy anchor-macro path or explicit append fallback applies. The Plugin never silently overwrites a page body. See [ADR-0001](docs/adr/0001-refuse-publish-without-markers.md).
- **Three-strategy injection priority.** Plain-text Injection Zone markers → legacy anchor macros → append fallback, in that order. The first matching strategy wins. See [ADR-0002](docs/adr/0002-three-strategy-injection-priority.md).
- **Structured macro for code blocks.** Markdown fenced code blocks render to Confluence `<ac:structured-macro ac:name="code">`, not raw `<pre>`. See [ADR-0003](docs/adr/0003-structured-macro-for-code-blocks.md).
- **Dry-run is read-only.** `--dry-run` never issues a `PUT` and never mutates credentials, the Page Map, or any remote state. See [ADR-0004](docs/adr/0004-dry-run-read-only.md).
- **Ping-check auth, not per-page verify.** Authentication is checked once via a lightweight ping; the Plugin does not pre-flight every page id. See [ADR-0005](docs/adr/0005-ping-check-auth-over-per-page-verify.md).
- **Hard HTTP timeout.** Every Confluence request runs under a hard timeout so a stalled API call cannot hang the CLI. See [ADR-0006](docs/adr/0006-hard-http-timeout.md).
- **`CliError` class for user-facing failures.** Recoverable, user-actionable errors throw `CliError` with an exit code; unexpected errors keep their stack. See [ADR-0007](docs/adr/0007-clierror-class.md).
- **Pure-functions lib with tests.** Markdown→HTML, marker detection, and Page Map mutations are pure functions covered by `node:test`. See [ADR-0008](docs/adr/0008-pure-functions-lib-with-tests.md).
- **Bare-integer Page id schema.** Page Map values are bare integer Confluence page ids, not objects. Any schema change is breaking. See [ADR-0009](docs/adr/0009-bare-integer-page-id-schema.md).
- **No pnpm catalog for runtime deps.** This Plugin pins its own runtime deps directly rather than going through the workspace catalog. See [ADR-0010](docs/adr/0010-no-catalog-for-runtime-deps.md).
- **Auto-aliasing on raw-id Publish.** A Publish addressed by raw numeric id writes a new Page Alias into the Page Map so the next Publish can use a slug. See [ADR-0011](docs/adr/0011-alias-auto-population.md).
- **Do-not-add scope guard.** The list below is canonical and load-bearing — these features have been considered and rejected with reasons. See [ADR-0012](docs/adr/0012-do-not-add-scope-guard.md).

## External dependencies

- **Confluence v2 REST API** at the Consumer's Confluence instance (default `https://uniccom.atlassian.net`).
- **Credentials file** at `~/.unic-confluence.json` (chmod 600), with fields `url`, `username`, `token`. Overridable per-run via `CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN` env vars.
- **`marked`** (runtime npm dep, pinned in this Plugin's `package.json` — see [ADR-0010](docs/adr/0010-no-catalog-for-runtime-deps.md)). Used to render Markdown to HTML before injection.

## Do not add

These have been considered and explicitly rejected. Open a Feature in the issue tracker with a concrete use case before reopening any of them; expect to overturn [ADR-0012](docs/adr/0012-do-not-add-scope-guard.md).

- **Image upload / attachments.** Walking the Markdown AST for local image references and uploading via `/wiki/rest/api/content/{id}/child/attachment` is significant work that requires a new subcommand, content-negotiation path, and multi-part form handling. Defer.
- **Create-page support.** The Plugin only updates existing pages. Adding `POST /wiki/api/v2/pages` with `spaceId` + `parentId` forces a schema change to the Page Map (value becomes an object, not a bare integer) and complicates every read path.
- **Multi-space or cross-instance publishing.** Page ids are unique per Confluence instance; multiple instances would need a `baseUrl`-per-entry schema and credential routing.
- **MCP server.** The slash command and the CLI are the correct and sufficient surfaces. An MCP server would add lifecycle, transport, and protocol-schema overhead for zero user-visible benefit.
- **Agents or sub-agents.** Publish is a deterministic one-shot — read file → convert Markdown → GET page → inject → PUT page. There is no branching, no tool selection, no iteration; agent autonomy has no value here.
- **Recursive directory Publishing.** Publishing all Markdown files under a tree requires mapping every file to a page id, handling partial failures, and defining rollback semantics. The complexity grows faster than the value.
- **Changesets / release-please / semantic-release.** `@unic/release-tools` is sufficient for one Plugin with two version fields. Do not add a release-management framework.
- **Watch mode / file-watcher.** Confluence is not a live preview target; each Publish increments page version and creates a Confluence revision. Accidental rapid Publishes would pollute revision history.

## Plugin ADRs

Plugin-specific architecture decisions live in [docs/adr/](docs/adr/).
