# Classify existing threads + extract classify-thread module

**Status:** resolved
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Add thread classification to the re-review flow and extract the logic into a standalone `scripts/re-review/classify-thread.mjs` module that the command calls via Bash.

**`classify-thread.mjs`** — pure function. Given a prior thread object and the diff hunk JSON from the previous step, returns one of four states:

- `addressed` — ADO thread status is one of `fixed` (2), `wontFix` (3), `closed` (4), or `byDesign` (5), **or** status is `active` (1) or `pending` (6) and the thread's line range (`[start.line, end.line]`) intersects a changed hunk (`max(thread.start, hunk.start) ≤ min(thread.end, hunk.end)`). ADO `pending` (6) is treated like `active` — diff intersection is required. Line numbers only — offsets not used in intersection logic.
- `disputed` — status is `active` and at least one comment in the thread does not contain the signature prefix `🤖 *Reviewed by Claude Code*`. No `createdBy` identity check.
- `pending` — status is `active` and no comment lacks the signature prefix.
- `obsolete` — the thread's `filePath` is not present in the diff at all.

The summary thread (`isSummaryThread = true`) is skipped — classification does not apply to it.

After classifying all threads, the command prints a one-line summary: `Threads: N addressed, N disputed, N pending, N obsolete`.

The module ships with a `node:test` test file covering all four states, multi-line range intersection, general threads (filePath null), and ADO status codes.

## Acceptance criteria

- [ ] Every non-summary prior thread receives exactly one classification
- [ ] Summary thread skipped
- [ ] Classification summary line printed before Step 6
- [ ] `classify-thread.mjs` returns correct state for all four scenarios
- [ ] ADO status codes 2–5 (fixed, wontFix, closed, byDesign) auto-map to `addressed`; status 6 (ADO pending) requires diff intersection like `active`
- [ ] Human reply detection uses signature prefix only — no identity check
- [ ] `pnpm --filter pr-review test` passes

## Blocked by

`docs/issues/pr-review-rereview/02-detect-prior-review.md`
