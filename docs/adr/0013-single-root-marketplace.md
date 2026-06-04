# 0013. Single root marketplace.json listing all plugins

**Status:** Accepted (2025-04)

## Context

Claude Code discovers plugins via a marketplace manifest. With N plugins in one repo, users could either: (a) add N separate plugin sources, or (b) add one monorepo-level source that lists all plugins.

## Decision

Maintain a single **root registry** at `.claude-plugin/marketplace.json` that lists every plugin. This is the only manifest Claude Code reads when a user adds the marketplace source, so users add one source URL and get all plugins.

The repo uses two distinct files that share the `marketplace.json` name; do not conflate them:

- **Root `.claude-plugin/marketplace.json`** — the install registry. Entries are minimal `{ "name", "source" }` and carry no version. It is **hand-maintained**: adding a plugin requires manually appending an entry. Nothing derives or generates it.
- **Per-plugin `<plugin>/.claude-plugin/marketplace.json`** — a per-plugin release artifact. `unic-sync-version` mirrors that plugin's `plugin.json` version (plus `license`/`homepage`/`keywords`) into *this* file. It does **not** touch the root registry.

## Consequences

- Adding a new plugin requires manually appending its `{ name, source }` entry to the root registry. This is easy to forget and has no automated guard — the `new-plugin` skill calls it out as a mandatory step.
- A plugin can be fully scaffolded and versioned (correct `plugin.json` + per-plugin `marketplace.json`) yet remain invisible to installers because it was never added to the root registry. This exact gap hid `unic-pr-review` (#132 follow-up).
- All plugins install as a bundle when a user adds the source; individual opt-out is not supported.
- `unic-sync-version` keeps each **per-plugin** manifest's version in step with its `plugin.json`; the root registry holds no versions and so needs no sync.
