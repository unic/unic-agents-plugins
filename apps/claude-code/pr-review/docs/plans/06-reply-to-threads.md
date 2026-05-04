# 06. Reply to threads instead of duplicating

**Status: pending**

- Priority: P0
- Effort: M
- Version impact: minor
- Depends on: 04, 05
- Touches: `commands/review-pr.md`

## Context

Step 10 posts inline comments via `pullRequestThreads` (creates a new thread). On re-review we must reuse existing threads: reply via `pullRequestThreadComments` and PATCH thread status via `pullRequestThreads` when resolving.

## Current behaviour

Every finding becomes a fresh thread regardless of whether one already exists at that file/line range.

## Target behaviour

### Thread matching

For each finding, attempt to match a prior thread by:

1. `filePath` equality (exact match).
2. Line-range overlap: `max(finding.start.line, thread.start.line) ≤ min(finding.end.line, thread.end.line)`, with a ±3 line drift tolerance applied to both endpoints (i.e. expand each range by 3 lines before testing overlap).

If no match is found, the finding is new — create a fresh thread as in the current flow.

### Reply actions per classification

| Classification | Action |
|---|---|
| `pending` (unchanged finding) | **Skip** — do not post. |
| `pending` (new evidence in finding) | **Reply** via `pullRequestThreadComments` with only the new evidence. |
| `disputed` | **Reply** acknowledging the author's point; never re-assert without new evidence. Include: *"If you consider this resolved, please mark the thread as fixed in Azure DevOps."* |
| `addressed` | **Reply** with `Resolved as of Iteration N — thanks!` then **PATCH** thread status to `fixed` via `pullRequestThreads`. |
| `obsolete` | Leave alone — no action. |

### ADO API resources

- **Reply content** (add a comment to an existing thread): POST to `--resource pullRequestThreadComments` with `--route-parameters … threadId={id}`.
- **Thread status PATCH** (mark as fixed): PATCH to `--resource pullRequestThreads` with `--route-parameters … threadId={id}`. Body: `{ "status": 2 }`. ADO status codes: 1 = active, 2 = fixed, 3 = wontFix, 4 = closed, 5 = byDesign, 6 = pending.
- If the PATCH returns a 409 (concurrent resolution by human), log and continue.

### New findings on re-review

Fresh threads (no prior match) are created as in the current flow. The first comment body does **not** include a separate "Iteration N" header line — the iteration is carried by the signature suffix: `🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}`.

### Run completion marker

After all threads and replies are posted, post one final reply to the summary thread:

```
✅ Review complete — Iteration {LATEST_ITERATION_ID} ({N} findings posted)
```

This is the last action of every successful run (first review or re-review). Its absence for `LATEST_ITERATION_ID` signals a partial prior run; on the next run, treat the current iteration as a first-time review.

## Edge cases

- **No reply cap.** Post all replies regardless of count.
- **`pending` general threads** (not the summary thread, no file): skip — same rule as inline `pending`.
- **Concurrency:** PATCH to `status=fixed` may 409 if author resolved the thread mid-run — log and continue.
- **Partial prior run detected** (no completion marker for `LATEST_ITERATION_ID`): treat as first-review mode; skip thread matching for this iteration.

## Implementation steps

1. Add the matching function (file path equality + range overlap with ±3 line drift).
2. Branch Step 10 on `IS_REREVIEW`.
3. Wire the five classification branches (pending-skip, pending-reply, disputed, addressed, obsolete).
4. Add the completion marker reply as the final action after Step 11 (delta summary reply) completes — the posting order is: inline thread replies (Step 10) → delta summary reply (Step 11) → completion marker.

## Test cases

- Re-review with no new commits: spec 04 exits early before Step 10 is reached.
- Re-review where author fixed one finding (ADO status fixed): one `addressed` reply posted, thread patched to fixed.
- Re-review where author replied to one finding: one `disputed` acknowledgement with ADO nudge.
- Re-review with one new commit introducing a new issue: one fresh thread posted with signature suffix.
- Re-review with no partial-run marker: treated as first-review mode for this iteration.
- Multi-line thread at lines 10–15 matched by finding at lines 12–13: match found, range overlap confirmed.

## Acceptance criteria

- No duplicate thread is ever created when a matching prior thread exists.
- All replies carry the canonical signature on their last line.
- Completion marker is the final comment posted on every successful run.

## Verification

- Inspect a PR after a fresh re-run — comment count must not have grown unless a new commit is present or an addressed/disputed reply was warranted.

## Out of scope

- Summary comment behaviour (spec 07).

## Follow-ups

— none —
