# 07. Summary comment policy on re-review

**Status: pending**

- Priority: P1
- Effort: S
- Version impact: minor
- Depends on: 06
- Touches: `commands/review-pr.md`

## Context

Step 11 posts a long summary comment. On re-review we do not want a second one. This spec encodes explicit user feedback: *"Refrain from publishing another general comment, only inline or file comments and only if the findings aren't yet commented."*

The existing summary thread is identified by the `isSummaryThread = true` flag set in spec 01. The delta comment is posted as a **reply to that thread**, not as a new general thread. This keeps the PR conversation to a single summary entry.

## Current behaviour

Summary always posted at the end of the run.

## Target behaviour

- `IS_REREVIEW=false`: behaviour unchanged — post full summary as the first comment in a new thread.
- `IS_REREVIEW=true` and at least one of {new threads created, addressed/disputed replies posted}: post a reply to the existing summary thread titled `🤖 *Reviewed by Claude Code* — Re-review delta (Iteration {N})` containing only:
  - Counts: `X new findings, Y resolved, Z disputed, W pending`.
  - Bullet list of new finding titles only (each linked to its thread).
  - No prose, no section headings beyond the title.
- `IS_REREVIEW=true` and nothing changed (early-exit from spec 03, or all matches were `pending` and unchanged): post **nothing** at the summary level.

If the prior summary thread is not found (e.g. it was deleted by a human), fall back to first-review mode: post a full summary as a new thread.

## Implementation steps

1. Track counters during Step 10: new threads, addressed replies, disputed replies.
2. Feed counters to Step 11.
3. Branch Step 11 on `IS_REREVIEW` and the counters.
4. When posting the delta, use `SUMMARY_THREAD_ID` from spec 01 to reply via `pullRequestThreadComments`.
5. Update Step 11's signature line to use the canonical form from spec 00.

## Test cases

- First-time review: full summary posted in a new thread (regression check).
- Re-review with zero changes: no summary or delta posted.
- Re-review with one new commit and one resolved finding: delta reply posted to existing summary thread with `1 new, 1 resolved, 0 disputed`.
- Prior summary thread deleted: falls back to full summary in a new thread.

## Acceptance criteria

- Re-review never produces a second full-length summary.
- Delta reply, when posted, contains only counts and a bullet list — no prose sections.
- Delta is a reply to the existing summary thread, not a new general thread.

## Verification

- Run a re-review against a PR with an existing summary thread — confirm the thread gains one reply (the delta) and no new general thread was created.

## Out of scope

- Versioning and docs (spec 07).

## Follow-ups

— none —
