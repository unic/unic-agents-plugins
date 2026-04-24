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

Both `plugin.json` and `marketplace.json` carry a `version` field. Keep them in sync manually when releasing. There is no automated publish step.

## Naming convention

| Surface           | Value                        |
| ----------------- | ---------------------------- |
| GitHub repo       | `unic-claude-code-<service>` |
| Plugin identifier | `unic-<service>`             |
| npm package name  | `unic-<service>`             |
