# 0015. CI uses paths-filter to scope test jobs to changed packages

**Status:** Accepted (2025-04)

## Context

Running all package tests on every push is expensive as the repo grows. Most pushes touch one plugin or one shared package.

## Decision

Use `dorny/paths-filter` in the CI workflow to detect which packages changed. Only changed packages fan out into the OS × Node matrix. The root checks job (Biome, Prettier) is unconditional and always runs.

## Consequences

- A push touching only `apps/claude-code/auto-format/` does not run `pr-review` or `unic-confluence` tests.
- A push touching `packages/release-tools/` should ideally trigger all plugins, but the paths filter must be kept up to date manually as new plugins are added.
- Documentation-only changes may skip the matrix entirely; `pnpm format` still runs.
