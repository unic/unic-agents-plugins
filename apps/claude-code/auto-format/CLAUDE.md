# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

`unic-claude-code-format` is a Claude Code plugin that auto-formats and lints files after Write/Edit/MultiEdit/NotebookEdit events. The hook script (`scripts/format-hook.mjs`) uses only Node built-ins — no external deps.

## Commands

```sh
pnpm install              # Install dev dependencies
pnpm test                 # Run smoke tests (node:test)
pnpm bump patch           # Bump patch version + promote CHANGELOG
pnpm bump minor           # Bump minor version + promote CHANGELOG
pnpm bump major           # Bump major version + promote CHANGELOG
pnpm verify:changelog     # Check CHANGELOG structure
```

## Tech Stack

- **Runtime**: Node.js >=24 (LTS). Version pinned via `pnpm-workspace.yaml#useNodeVersion`.
- **Package manager**: pnpm (workspace mode, catalog pinning).
- **Module system**: ESM (`"type": "module"`).
- **Test runner**: `node:test` built-in. No external framework.
- **Hook script deps**: zero external. Only `node:child_process`, `node:fs`, `node:path`.

## Code Conventions

- Tabs for indentation in `.js`/`.mjs` files; 2-space for `.json`, `.yml`, `.yaml` (per `.editorconfig`).
- Conventional commits: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`.
- SemVer: `pnpm bump <patch|minor|major>`. Never hand-edit `.claude-plugin/marketplace.json`.
- No `^` or `~` version ranges. Exact pins only (catalog for devDeps).

## Scope Guard — Do Not Add

- MCP servers, skills, agents, or other Claude Code plugin features not described in an existing spec.
- External npm runtime dependencies to the hook script.
- Prettier or ESLint bundled inside the plugin — consumers bring their own.
- Support for tools outside the Claude Code hook contract (e.g. bash hooks, pre-commit hooks — those belong in consumer repos).

## Ralph Orchestrator

This repo uses ralph-orchestrator for iterative development. See `docs/plans/README.md` for the spec roadmap and `PROMPT.md` for the orchestrator loop prompt.
