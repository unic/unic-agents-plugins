# 0010. pnpm --filter <name> bump <type> is the only sanctioned version-change path

**Status:** Accepted (2025-04)

## Context

Version bumps must be atomic: increment the version, update CHANGELOG, sync derived files, and validate the result. Doing these steps ad hoc leads to inconsistency.

## Decision

`pnpm --filter <name> bump <patch|minor|major>` is the only way to change a plugin version. The `unic-bump` script: (1) validates a clean working tree, (2) increments `plugin.json`, (3) runs `unic-sync-version`. Contributors must not hand-edit version fields.

## Consequences

- CI's `verify:changelog` gate catches version bumps that were not accompanied by a changelog entry.
- `unic-bump` will exit non-zero on a dirty working tree, preventing mixed commits.
