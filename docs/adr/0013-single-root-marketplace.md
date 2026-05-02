# 0013. Single root marketplace.json listing all plugins

**Status:** Accepted (2025-04)

## Context

Claude Code discovers plugins via a marketplace manifest. With N plugins in one repo, users could either: (a) add N separate plugin sources, or (b) add one monorepo-level source that lists all plugins.

## Decision

Maintain a single `marketplace.json` at the repo root that lists every plugin. `unic-sync-version` updates the relevant plugin entry automatically. Users add one Claude Code source URL.

## Consequences

- Adding a new plugin requires adding its entry to the root `marketplace.json` template.
- All plugins are installed as a bundle when a user adds the source; individual opt-out is not supported.
- `marketplace.json` must never be hand-edited (it is derived from plugin manifests).
