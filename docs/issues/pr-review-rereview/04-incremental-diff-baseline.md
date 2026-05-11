# Incremental diff baseline

**Status:** closed
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Branch Step 5 of `commands/review-pr.md` on `IS_REREVIEW` so re-reviews only diff the new commits, not the entire branch.

When `IS_REREVIEW=true`:

- Diff between `PRIOR_COMMIT_ID` and `LATEST_COMMIT_ID` (from the previous issue).
- If both commit IDs are identical (no new pushes since last review): print `No new commits since last review.`, list all `pending` threads from `PRIOR_THREADS` (file path and line range per thread) to the console, then exit cleanly without proceeding to Steps 6–11.
- Attempt `git fetch origin {PRIOR_COMMIT_ID}` before diffing; if the fetch fails (force-push / garbage collection), fall back to full diff with a warning that includes both commit IDs: `Warning: prior commit {PRIOR_COMMIT_ID} unreachable; latest commit {LATEST_COMMIT_ID} — falling back to full diff.`
- If `PRIOR_COMMIT_ID` is null (legacy comment), fall back to full diff with a simpler warning.

Export diff hunk boundaries (file path, start line, end line per hunk) as structured JSON to `$TMPDIR` for consumption by the classify-thread module.

When `IS_REREVIEW=false`: behaviour is unchanged from before this issue.

## Acceptance criteria

- [ ] First-time review diff behaviour unchanged
- [ ] Re-review diffs only between `PRIOR_COMMIT_ID` and `LATEST_COMMIT_ID`
- [ ] Early exit on identical commits: pending threads listed to console; no ADO writes
- [ ] Force-push fallback warning includes both commit IDs
- [ ] Diff hunk boundaries exported as structured JSON to `$TMPDIR`

## Blocked by

`docs/issues/pr-review-rereview/03-target-latest-iteration.md`
