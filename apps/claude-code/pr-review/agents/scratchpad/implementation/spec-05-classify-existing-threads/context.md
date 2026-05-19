# Context — spec-05: Classify existing threads

## Source

Spec file: `docs/plans/05-classify-existing-threads.md`

## Summary

Add "Step 5.5 — Classify existing threads" to `commands/review-pr.md`, between Step 5 (diff) and Step 6 (read key files). This step reads `PRIOR_THREADS_FILE` (set by Step 3.5) and `DIFF_HUNKS_FILE` (set by Step 5), then tags each non-summary bot thread with one of four classifications:

- **`addressed`** — ADO status is fixed/wontFix/closed/byDesign (2/3/4/5), OR status is active/pending AND the thread's line range intersects a changed hunk in `DIFF_HUNKS_FILE`
- **`disputed`** — status is active AND at least one comment does NOT contain the signature prefix `🤖 *Reviewed by Claude Code*`
- **`pending`** — status is active AND all comments contain the signature prefix (bot-only thread)
- **`obsolete`** — `filePath` is non-null and does not appear in the PR diff at all

## Repo patterns (from prior specs)

- Single file changed: `commands/review-pr.md` — bash script embedded in markdown
- jq used throughout for JSON manipulation
- python3 used for complex per-line parsing (see Step 4 and hunk boundary parsing)
- Variables exported between steps via shell: `IS_REREVIEW`, `PRIOR_THREADS_FILE`, `DIFF_HUNKS_FILE`
- Temp files created with `mktemp "${TMPDIR:-/tmp}/pr_XXXXXX.json"`
- Cleanup in Step 12 (`rm -f "$PRIOR_THREADS_FILE" "$DIFF_HUNKS_FILE"`)
- Conventional commits: `feat(spec-05): ...`

## Key data structures (post-spec-04)

**`PRIOR_THREADS_FILE`** — JSON array (set by Step 3.5):

```json
[
  {
    "threadId": 42,
    "filePath": "/src/foo.ts",
    "start": { "line": 10, "offset": 1 },
    "end": { "line": 15, "offset": 1 },
    "comments": [{ "content": "...", "publishedDate": "..." }],
    "status": "active",
    "isSummaryThread": false
  }
]
```

**`DIFF_HUNKS_FILE`** — JSON array (set by Step 5):

```json
[{ "filePath": "/src/foo.ts", "startLine": 12, "endLine": 13 }]
```

## Classification rules (verbatim from spec)

- `addressed`: status in {fixed, wontFix, closed, byDesign, 2, 3, 4, 5} OR (status active/pending AND line intersection exists)
- `disputed`: status active AND ≥1 comment without signature prefix
- `pending`: status active AND all comments have signature prefix
- `obsolete`: filePath non-null AND filePath not in diff

**Line intersection**: `max(thread.start.line, hunk.startLine) ≤ min(thread.end.line, hunk.endLine)`

## Edge cases

- General threads (`filePath=null`, not summary): only `disputed` or `pending`
- Summary thread (`isSummaryThread=true`): skip classification entirely
- Deleted file: `obsolete`
- ADO returns status as strings in practice ("active", "pending", "fixed", etc.)

## Acceptance criteria

1. Every non-summary thread receives exactly one classification
2. Summary thread is skipped (no `classification` field added)
3. Summary count line printed: `Threads: N addressed, N disputed, N pending, N obsolete`
4. Step runs unconditionally (no-op when `IS_REREVIEW=false` and PRIOR_THREADS_FILE is `[]`)
5. `pnpm -w check` passes
6. `pnpm verify:changelog` passes
7. Version bumped to next minor (0.5.0)

## Constraints

- Only touch `commands/review-pr.md` (plus CHANGELOG.md / plugin.json / marketplace.json for version bump)
- No new files beyond what spec describes
- Do not change steps 3.5, 3.6, 4, 5, 6+ except to insert Step 5.5
