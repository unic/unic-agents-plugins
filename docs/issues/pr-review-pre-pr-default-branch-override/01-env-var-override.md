---
title: pre-pr: env var override for default-branch fallback chain
created: 2026-05-14
---

**Status:** needs-triage
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`
**Depends on:** orchestrator-split PR merged

## Problem Statement

`detect-default-branch.mjs` uses a Gitflow-aware fallback chain (`remote-show → develop → main → master → none`) when the remote is unreachable. Repos that intentionally use `main` as their integration branch but have a stale `origin/develop` ref will silently diff against `develop` with no escape hatch — the user has no way to override the choice.

## Solution

Add an environment variable override (e.g. `PR_REVIEW_DEFAULT_BRANCH`) that, when set, short-circuits the fallback chain and uses the specified branch directly. A Notice should still be emitted if the override bypasses a `remote-show` that would have returned a different result.

## Acceptance criteria

- `PR_REVIEW_DEFAULT_BRANCH=main` forces the pre-PR diff to use `main` regardless of what `remote-show` or the fallback chain would have returned
- When the env var is set, the fallback chain is not consulted
- An info-level Notice is emitted when the env var is used, so the invoker knows the override is active
- Existing behavior (no env var set) is unchanged
- Unit tests cover the override path
