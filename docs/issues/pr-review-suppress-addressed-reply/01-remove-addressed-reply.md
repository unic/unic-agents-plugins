# Remove addressed-thread Reply + revise ADR 0006

**Status:** needs-triage
**Category:** enhancement
**Type:** AFK

## Parent

`docs/issues/pr-review-suppress-addressed-reply/PRD.md`

## What to build

Remove the Reply POST from the `addressed` branch of the re-review flow in the main review command. The thread status PATCH to `fixed` (status 2), the `FINDINGS_POSTED` increment, and the `ADDRESSED_COUNT` increment must all remain untouched.

Update the `addressed` branch section heading to no longer reference "confirm resolution".

Revise ADR 0006 (`0006-reply-not-duplicate-auto-resolve.md`) to remove the requirement to post a Reply for `addressed` threads. Add a `**Revised:**` note with the date and the reason: notification spam; developers self-resolve most threads, causing the bot to comment on already-closed threads.

## Acceptance criteria

- [ ] During a re-review, no Reply comment is posted to threads classified as `addressed`.
- [ ] During a re-review, `addressed` threads are still PATCHed to `fixed` (status 2) in ADO.
- [ ] `ADDRESSED_COUNT` is still incremented for each `addressed` thread and reflected correctly in the Step 11 delta summary.
- [ ] `FINDINGS_POSTED` is still incremented for each `addressed` thread.
- [ ] `disputed`, `pending`, and `obsolete` branch behavior is unchanged.
- [ ] ADR 0006 no longer states that a Reply is required for `addressed` threads.
- [ ] The `addressed` branch section heading no longer references "confirm resolution".

## Blocked by

None — can start immediately.
