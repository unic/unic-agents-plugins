# 0009. Plugin version starts at 2.0.0

**Status:** Accepted (2026-05)

## Context

The existing `pr-review` plugin (a different codebase) was at version 1.x. `unic-pr-review` is a clean-slate rewrite with no shared code, no shared config schema, and no migration path from `pr-review`.

## Decision

The initial version of `unic-pr-review` is `2.0.0`. This signals to Consumers that this is a successor, not a patch on `pr-review`.

## Consequences

- No version 1.x tags will ever exist for `unic-pr-review`.
- Semver major 2 is "spent" at launch; the next breaking change will go to 3.0.0.
- `unic-verify-changelog` will enforce that a `[2.0.0]` CHANGELOG entry exists before any release.
