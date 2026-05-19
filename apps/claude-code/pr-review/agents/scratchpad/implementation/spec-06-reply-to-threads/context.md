# Context — spec-06: Reply to threads instead of duplicating

## Source

Spec file: `docs/plans/06-reply-to-threads.md`
Working file: `commands/review-pr.md`
Version impact: **minor**

## What must change

Currently Step 10 always creates a fresh `pullRequestThreads` POST for every finding.
On re-review, it must instead **match** each finding against a prior thread (from PRIOR_THREADS_FILE, populated in Step 3.5 and classified in Step 5.5), then take one of five actions depending on the thread's `classification` field.

### Thread matching

For each finding:

1. Exact `filePath` match.
2. Line-range overlap: `max(finding.start, thread.start) <= min(finding.end, thread.end)` with ±3 line drift (expand both ranges by 3 before testing).
3. If no match → new thread, create via `pullRequestThreads` POST as today.

### Five actions by classification

| Classification                      | Action                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pending` (unchanged finding)       | **Skip** — do not post                                                                          |
| `pending` (new evidence in finding) | **Reply** via `pullRequestThreadComments` POST with new evidence only                           |
| `disputed`                          | **Reply** acknowledging author's point; include ADO nudge to mark resolved                      |
| `addressed`                         | **Reply** "Resolved as of Iteration N — thanks!" then PATCH thread status to `fixed` (status=2) |
| `obsolete`                          | Leave alone — no action                                                                         |

### Completion marker

After all Step 10 replies and Step 11 delta summary reply, post one final reply to summary thread:

```
✅ Review complete — Iteration {LATEST_ITERATION_ID} ({N} findings posted)
```

Absence of this marker for LATEST_ITERATION_ID = partial prior run → treat as first-review mode on next run.

### ADO API resources

- Reply: POST `--resource pullRequestThreadComments` with `--route-parameters … threadId={id}`
- Status PATCH: PATCH `--resource pullRequestThreads` with `--route-parameters … threadId={id}`, body `{ "status": 2 }`
- 409 on PATCH = concurrent resolution by human → log and continue

### Edge cases

- No reply cap (post all regardless of count)
- `pending` general threads (no file): skip
- 409 on PATCH: log and continue
- Partial prior run (no completion marker): skip thread matching, treat as first-review

## Prior state (from previous specs)

- IS_REREVIEW, PRIOR_THREADS_FILE, PRIOR_ITERATION_ID set in Step 3.5
- DIFF_HUNKS_FILE set in Step 5
- PRIOR_THREADS_FILE has `classification` field added in Step 5.5
- SUMMARY_THREAD_ID set in Step 3.5 (for completion marker)

## Constraints

- Out of scope: summary comment behaviour (spec 07)
- Only touch `commands/review-pr.md`
- Tabs for indentation, LF line endings
