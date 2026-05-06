# 0009. Re-review summary delta is posted as a reply to the existing summary thread

**Status:** Accepted (2026-05) — Supersedes 0007

## Context

ADR 0007 established that the plugin maintains exactly one summary comment by rewriting it in place on re-review. A grilling session in 2026-05 reversed this decision: editing a comment loses the history of what changed between review cycles, and ADO's thread model makes a reply-based approach both cleaner and more auditable. The existing summary thread is identified via the `isSummaryThread = true` marker set by spec 02.

## Decision

On re-review, the summary delta is posted as a **reply** to the existing summary thread (the one whose `isSummaryThread` property is `true`). The reply contains the updated issue count, severity breakdown, and outstanding items for the current review cycle.

**Fall-back:** if the prior summary thread is missing or has been deleted, a fresh full summary is posted as a new thread. The plugin never attempts to edit an existing comment.

## Consequences

- The PR shows one summary thread with reply entries across review cycles, giving a clear history of how the review evolved.
- Edit-history of summary comments is no longer load-bearing; no special ADO comment-edit API calls are needed.
- If the summary thread is deleted between cycles, the next re-review creates a new one (same fall-back as ADR 0007).
- The `isSummaryThread` marker (spec 02) becomes a required precondition for summary-thread location; reviews run before spec 02 is deployed will fall back to creating a new thread.
