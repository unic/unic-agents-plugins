# Progress — spec-06: Reply to threads instead of duplicating

## Current Step

Step 2 — Verify, changelog, version bump, mark spec done, commit

## Active Wave

- `task-1778033161-2a84` (`code-assist:spec-06-reply-to-threads:step-02:changelog-bump-commit`) — changelog entry, bump to v0.6.0, mark spec done, update README, commit

## Verification Notes

- `pnpm -w check`: PASSES ✅ (Biome + Prettier clean after formatting scratchpad MDs)

## Completed Steps

### Step 1 — Implement reply logic in commands/review-pr.md ✅

Changes made to `commands/review-pr.md`:

1. **Step 10 refactored** — `FINDINGS_POSTED=0` counter initialized; Path A (IS_REREVIEW=false) keeps existing flow + increments counter; Path B (IS_REREVIEW=true) adds:

   - Partial-prior-run check: Python script inspects summary thread for `✅ Review complete — Iteration {LATEST_ITERATION_ID}` marker; if absent, resets IS_REREVIEW=false.
   - Thread matching function: filePath equality + line-range overlap with ±3 drift via Python + sys.argv.
   - Five classification branches: obsolete=skip, pending(no evidence)=skip, pending(new evidence)=reply via pullRequestThreadComments, disputed=reply+ADO nudge, addressed=reply+PATCH status=2 with 409 handling.

2. **Step 11 minimal change** — captures SUMMARY_RESPONSE into variable; extracts and sets SUMMARY_THREAD_ID when empty (first-review mode).

3. **Step 11.5 added** — posts completion marker reply to summary thread after Step 11.

4. **Step 12 updated** — cleanup includes new temp files (`pr_reply_*.json`, `pr_thread_patch_*.json`, `pr_patch_err_*.json`, `pr_completion_marker.json`).
