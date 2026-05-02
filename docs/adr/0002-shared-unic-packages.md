# 0002. Shared tooling extracted into @unic/\* workspace packages

**Status:** Accepted (2025-04)

## Context

Multiple plugins share the same lint rules, TypeScript config, and release scripts. Copying these per plugin leads to drift.

## Decision

Extract shared tooling into three `packages/` workspace members:

- `@unic/biome-config` — Biome 2 rules and formatter config
- `@unic/tsconfig` — base `tsconfig.json` for `tsc --checkJs`
- `@unic/release-tools` — `unic-bump`, `unic-sync-version`, `unic-tag`, `unic-verify-changelog` bin commands

Plugins depend on these via `workspace:*`. The packages are private (not published).

## Consequences

- Lint and type-checking rules evolve in one place.
- Adding a new plugin means consuming `workspace:*` deps, not copying scripts.
- Changes to shared tooling must not break any plugin; cross-plugin test runs are required.
