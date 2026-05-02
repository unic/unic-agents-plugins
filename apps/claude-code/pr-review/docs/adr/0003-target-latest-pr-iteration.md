# 0003. Always target the latest PR iteration, not iterationId=1

**Status:** Accepted (2025-04)

## Context

Azure DevOps tracks PR changes as numbered iterations. Inline comments must anchor to lines that exist in the current diff. Comments anchored to `iterationId=1` reference lines from the original push and may become invalid after force-push or rebase.

## Decision

The plugin always fetches the latest iteration ID for the PR and uses it when posting inline comments. `iterationId=1` is never used.

## Consequences

- Comments posted during a re-review anchor to the latest iteration's diff.
- If a re-review runs between two push events, the iteration ID may change mid-review; comments from the first half of the review may reference a stale iteration. This is an accepted edge case.
