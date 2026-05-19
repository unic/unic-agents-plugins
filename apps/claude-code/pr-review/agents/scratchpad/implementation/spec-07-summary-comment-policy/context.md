# Context — spec-07-summary-comment-policy

## Source

Spec file: `docs/plans/07-summary-comment-policy.md`

## Request Summary

Modify `commands/review-pr.md` so that on re-review the plugin never posts a second full summary. Instead:

- Post a **delta reply** to the existing summary thread when something changed
- Post **nothing** when nothing changed
- Fall back to full-summary mode if the prior summary thread was deleted

## Repo Patterns

- Plugin logic lives entirely in `commands/review-pr.md` (one file, no build step)
- Bash script inline in the command markdown, using Python one-liners for JSON
- ADO threads API: `az devops invoke` with `--route-parameters pullRequestId=... repositoryId=...`
- Reply to a thread: POST to `pullRequestThreads/{threadId}/comments` via `az devops invoke`
- Tabs for indentation, LF line endings
- Signature: `---\n🤖 *Reviewed by Claude Code*`

## Integration Points

- `SUMMARY_THREAD_ID` — set in Step 3.5 (spec 02); identifies the existing summary thread
- `IS_REREVIEW` — boolean set in Step 3.5
- `LATEST_ITERATION_ID` — set in Step 3
- Step 10 — posts inline replies for addressed/disputed threads
- Step 11 — currently always posts a full summary; this spec changes the branching here

## Acceptance Criteria

1. Re-review never produces a second full-length summary
2. Delta reply (when posted) contains only counts and a bullet list — no prose sections
3. Delta is a reply to the existing summary thread, not a new general thread
4. IS_REREVIEW=false: unchanged behaviour (regression check)
5. IS_REREVIEW=true + no changes: nothing posted at summary level
6. Prior summary thread deleted: falls back to full summary in a new thread

## Constraints

- Do NOT change any other steps beyond Step 10 counters and Step 11 branching
- Out of scope: versioning and docs (spec 08)
- Version impact: minor → bump to v0.7.0 in finalization step
