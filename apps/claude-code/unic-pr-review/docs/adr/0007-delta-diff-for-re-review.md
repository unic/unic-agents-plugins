# 0007. Re-review uses a delta diff, not a full PR diff

**Status:** Accepted (2026-05)

## Context

When an author pushes new commits to a PR that has already been reviewed, the Plugin needs to decide what scope of code to re-analyse and how to handle Findings raised in the previous Review. The naive option (re-run the full PR diff) is expensive and produces duplicate Findings; the right option needs to preserve cross-iteration context so the Plugin can reply to prior Threads rather than re-raise them.

Two alternatives were considered:

- **Always review the full base diff.** Rejected — invokers Re-review primarily to check that author changes since the last pass are correct. A full re-analysis would re-surface every prior Finding as a duplicate candidate and inflate token cost on every iteration.
- **Delta diff with no prior-Finding context.** Rejected — without prior Findings the Re-review Coordinator cannot do Thread Classification or auto-resolve `addressed` threads. The context is what enables the Reply-not-duplicate doctrine.

## Decision

A First Review analyses the diff from the PR's base branch to its current Revision. A Re-review analyses only the diff between the prior reviewed Revision and the current Revision. Prior Findings from earlier Reviews are passed as context so each Review Aspect agent can verify whether they're fixed, still pending, or obsolete — without re-raising them as new Findings.

## Consequences

- The ADO Fetcher must compute the delta from the Revision identified by the Bot Signature parser; if that Revision no longer exists (force-push that overwrote history), the Plugin falls back to First-Review mode and posts a Notice.
- Prior Findings injected into agent context are tagged with their original Severity and Thread state so agents can produce a structured verdict (fixed / partial / ignored) that the Re-review Coordinator consumes for Thread Classification.
- The cost of a Re-review scales with the size of the delta, not the size of the PR — which is the property invokers actually want.
