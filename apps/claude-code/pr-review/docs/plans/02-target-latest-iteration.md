# 02. Target latest PR iteration

**Status: pending**

- Priority: P0
- Effort: S
- Version impact: minor
- Depends on: 01
- Touches: `commands/review-pr.md`, `CLAUDE.md`

## Context

Re-reviews must reason about the latest pushed commits, not the initial iteration. The command currently hardcodes `iterationId=1` (line ~88) and `CLAUDE.md` codifies that as a rule.

## Current behaviour

`pullRequestIterationChanges` is fetched with `iterationId=1`, missing every change introduced after the first push.

## Target behaviour

1. Call `az devops invoke --area git --resource pullRequestIterations …` and pick the highest `id`.
2. Use that as `LATEST_ITERATION_ID` for the changes call.
3. When `IS_REREVIEW=true`, also remember `PRIOR_ITERATION_ID` (highest iteration id ≤ created-date of newest prior thread comment) for spec 03.
4. Update `CLAUDE.md` line 38 to: "Use the latest iteration of the PR. Only fall back to iterationId=1 when no iterations are returned (e.g. brand-new PR). Re-reviews additionally compute PRIOR_ITERATION_ID — see spec 03."

## Edge cases

- A brand-new PR has only iteration 1; falling back must still work for first-time reviews.
- `pullRequestIterations` returns iterations sorted oldest-first; do not assume order.

## Implementation steps

1. Replace the hardcoded `iterationId=1` block with a fetch + `jq 'max_by(.id) | .id'` lookup.
2. Add a fallback: if zero iterations returned, default to 1 with a warning log.
3. Update `CLAUDE.md` rule.

## Test cases

- Single-iteration PR: `LATEST_ITERATION_ID=1`, behaviour unchanged from before.
- Multi-iteration PR: `LATEST_ITERATION_ID` equals the latest push id (verify via Azure DevOps UI).

## Acceptance criteria

- No `iterationId=1` literals remain in `commands/review-pr.md`.
- `CLAUDE.md` rule updated.

## Verification

- `grep -n 'iterationId=1' commands/review-pr.md` → 0 matches.
- Re-run the command on a PR with ≥ 2 iterations and confirm Step 4 logs the latest id.

## Out of scope

- Computing the diff baseline (spec 03).

## Follow-ups

— none —
