# Plan — Spec 03: Target latest PR iteration

1. Step 1 — Insert iteration fetch block before Step 4 and update Step 4 to use LATEST_ITERATION_ID

   - Demo: `grep -n 'iterationId=1' commands/review-pr.md` returns 0 matches; Step 4 references `$LATEST_ITERATION_ID`
   - Wave: one task to implement the fetch block + update Step 4 + add re-review PRIOR_COMMIT_ID resolution + update CLAUDE.md

2. Step 2 — Verify, bump, and commit
   - Demo: `pnpm -w check` passes, `pnpm bump minor` succeeds, spec marked done, committed
   - Wave: one task to run verification, bump, update CHANGELOG, mark spec done, commit
