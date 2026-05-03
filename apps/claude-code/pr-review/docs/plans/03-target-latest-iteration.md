# 03. Target latest PR iteration

**Status: pending**

- Priority: P0
- Effort: S
- Version impact: minor
- Depends on: 02
- Touches: `commands/review-pr.md`, `CLAUDE.md`

## Context

Re-reviews must reason about the latest pushed commits, not the initial iteration. The command currently hardcodes `iterationId=1` in two places — Step 4 (list changed files) and Step 5 (local diff) — and `CLAUDE.md` codifies that as a rule. Both must be updated.

## Current behaviour

`pullRequestIterationChanges` is fetched with `iterationId=1`, missing every change introduced after the first push. The local diff in Step 5 uses `git diff origin/{target}...HEAD` which implicitly covers all commits but does not track iteration boundaries.

## Target behaviour

1. Call `az devops invoke --area git --resource pullRequestIterations …` and pick the highest `id` as `LATEST_ITERATION_ID`.
2. Use `LATEST_ITERATION_ID` for the `pullRequestIterationChanges` call in Step 4 (file list).
3. Capture `sourceRefCommit.commitId` for `LATEST_ITERATION_ID` as `LATEST_COMMIT_ID`.
4. When `IS_REREVIEW=true`:
   - Use `PRIOR_ITERATION_ID` (from spec 01: parsed from signature suffix, with timestamp fallback for legacy comments) to look up that iteration's `sourceRefCommit.commitId` as `PRIOR_COMMIT_ID`.
   - Export both `LATEST_COMMIT_ID` and `PRIOR_COMMIT_ID` for spec 03.
5. Update `CLAUDE.md` line 38 to: "Always use the latest iteration of the PR. `iterationId=1` is never used. Re-reviews additionally compute `PRIOR_ITERATION_ID` from the prior review's signature — see spec 03."

## Timestamp fallback for legacy `PRIOR_ITERATION_ID`

When the prior review's newest comment lacks the `— Iteration N` suffix (legacy format), derive `PRIOR_ITERATION_ID` as follows: fetch all iterations, find the max `createdDate` across all comments in `PRIOR_THREADS`, then select the iteration whose `createdDate` is the highest value still ≤ that timestamp.

## Edge cases

- A brand-new PR has only iteration 1 — this is valid; `LATEST_ITERATION_ID=1` and no fallback needed.
- `pullRequestIterations` returns iterations unsorted — use `jq 'max_by(.id) | .id'` not array index.
- `sourceRefCommit.commitId` may be absent on a very new PR before the first push completes — treat as null and fall back to full diff in spec 03.

## Implementation steps

1. Replace the hardcoded `iterationId=1` block in Step 4 with a fetch + `jq 'max_by(.id)'` lookup.
2. Capture `sourceRefCommit.commitId` from the iterations response.
3. Add the fallback: if zero iterations returned, default to `LATEST_ITERATION_ID=1` with a warning log.
4. When `IS_REREVIEW=true`, resolve `PRIOR_COMMIT_ID` from `PRIOR_ITERATION_ID`.
5. Update `CLAUDE.md` rule.

## Test cases

- Single-iteration PR: `LATEST_ITERATION_ID=1`, behaviour unchanged from before.
- Multi-iteration PR: `LATEST_ITERATION_ID` equals the highest push ID (verify via ADO UI).
- Re-review with iteration suffix in prior signature: `PRIOR_ITERATION_ID` parsed directly, no API cross-join.
- Re-review with legacy prior comment (no suffix): `PRIOR_ITERATION_ID` derived from timestamp comparison.

## Acceptance criteria

- No `iterationId=1` literals remain in `commands/review-pr.md`.
- Step 4 file list and Step 5 diff use the same iteration boundary.
- `CLAUDE.md` rule updated.

## Verification

- `grep -n 'iterationId=1' commands/review-pr.md` → 0 matches.
- Re-run the command on a PR with ≥ 2 iterations and confirm Step 4 logs the latest iteration ID.

## Out of scope

- Computing the diff baseline (spec 03).

## Follow-ups

— none —
