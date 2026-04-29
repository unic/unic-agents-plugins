# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code plugin that publishes Markdown files to Confluence pages via the Confluence v2 REST API. It ships both as a Claude Code plugin (registered via `marketplace.json`) and as a plain npm package (consumed via `scripts/push-to-confluence.mjs`).

No build step. No TypeScript. No test suite. Pure ESM Node.js.

## Key files

| Path                              | Purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `scripts/push-to-confluence.mjs`  | Single-file CLI — all logic lives here                     |
| `commands/unic-confluence.md`     | Claude Code slash command definition (`/unic-confluence`)  |
| `.claude-plugin/plugin.json`      | Plugin manifest (name, version, command list)              |
| `.claude-plugin/marketplace.json` | Marketplace listing (used by `claude plugins marketplace`) |

## Running the script

```sh
# One-time credential setup (writes ~/.unic-confluence.json)
node scripts/push-to-confluence.mjs --setup

# Verify all page IDs in confluence-pages.json resolve
node scripts/push-to-confluence.mjs --verify

# Publish a file (key from confluence-pages.json, or raw numeric page ID)
node scripts/push-to-confluence.mjs <page-key-or-id> <file.md>
```

No `pnpm run` wrapper is defined in this repo's `package.json` — consuming repos add a `"confluence"` script themselves. When testing locally, call the script with `node` directly.

## Content injection strategies

The script uses three strategies (in priority order) to place Markdown content on an existing Confluence page:

1. **Plain-text markers** — `[AUTO_INSERT_START: label]` / `[AUTO_INSERT_END: label]` anywhere in the page body. Labels must match exactly.
2. **Anchor macros (legacy)** — Confluence `<ac:structured-macro>` anchors named `md-start` / `md-end`.
3. **Append** — no markers found; content is appended to the end of the existing page body.

## Credentials

Stored in `~/.unic-confluence.json` (chmod 600). Three fields: `url`, `username`, `token`. Can be overridden per-run with env vars `CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`.

Default Confluence URL pre-filled in setup: `https://uniccom.atlassian.net`.

## Plugin versioning

`.claude-plugin/plugin.json` is the single source of truth. Every `feat(spec-NN)` / `fix(spec-NN)` commit includes a version bump and a dated `CHANGELOG.md` entry, via `pnpm bump <patch|minor|major>`. Never hand-edit `.claude-plugin/marketplace.json` — `pnpm bump` mirrors into it automatically.

**SemVer policy:**

- **major**: breaking change to CLI flags, exit codes, or on-disk contracts (`confluence-pages.json` schema, `~/.unic-confluence.json` format).
- **minor**: new flag, subcommand, or user-visible feature.
- **patch**: bug fix, refactor, docs, internal tooling.

`pnpm verify:changelog` (and CI on PRs) rejects changes that modify source or user-facing docs without a version bump and CHANGELOG entry.

## Naming convention

| Surface           | Value                        |
| ----------------- | ---------------------------- |
| GitHub repo       | `unic-claude-code-<service>` |
| Plugin identifier | `unic-<service>`             |
| npm package name  | `unic-<service>`             |

## Do not add

The following are explicitly out of scope for this plugin. Do not implement them without first opening a GitHub issue and getting explicit sign-off from the maintainer:

- **Image upload / attachments** — walking the Markdown AST to find local image references and uploading them via `/wiki/rest/api/content/{id}/child/attachment` is significant work that requires a new CLI subcommand, a new content-negotiation path, and multi-part form handling. Defer until a user explicitly requests it with a concrete use case.

- **Create-page support** — the script only updates existing pages. Adding `POST /wiki/api/v2/pages` with `spaceId` + `parentId` requires a schema change to `confluence-pages.json` (value becomes an object, not just a page ID integer), complicating every code path that reads the file. Defer unless there is real demand.

- **Multi-space or cross-instance publishing** — `confluence-pages.json` maps keys to page IDs, and page IDs are unique per Confluence instance. Supporting multiple Confluence instances would require a different config schema (e.g. a `baseUrl` field per entry) and credential routing logic. Out of scope.

- **MCP server** — there is no benefit to wrapping this plugin's functionality in a Model Context Protocol server. The slash command is the correct and sufficient surface. An MCP server would add a process lifecycle, a transport layer, and a versioned protocol schema for zero user-visible benefit.

- **Agents or sub-agents** — the publish task is a deterministic one-shot sequence: read file → convert Markdown → GET page → inject → PUT page. There is no branching, no tool-selection, and no iteration. Agent autonomy adds complexity without value here.

- **Recursive directory publishing** — publishing all Markdown files under a directory tree in one command (e.g. `node push-to-confluence.mjs docs/`) requires mapping every file to a page ID, handling partial failures, and defining rollback semantics. The complexity grows faster than the value. Publish one file at a time.

- **Changesets or release-please** — the `sync-version.mjs` script (spec 06) is sufficient for one package with two version fields. Do not add a release-management framework (Changesets, release-please, semantic-release) — the overhead exceeds the benefit for a single-file plugin.

- **Watch mode / file-watcher** — a flag like `--watch` that re-publishes on file change is not appropriate for a Confluence publishing tool. Confluence is not a live preview target; each publish increments the page version and creates a revision in Confluence's history. Accidental rapid publishes would pollute the revision history.

When in doubt: if the feature is not in the existing `scripts/push-to-confluence.mjs` command set and is not listed in an open `docs/plans/` spec, it is out of scope. Open a GitHub issue before starting implementation.
