# Retry mechanism on /tdd failure

**Status:** rejected
**Category:** enhancement

## Parent

`docs/issues/feature-runner/PRD.md`

## Summary

Add a retry mechanism to `implement-feature` so the runner tries the `/tdd` invocation again before stopping on failure.

## Rejection reasoning

Grilled 2026-05-09. Both failure modes that could trigger a retry are not worth automating:

- **Agent tool errors** (safety classifier, quota exceeded) have unpredictable resolution windows (minutes to hours). An immediate or short-delay retry is a coin flip and provides no reliable value.
- **Sub-agent gave up** — `/tdd` already has a built-in red-green loop that exhausts retries internally. If it exits with failure, a second invocation hits the same wall. This is a signal for human review, not automation.

The existing "stop + note + leave worktree" behaviour from issue 02 is already the correct response for every failure mode that can occur in practice.
