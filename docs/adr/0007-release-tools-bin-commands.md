# 0007. Release scripts exposed as bin commands; cwd-relative, no --package flag

**Status:** Accepted (2025-04)

## Context

Release scripts (`bump`, `sync-version`, `tag`, `verify-changelog`) must work identically for any plugin. Two conventions were considered: (a) accept a `--package <name>` flag, (b) read `process.cwd()` and be invoked via `pnpm --filter`.

## Decision

Scripts are registered as `bin` entries in `@unic/release-tools/package.json` (`unic-bump`, `unic-sync-version`, `unic-tag`, `unic-verify-changelog`). They read `process.cwd()` as the package root. Consumers invoke them via `pnpm --filter <name> bump patch`, which sets cwd automatically.

## Consequences

- Plugin `package.json#scripts` entries are short (`"bump": "unic-bump"`).
- Scripts are reusable across any pnpm-filtered package without extra flags.
- Scripts will break if invoked outside of a `pnpm --filter` context (they'll read the wrong cwd).
