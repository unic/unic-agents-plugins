# Create Re-review Coordinator agent

**Status:** needs-triage
**Category:** enhancement

## Parent

`docs/issues/pr-review-orchestrator-split/PRD.md`

## What to build

Create a new plugin agent (`pr-review:re-review-coordinator`) that owns the full re-review state machine. The agent receives the ADO Fetcher context block, the raw prior-threads JSON, and the diff hunks file path.

It performs in order:

1. Calls the `detect-prior-review` Node.js module to identify prior bot threads and locate the summary thread.
2. Runs the partial-run check (looks for the completion marker for the prior iteration in the summary thread). Falls back to first-review mode if the marker is absent.
3. If no new commits exist since the prior review (prior commit SHA equals latest commit SHA), prints outstanding pending threads to the console and exits early — no ADO writes.
4. Calls `classify-thread` on each prior thread against the diff hunks.
5. For each new finding passed in, calls `match-finding` to look for a matching prior thread.
6. Based on classification, posts replies to prior threads: acknowledges disputes, confirms resolutions (and PATCHes thread status to fixed), adds new evidence to pending threads with new information, skips pending threads with no new evidence, ignores obsolete threads.
7. Returns the classification counts (new, addressed, disputed, pending) and the updated findings list (unmatched findings pass through as fresh; matched findings are consumed).

The four Node.js modules (`detect-prior-review`, `classify-thread`, `match-finding`, `parse-signature`) remain in `scripts/re-review/` unchanged. This agent calls them via `node --input-type=module` inline scripts, exactly as the current `review-pr.md` does.

## Acceptance criteria

- [ ] The agent correctly detects prior bot threads using the `detect-prior-review` module
- [ ] The agent falls back to first-review mode when no completion marker is found for the prior iteration
- [ ] The agent exits early (console output only, no ADO writes) when prior and latest commit SHAs are identical
- [ ] The agent classifies all prior threads using the `classify-thread` module
- [ ] The agent matches new findings to prior threads using the `match-finding` module with ±3-line drift tolerance
- [ ] The agent posts a dispute acknowledgement reply to disputed threads including the ADO nudge
- [ ] The agent posts a resolution confirmation reply and PATCHes status to fixed for addressed threads
- [ ] The agent posts a new-evidence reply to pending threads that have new analysis; skips pending threads with no new evidence
- [ ] The agent returns classification counts and the unmatched (fresh) findings list
- [ ] The existing re-review module unit tests (`detect-prior-review`, `classify-thread`, `match-finding`, `parse-signature`) pass unchanged

## Blocked by

None — can start immediately.
