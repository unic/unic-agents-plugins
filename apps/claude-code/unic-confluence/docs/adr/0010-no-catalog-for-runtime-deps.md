# 0010. Runtime dependencies must not use the pnpm catalog: protocol

**Status:** Accepted (2025-04)

## Context

pnpm workspace `catalog:` references are resolved at install time from `pnpm-workspace.yaml`. When a plugin is installed via `git+https://` (Claude Code's install method), there is no `pnpm-workspace.yaml` in scope and catalog refs break resolution.

## Decision

`dependencies` in `package.json` must use exact version strings or semver ranges — never `catalog:`. `devDependencies` may use `catalog:` because they are not installed in the user's environment.

## Consequences

- Runtime dependencies are pinned or ranged explicitly in `package.json`.
- Any PR that adds a `catalog:` entry to `dependencies` must be rejected.
- devDependencies (Biome, TypeScript) continue to use `catalog:` for consistency across the workspace.
