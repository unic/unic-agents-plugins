# 0008. Tag scheme: <plugin-name>@<version>

**Status:** Accepted (2025-04)

## Context

A single monorepo releases N plugins independently. A repo-wide `vX.Y.Z` tag cannot distinguish which plugin was released. Namespaced tags (e.g. `auto-format@0.5.5`) allow per-plugin release detection.

## Decision

Every release tag follows the pattern `<plugin-name>@<version>` (e.g. `auto-format@0.5.5`, `pr-review@1.2.0`). The plugin name matches the directory name under `apps/claude-code/`.

## Consequences

- `unic-tag` must construct the tag name from the plugin directory name + `plugin.json` version.
- The release workflow detects new releases by checking tag existence, not by diffing `HEAD~1`.
- Standard tools expecting `vX.Y.Z` tags (GitHub Releases auto-title, semantic-release) need configuration.
