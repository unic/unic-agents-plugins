# 05. Classify existing threads

**Status: done — 2026-05-06**

- Priority: P1
- Effort: M
- Version impact: minor
- Depends on: 02
- Touches: `commands/review-pr.md`

## Context

Each prior bot thread must be tagged so Step 10 knows whether to reply, skip, or auto-resolve. Classification uses ADO thread status as the primary signal and diff-hunk intersection as a secondary signal. No comment-text analysis is performed.

## Current behaviour

Threads are not classified.

## Target behaviour

For every thread in `PRIOR_THREADS`, compute one of:

- `addressed` — ADO thread `status` is one of `fixed` (2), `wontFix` (3), `closed` (4), or `byDesign` (5), **OR** the thread `status` is `active` (1) or `pending` (6) and the thread's line range intersects a changed hunk in the incremental diff (spec 04). ADO `pending` (6) is treated the same as `active` — it is not auto-addressed; diff intersection is still required.
- `disputed` — `status` is `active` AND at least one comment in the thread does not contain the signature prefix `🤖 *Reviewed by Claude Code*`.
- `pending` — `status` is `active` AND no comment in the thread lacks the signature prefix (i.e. only bot comments present).
- `obsolete` — the thread's `filePath` does not appear in the PR diff at all (or `filePath` is null and the thread is not the summary thread).

ADO status codes: 1 = active, 2 = fixed, 3 = wontFix, 4 = closed, 5 = byDesign, 6 = pending.

**Line-range intersection** (for the secondary `addressed` signal): a thread is considered intersecting a hunk when `max(thread.start.line, hunk.startLine) ≤ min(thread.end.line, hunk.endLine)`. Use line numbers only; offsets are not used in intersection logic.

**Human reply detection** (for `disputed`): a comment is human-authored when its `content` does not contain the substring `🤖 *Reviewed by Claude Code*`. No `createdBy` identity check is performed — this makes classification PAT-agnostic.

## Edge cases

- General threads (`filePath = null`) that are not the summary thread: `addressed` and `obsolete` do not apply. Classify as `disputed` or `pending` only.
- The summary thread (`isSummaryThread = true`): skip classification entirely; it is handled by spec 07.
- Multi-line threads: intersection check uses the full `[start.line, end.line]` range.
- Threads where the entire file was deleted from the PR: `obsolete`.

## Implementation steps

1. Extract diff hunk boundaries from Step 5 output (file path, start line, end line per hunk).
2. For each `PRIOR_THREADS` entry (skipping the summary thread), apply the classification logic above.
3. Store results in `PRIOR_THREADS` under a new `classification` field.
4. Print a one-line summary count: `Threads: N addressed, N disputed, N pending, N obsolete`.

## Test cases

- Thread whose line range intersects a changed hunk (status active) → `addressed`.
- Thread with ADO status `fixed` (no diff intersection needed) → `addressed`.
- Thread with a human reply (no signature prefix in that reply) → `disputed`.
- Thread with only bot comments and no diff intersection → `pending`.
- Thread on a file not in the diff → `obsolete`.
- Thread spanning lines 10–15 with a hunk at lines 12–13 → `addressed`.
- General thread (no file) with no human reply → `pending`.

## Acceptance criteria

- Every non-summary thread receives exactly one classification.
- Summary thread is skipped.
- Summary count line printed before Step 6.

## Verification

- Run the command against a PR where one thread was addressed, one disputed, one pending, and one is on a deleted file — confirm all four classifications appear in the summary count.

## Out of scope

- Posting replies (spec 06).

## Notes

The `disputed` reply template (spec 06) will remind the author to mark the thread resolved in ADO when they consider the conversation done.

## Follow-ups

— none —
