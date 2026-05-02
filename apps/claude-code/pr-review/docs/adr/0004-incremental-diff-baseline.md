# 0004. Incremental diff baseline = prior iteration's sourceRefCommit

**Status:** Accepted (2025-04)

## Context

Re-reviewing a PR that has already been reviewed should focus on what changed since the last review, not re-analyse the entire diff. The baseline for "what changed" must be the commit that was HEAD when the previous review was posted.

## Decision

When a prior review is detected, the baseline commit is read from the prior review iteration's `sourceRefCommit.commitId`. Only files changed between that commit and the current HEAD are passed to the review agents.

## Consequences

- Re-review cost and noise are proportional to the delta since the last review.
- If the PR was rebased and the baseline commit is no longer in the history, the plugin falls back to a full diff.
