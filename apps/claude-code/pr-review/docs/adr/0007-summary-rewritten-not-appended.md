# 0007. Summary comment is rewritten on re-review, not appended

**Status:** Accepted (2025-04)

## Context

A PR that goes through multiple review cycles accumulates stale summary comments if each run appends a new one. A single living summary is easier to read and tracks the current state of the review.

## Decision

The plugin maintains exactly one summary comment (identified by the bot signature). On re-review, the existing summary comment is edited (rewritten) with the updated issue count, severity breakdown, and outstanding items. No new summary comment is posted.

## Consequences

- The PR always shows one summary comment, not a stack of historical ones.
- The GitHub/ADO comment edit timestamp shows when the summary was last updated.
- If the summary comment is deleted by a human, the next re-review creates a new one.
