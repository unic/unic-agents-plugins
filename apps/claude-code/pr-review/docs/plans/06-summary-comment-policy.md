# 06. Summary comment policy on re-review

**Status: pending**

- Priority: P1
- Effort: S
- Version impact: minor
- Depends on: 05
- Touches: `commands/review-pr.md`

## Context

Step 11 posts a long summary comment. On re-review we don't want a second one.

This spec encodes explicit user feedback received during PR 5509 re-review: *"Refrain from publishing another general comment, only inline or files comments and only if the findings aren't yet commented."*

## Current behaviour

Summary always posted at the end of the run.

## Target behaviour

- `IS_REREVIEW=false`: behaviour unchanged.
- `IS_REREVIEW=true` and at least one of {new threads created, addressed/disputed replies posted}: post a short delta comment titled `🤖 *Reviewed by Claude Code* — Re-review delta (Iteration N)` containing only:
  - Counts: `X new findings, Y resolved, Z disputed, W pending`.
  - Bullet list of new finding titles only (linked to their threads).
- `IS_REREVIEW=true` and nothing changed (early-exit from spec 03, or all matches were `pending` and unchanged): post **nothing** at the summary level.

## Implementation steps

1. Track counters during Step 10 and feed them to Step 11.
2. Branch Step 11 on `IS_REREVIEW` and on the change counters.
3. Update Step 11's signature line and footer to use the canonical signature from spec 00.

## Test cases

- First-time review: full summary posted (regression check).
- Re-review with zero changes: zero summary posted.
- Re-review with one new commit and one resolved finding: delta summary posted with `1 new, 1 resolved, 0 disputed, … pending`.

## Acceptance criteria

- Re-review never produces a second long-form summary.
- Delta summary, when posted, fits under 30 lines.

## Verification

- Diff PR 5509 comment list before / after a re-run on this branch — confirm at most one delta comment was added.

## Out of scope

- Versioning + docs (spec 07).

## Follow-ups

— none —
