# 0001. pnpm 10 workspaces — no Turborepo or Nx

**Status:** Accepted (2025-04)

## Context

A new monorepo needed a package manager strategy. Options included Turborepo, Nx, and plain pnpm workspaces. The repo contains a small number of plugins and shared packages; build orchestration overhead was undesirable.

## Decision

Use pnpm 10 in workspace mode. `pnpm --filter` is the sole dispatch mechanism. A workspace `catalog:` handles shared version pinning. No Turborepo, Nx, or other build orchestrator.

## Consequences

- Adding a new package requires a new directory + `package.json`; no pipeline registration step.
- CI fan-out is handled by `dorny/paths-filter` rather than task-graph inference.
- Turborepo caching and remote-cache features are not available.
- Contributors need pnpm 10; `package.json#packageManager` enforces this.
