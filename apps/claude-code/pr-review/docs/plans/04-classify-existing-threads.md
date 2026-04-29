# 04. Classify existing threads

**Status: pending**

- Priority: P1
- Effort: M
- Version impact: minor
- Depends on: 01
- Touches: `commands/review-pr.md`

## Context

Each prior Claude Code thread must be tagged so Step 10 knows whether to reply, ignore, or escalate.

## Current behaviour

Threads are not classified.

## Target behaviour

For every thread in `PRIOR_THREADS`, compute one of:

- `addressed` — the file/line still exists in the new diff but the originally flagged code is gone (heuristic: original anchor line no longer matches the snippet quoted in the bot comment).
- `disputed` — author replied in the thread (any comment whose `author.uniqueName` differs from the bot identity used by the plugin).
- `pending` — neither addressed nor disputed; line still shows the same code.
- `obsolete` — file no longer in PR diff at all (deleted upstream or excluded).

Author identity check uses the `createdBy.displayName` / `createdBy.uniqueName` fields from `pullRequestThreadComments`. The bot identity is whatever PAT the plugin runs as — capture it once during Step 3 (`az devops invoke --area connectionData …` or read from PR threads where Claude Code itself authored).

## Edge cases

- Mixed conversation (bot → author → bot): treat as `disputed` once any non-bot comment is present.
- General threads (no file): only `disputed` / `pending` apply.

## Implementation steps

1. Add a helper subroutine "classify thread" that takes the thread JSON + the new diff text + bot identity.
2. Run it for each `PRIOR_THREADS` entry; store results in `PRIOR_THREADS` under a new `classification` field.
3. Print a one-line summary count: `Threads: N addressed, N disputed, N pending, N obsolete`.

## Test cases

- Thread on a line that author has since deleted → `addressed`.
- Thread with an author reply → `disputed`.
- Thread on unchanged code, no replies → `pending`.
- Thread on a file the author removed from PR → `obsolete`.

## Acceptance criteria

- Every thread receives exactly one classification.
- Summary line printed before Step 6.

## Verification

- Replay against PR 5509 thread set; cross-check classifications against manual review notes:
  - `??` nullish coalescing thread → `disputed` (author replied and corrected the finding).
  - `build:static-pages` thread → `addressed` (author pushed iteration 3 fixing it).

## Out of scope

- Posting replies (spec 05).

## Follow-ups

— none —
