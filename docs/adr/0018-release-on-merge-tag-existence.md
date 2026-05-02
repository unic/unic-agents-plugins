# 0018. Releases triggered automatically on main by tag-existence check

**Status:** Accepted (2025-05) — supersedes HEAD~1 diff approach (spec 14)

## Context

The release workflow must create a `<plugin>@<version>` tag when a new version lands on `main`. Two approaches were considered: (a) diff `plugin.json` against `HEAD~1`, (b) check whether the tag `<plugin>@<version>` already exists.

The HEAD~1 diff approach fails when multiple commits are pushed together (the version bump may not be in the topmost commit). Tag-existence is idempotent and survives re-runs.

## Decision

For each plugin, the release workflow reads the current version from `plugin.json` and checks whether `<plugin>@<version>` already exists as a git tag. If the tag is absent, it creates it (with optional GPG signing). If the tag exists, it skips silently.

## Consequences

- Re-running the release workflow on the same commit is safe (idempotent).
- Downgrading a plugin version would not create a tag, which is the correct behaviour.
- The workflow must iterate over all plugins on every push to `main`.
