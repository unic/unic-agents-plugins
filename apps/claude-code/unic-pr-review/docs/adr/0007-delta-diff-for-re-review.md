# Re-review uses a delta diff, not a full PR diff

A First Review analyses the diff from the PR's base branch to its current Revision. A Re-review analyses only the diff between the prior reviewed Revision and the current Revision. Prior Findings from earlier Reviews are passed as context so each Review Aspect agent can verify whether they're fixed, still pending, or obsolete — without re-raising them as new Findings.

## Considered options

- **Always review the full base diff.** Rejected — invokers Re-review primarily to check that author changes since the last pass are correct. A full re-analysis would re-surface every prior Finding as a duplicate candidate and inflate token cost on every iteration.
- **Delta diff with no prior-Finding context.** Rejected — without prior Findings the Re-review Coordinator cannot do Thread Classification or auto-resolve `addressed` threads. The context is what enables the Reply-not-duplicate doctrine.

## Consequences

- The ADO Fetcher must compute the delta from the Revision identified by the Bot Signature parser; if that Revision no longer exists (force-push that overwrote history), the Plugin falls back to First-Review mode and posts a Notice.
- Prior Findings injected into agent context are tagged with their original Severity and Thread state so agents can produce a structured verdict (fixed / partial / ignored) that the Re-review Coordinator consumes for Thread Classification.
- The cost of a Re-review scales with the size of the delta, not the size of the PR — which is the property invokers actually want.
