# Context — Spec 03: Target latest PR iteration

## Source

Spec file: `docs/plans/03-target-latest-iteration.md`

## Summary

Replace hardcoded `iterationId=1` with a dynamic lookup of the latest PR iteration via the ADO REST API. Also compute `PRIOR_COMMIT_ID` for re-review flows.

## Key file

- `commands/review-pr.md` — the only runtime artifact (no JS/TS, all bash-in-markdown)
- `CLAUDE.md` (plugin-level) — has a rule that must be updated

## What changes

### Step 4 — `pullRequestIterationChanges`

Currently hardcodes `iterationId=1`. Must:

1. Call `pullRequestIterations` API before Step 4
2. Pick `max_by(.id).id` as `LATEST_ITERATION_ID`
3. Capture `max_by(.id).sourceRefCommit.commitId` as `LATEST_COMMIT_ID`
4. Use `LATEST_ITERATION_ID` in the `pullRequestIterationChanges` call

### Re-review path (IS_REREVIEW=true)

- When `PRIOR_ITERATION_ID` is set (parsed from signature), look it up in the iterations array to get `PRIOR_COMMIT_ID`
- Timestamp fallback: when `PRIOR_ITERATION_ID="null"`, find max `createdDate` across all comments in `PRIOR_THREADS_FILE`, then pick the iteration whose `createdDate` is the highest still ≤ that timestamp

### CLAUDE.md update

Replace: "`iterationId=1` is always used unless there's a specific reason to target a later iteration"
With: "Always use the latest iteration of the PR. `iterationId=1` is never used. Re-reviews additionally compute `PRIOR_ITERATION_ID` from the prior review's signature — see spec 02."

## Acceptance criteria

- No `iterationId=1` literals remain in `commands/review-pr.md`
- Step 4 file list uses the same iteration boundary as LATEST_ITERATION_ID
- CLAUDE.md rule updated
- Verification: `grep -n 'iterationId=1' commands/review-pr.md` → 0 matches

## Constraints / out of scope

- Do NOT compute diff baseline (spec 04)
- Version impact: minor → bump minor after implementation
