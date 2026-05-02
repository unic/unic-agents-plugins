# 0007. Release tags are created automatically by CI, not manually

**Status:** Accepted (2025-04)

## Context

Manual tagging (`pnpm --filter auto-format tag && git push --follow-tags`) is error-prone and easy to forget. The tag is the trigger for the release workflow.

## Decision

The monorepo-level release workflow (`.github/workflows/release.yml`) creates `auto-format@<version>` automatically when `plugin.json` contains a version that has no corresponding git tag. Contributors never run `unic-tag` manually.

## Consequences

- Every version bump merged to `main` is automatically released.
- Local `unic-tag` is available but not part of the normal release flow.
- Reverting a version bump after the tag is created requires a manual `git tag -d` + push.
