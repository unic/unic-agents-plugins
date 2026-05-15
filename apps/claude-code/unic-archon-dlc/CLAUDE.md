# CLAUDE.md

This file provides guidance to Claude Code when working in this plugin.

## Project Overview

`unic-archon-dlc` is a Claude Code plugin that ships six Archon YAML workflows covering the full AI development lifecycle: **explore → plan → build → qa → cleanup → triage**. Each workflow is a YAML DAG consumable by the Archon runtime, with human approval gates (`interactive: true` nodes) at every phase boundary. The plugin also provides an idempotent install hook that configures the target project and writes `docs/agents/` documentation.

## Commands

```sh
pnpm install                     # Install dev dependencies
pnpm test                        # Run node:test suite
pnpm typecheck                   # Type-check plugin source (tsc --checkJs, dev-only)
pnpm bump patch                  # Bump patch version + promote CHANGELOG
pnpm bump minor                  # Bump minor version + promote CHANGELOG
pnpm bump major                  # Bump major version + promote CHANGELOG
pnpm sync-version                # Propagate plugin.json version to marketplace.json + package.json
pnpm tag                         # Create git tag (run git push --follow-tags after)
pnpm verify:changelog            # Check CHANGELOG structure
pnpm ralph                       # Run the Ralph orchestrator loop (docs/plans/)
```

## Tech Stack

- **Runtime**: Node.js >=22. `.nvmrc` (currently `24.15.0`) is the recommended local version; CI exercises Node 22 and 24.
- **Package manager**: pnpm (workspace mode, catalog pinning).
- **Module system**: ESM (`"type": "module"`).
- **Linter/formatter**: Biome 2 for code/JSON; Prettier for Markdown only.
- **Type checking**: `tsc --checkJs --noEmit` on `.mjs` files; no compilation step.
- **Test runner**: `node:test` built-in. No external framework.
- **Runtime deps**: Zero external. Only `node:fs`, `node:path`, `node:os`, `node:child_process`, `node:readline`.

## Code Conventions

- Tabs for indentation in `.mjs`/`.js` files; 2-space for `.json`, `.yml`, `.yaml`.
- `@ts-check` + JSDoc for type safety — no TypeScript compilation.
- Conventional commits: `feat(unic-archon-dlc): ...`, `fix(unic-archon-dlc): ...`.
- SemVer: `pnpm bump <patch|minor|major>`. Never hand-edit `.claude-plugin/marketplace.json`.
- No `^` or `~` version ranges — use catalog pinning for devDeps.

## Scope Guard — Do Not Add

- External runtime npm dependencies to scripts or workflows.
- Features not described in an open spec under `docs/plans/`.
- LICENSE files — maintainer manages these manually per monorepo convention.
- Visual workflow editors or dashboards.
- Cross-AI execution delegation.

## Ralph Orchestrator

This plugin uses ralph-orchestrator for iterative development. See `docs/plans/` for spec files and `PROMPT.md` for the orchestrator loop prompt.
