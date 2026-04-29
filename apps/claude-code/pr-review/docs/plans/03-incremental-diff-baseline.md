# 03. Incremental diff baseline on re-review

**Status: pending**

- Priority: P1
- Effort: M
- Version impact: minor
- Depends on: 02
- Touches: `commands/review-pr.md`

## Context

Step 5 currently runs `git diff origin/{target}...HEAD`, which on re-review shows the entire branch — including code already reviewed. The reviewer wastes tokens re-analysing untouched lines.

## Current behaviour

Full branch diff regardless of `IS_REREVIEW`.

## Target behaviour

- When `IS_REREVIEW=false`: keep existing full-branch diff.
- When `IS_REREVIEW=true`: diff between the source-commit of `PRIOR_ITERATION_ID` and the source-commit of `LATEST_ITERATION_ID`. Use the `sourceRefCommit.commitId` field returned by `pullRequestIterations`.
- If the two commit ids are equal (no new pushes since prior review), abort early: print `No new commits since last review — nothing to do` and exit Step 5 cleanly.

## Edge cases

- Force-pushes rewrite history; the prior commit id may not exist locally. Fetch it (`git fetch origin <commit>`) before diffing; if the fetch fails, fall back to full diff with a warning.
- Files renamed between iterations: rely on `git diff -M` (already default) so renames map.

## Implementation steps

1. Extend the iteration metadata captured in spec 02 to include `sourceRefCommit.commitId`.
2. Branch Step 5 on `IS_REREVIEW`.
3. Add the early-exit path with a clear log line.

## Test cases

- Re-review with no new pushes: early-exit path fires.
- Re-review with one new commit: diff contains exactly that commit's changes.
- Re-review after a force-push that rebased the branch: fall-back warning fires; full diff is used.

## Acceptance criteria

- First-time review behaviour unchanged.
- Re-review token usage measurably lower on PRs with small follow-up pushes (smoke-test on PR 5509: diff should be ~iteration-3 delta only).

## Verification

- Run the command against PR 5509 (currently at iteration 3) — confirm Step 5 output matches `git diff <iter2-commit>..<iter3-commit>`.

## Out of scope

- Thread classification (spec 04).

## Follow-ups

— none —
