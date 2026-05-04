# 0009. plugin.json is the single source of truth for plugin version

**Status:** Accepted (2025-04)

## Context

Each plugin has three files that carry a version: `.claude-plugin/plugin.json`, `marketplace.json`, and `package.json`. Manual edits to all three cause drift.

## Decision

`.claude-plugin/plugin.json` is the authoritative version field. `unic-sync-version` propagates the value to `marketplace.json` and `package.json` after every bump. Humans must only edit `plugin.json`.

## Consequences

- `pnpm --filter <name> bump <type>` is the only sanctioned version-change path.
- `marketplace.json` must never be hand-edited (enforced by convention; no file lock exists).
- The sync script must be run before tagging; `unic-tag` calls it defensively.
