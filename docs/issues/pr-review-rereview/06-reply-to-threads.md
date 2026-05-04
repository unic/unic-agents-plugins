# Reply to threads + extract match-finding module + completion marker

**Status:** ready-for-agent
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Branch Step 10 of `commands/review-pr.md` on `IS_REREVIEW` so re-reviews reply to existing threads instead of creating duplicates. Extract the matching logic into `scripts/re-review/match-finding.mjs`.

**`match-finding.mjs`** — pure function. Given a finding (file path + line range) and the list of prior threads, returns the best-matching prior thread or null. Matching requires file path equality and line-range overlap (`max(finding.start, thread.start) ≤ min(finding.end, thread.end)`) with a ±3 line drift tolerance applied to both endpoints before the overlap test.

**Reply actions per classification:**

| Classification           | Action                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `pending` (unchanged)    | Skip — do not post                                                                                                             |
| `pending` (new evidence) | Reply via `pullRequestThreadComments` with new evidence only                                                                   |
| `disputed`               | Reply acknowledging the author's point; include nudge to mark thread fixed in ADO                                              |
| `addressed`              | Reply `Resolved as of Iteration N — thanks!`; PATCH thread status to `fixed` via `pullRequestThreads` (body `{ "status": 2 }`) |
| `obsolete`               | No action                                                                                                                      |

New findings (no prior match): create a fresh thread as before; signature suffix carries the iteration number — no separate "Iteration N" header line needed.

**`pending` general threads** (no filePath, not the summary thread): skip — same rule as inline pending.

**Completion marker**: after all posts, post one final reply to the summary thread: `✅ Review complete — Iteration {LATEST_ITERATION_ID} ({N} findings posted)`. This is the last action of every successful run. Absence of this marker for the current iteration signals a partial prior run; on the next run, treat the current iteration as first-review mode.

**PATCH concurrency**: if status PATCH returns 409 (author resolved mid-run), log and continue.

## Acceptance criteria

- [ ] No duplicate thread created when a matching prior thread exists
- [ ] All replies carry the canonical signature on their last line
- [ ] `addressed` threads PATCH status via `pullRequestThreads` (not `pullRequestThreadComments`)
- [ ] `disputed` replies include ADO nudge text
- [ ] `pending` threads skipped uniformly (inline and general)
- [ ] Completion marker is the final comment on every successful run
- [ ] Partial prior run detected on next run (no completion marker → first-review mode)
- [ ] `match-finding.mjs` returns correct match/null for overlap, drift, and no-match scenarios
- [ ] `pnpm --filter pr-review test` passes

## Blocked by

- `docs/issues/pr-review-rereview/04-incremental-diff-baseline.md`
- `docs/issues/pr-review-rereview/05-classify-existing-threads.md`
