# Plan — spec-04: Incremental diff baseline

1. Step 1 — Update Step 5 in `commands/review-pr.md`

   - Demo: Step 5 branches correctly on IS_REREVIEW with all four paths:
     (a) IS_REREVIEW=false → full-branch diff (unchanged)
     (b) IS_REREVIEW=true, PRIOR_COMMIT_ID empty/null → warning + full diff
     (c) IS_REREVIEW=true, PRIOR_COMMIT_ID == LATEST_COMMIT_ID → early exit with pending thread list
     (d) IS_REREVIEW=true, new commits → git fetch + incremental diff (with force-push fallback)
   - Also exports DIFF_HUNKS_FILE (structured JSON of hunk boundaries) after any successful diff
   - Expected subtask wave: one focused task covering the full Step 5 rewrite

2. Step 2 — Verify, version bump, and commit
   - Demo: `pnpm -w check` passes, version bumped to next minor, CHANGELOG updated, committed
   - Expected subtask wave: one verification + commit task
