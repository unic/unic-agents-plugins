# Target latest PR iteration

**Status:** closed
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Replace all hardcoded `iterationId=1` uses in `commands/review-pr.md` with a dynamic lookup of the latest iteration ID. There are two locations: the file-list call (Step 4, `pullRequestIterationChanges`) and the diff step (Step 5). Both must use `LATEST_ITERATION_ID`.

The implementation also resolves `PRIOR_ITERATION_ID` and both commit IDs for use by the incremental diff step:

- Fetch all PR iterations via `pullRequestIterations`; select the highest `id` as `LATEST_ITERATION_ID` using `jq 'max_by(.id)'`.
- Capture `sourceRefCommit.commitId` for the latest iteration as `LATEST_COMMIT_ID`.
- When `IS_REREVIEW=true`: use `PRIOR_ITERATION_ID` (parsed from the prior comment's signature by `parse-signature.mjs`; timestamp fallback for legacy comments) to look up that iteration's `sourceRefCommit.commitId` as `PRIOR_COMMIT_ID`.
- Export `LATEST_COMMIT_ID` and `PRIOR_COMMIT_ID` for the next step.

Update the `CLAUDE.md` rule: remove the `iterationId=1` guidance; replace with a description of the latest-iteration approach and the `PRIOR_ITERATION_ID` fallback.

## Acceptance criteria

- [ ] `grep -n 'iterationId=1' commands/review-pr.md` → 0 matches
- [ ] Step 4 file list and Step 5 diff both reference `LATEST_ITERATION_ID`
- [ ] CLI logs the resolved iteration ID on every run
- [ ] `PRIOR_COMMIT_ID` resolved from signature suffix when available; timestamp fallback for legacy
- [ ] `CLAUDE.md` rule updated

## Blocked by

`docs/issues/pr-review-rereview/02-detect-prior-review.md`
