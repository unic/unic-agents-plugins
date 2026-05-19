# Plan — spec-07-summary-comment-policy

1. Step 1 — Implement counter tracking + Step 11 branching

   - Demo: commands/review-pr.md has counter variables accumulated in Step 10, and Step 11 branches correctly on IS_REREVIEW + counters; pnpm -w check passes
   - Wave: single task — add counters to Step 10, rewrite Step 11 branching

2. Step 2 — Finalization
   - Demo: CHANGELOG updated, version bumped to v0.7.0, spec marked done, committed
   - Wave: single finalization task — CHANGELOG entry, pnpm bump minor, verify:changelog, mark spec done, commit
