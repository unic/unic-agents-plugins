# 04. Incremental diff baseline on re-review

**Status: done — 2026-05-06**

- Priority: P1
- Effort: M
- Version impact: minor
- Depends on: 03
- Touches: `commands/review-pr.md`

## Context

Step 5 currently runs `git diff origin/{target}...HEAD`, which on re-review shows the entire branch — including code already reviewed. The reviewer wastes tokens re-analysing untouched lines.

## Current behaviour

Full branch diff regardless of `IS_REREVIEW`.

## Target behaviour

- When `IS_REREVIEW=false`: keep existing full-branch diff.
- When `IS_REREVIEW=true`: diff between `PRIOR_COMMIT_ID` and `LATEST_COMMIT_ID` (both provided by spec 03 via `sourceRefCommit.commitId`).
- If the two commit IDs are identical (no new pushes since prior review), exit Step 5 early:
  1. Print `No new commits since last review.`
  2. Print a list of all `pending` threads from `PRIOR_THREADS` (file path and line range for each), so the user knows what is still outstanding.
  3. Exit cleanly — do not proceed to Steps 6–11.
- If `PRIOR_COMMIT_ID` is null (legacy comment with no parseable iteration), fall back to full diff with a warning: `Warning: could not resolve prior commit — falling back to full diff.`

## Edge cases

- Force-push rewrites history; `PRIOR_COMMIT_ID` may no longer exist locally. Attempt `git fetch origin {PRIOR_COMMIT_ID}` before diffing; if the fetch fails, fall back to full diff with a warning that includes both commit IDs: `Warning: prior commit {PRIOR_COMMIT_ID} unreachable; latest commit {LATEST_COMMIT_ID} — falling back to full diff.`
- Files renamed between iterations: rely on `git diff -M` (already default) so renames map correctly.
- `LATEST_COMMIT_ID` is null (spec 03 edge case): fall back to full diff with a warning.

## Implementation steps

1. Branch Step 5 on `IS_REREVIEW`.
2. Add the early-exit path: print "No new commits" message, list pending threads, exit cleanly.
3. Add the `git fetch` attempt with the detailed fallback warning message.
4. The diff hunk output from this step is consumed by spec 05 for thread classification — ensure hunk boundaries (file path, start line, end line) are exported in a structured format (JSON or line-delimited) to `$TMPDIR`.

## Test cases

- Re-review with identical commit IDs: early-exit path fires, pending thread list printed to console, no ADO comments posted.
- Re-review with one new commit: diff contains exactly that commit's changes.
- Re-review after a force-push that rebased the branch: fallback warning fires with both commit IDs; full diff is used.
- Re-review with `PRIOR_COMMIT_ID=null` (legacy): fallback warning fires; full diff used.

## Acceptance criteria

- First-time review behaviour unchanged.
- Early exit lists all pending threads before stopping.
- Fallback warnings always include both commit IDs when available.

## Verification

- Run the command on a PR with no new commits since last review — confirm early exit fires and pending threads are listed.
- Run the command on a PR with one new commit — confirm diff output matches `git diff {PRIOR_COMMIT_ID}..{LATEST_COMMIT_ID}`.

## Out of scope

- Thread classification (spec 05).

## Follow-ups

— none —
