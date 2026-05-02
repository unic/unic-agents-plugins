# 0022. SemVer per plugin, not per monorepo

**Status:** Accepted (2025-04)

## Context

Plugins are independently released and consumed. A monorepo-level version would conflate unrelated changes across plugins.

## Decision

Each plugin maintains its own SemVer version in `.claude-plugin/plugin.json`. The versioning contract:

- **major**: breaking change to the plugin's CLI interface, exit codes, or file schema
- **minor**: new feature that is backwards-compatible
- **patch**: bug fix, documentation update, or internal refactor with no behaviour change

Shared packages (`@unic/*`) are internal and unversioned for external consumers.

## Consequences

- A breaking change in `unic-confluence` does not affect `auto-format` or `pr-review` versioning.
- Changelogs are per-plugin (`CHANGELOG.md` inside each plugin directory).
- There is no monorepo-wide version or combined release notes.
