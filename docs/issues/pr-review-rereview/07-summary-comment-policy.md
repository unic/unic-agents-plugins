# Summary comment policy on re-review

**Status:** closed
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Branch Step 11 of `commands/review-pr.md` so re-reviews never post a second full-length summary. Instead, when there is something to report, a compact delta reply is posted to the existing summary thread.

**Behaviour by case:**

- `IS_REREVIEW=false`: full summary posted in a new thread — unchanged from before.
- `IS_REREVIEW=true` and at least one of {new threads created, addressed replies, disputed replies}: post a reply to the existing summary thread (identified by `SUMMARY_THREAD_ID` from the detection step) with:
  - Counts only: `X new findings, Y resolved, Z disputed, W pending`
  - Bullet list of new finding titles linked to their threads
  - No prose, no section headings beyond the title line
- `IS_REREVIEW=true` and nothing changed: post nothing at the summary level.
- Prior summary thread not found (deleted by human): fall back to first-review mode and post a new full summary.

Track the action counters (new threads, addressed replies, disputed replies) during Step 10 and feed them into Step 11. The delta reply uses `pullRequestThreadComments` against `SUMMARY_THREAD_ID`.

## Acceptance criteria

- [ ] First-time review posts full summary in a new thread (regression check)
- [ ] Re-review with activity posts a delta reply to the existing summary thread — not a new thread
- [ ] Re-review with no activity posts nothing
- [ ] Delta reply contains counts and bullet list only — no prose paragraphs
- [ ] Fallback to full summary when prior summary thread is absent

## Blocked by

`docs/issues/pr-review-rereview/06-reply-to-threads.md`
