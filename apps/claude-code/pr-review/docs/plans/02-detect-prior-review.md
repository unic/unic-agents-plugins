# 02. Detect prior review on PR

**Status: pending**

- Priority: P0
- Effort: S
- Version impact: minor
- Depends on: 01
- Touches: `commands/review-pr.md`

## Context

A re-review must first know whether Claude Code already reviewed this PR. The signal is the canonical signature prefix (spec 01) inside any thread comment on the PR. Detection must also identify the existing summary thread and parse the prior iteration number from the most recent bot comment, so later specs can act on that information.

## Current behaviour

The command never inspects existing threads before posting. Re-runs duplicate every comment.

## Target behaviour

After Step 3 (PR metadata) and before Step 4 (iteration), the command runs a detection step that:

1. Calls `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={REPO_ID} pullRequestId={PR_ID} --org {ORG_URL} --api-version 7.1`.
2. Follows pagination: if the response includes a `continuationToken`, repeat the call with `--query-parameters continuationToken={token}` until no token is returned. Collect all threads before proceeding.
3. For each thread, checks every comment's `content` for the signature prefix `🤖 *Reviewed by Claude Code*` (substring match — no `createdBy` identity check required).
4. For threads where a bot comment is found, captures:
   - `threadId`
   - `filePath` (from `threadContext.filePath`, or `null` for general threads)
   - `start: { line, offset }` (from `threadContext.rightFileStart`)
   - `end: { line, offset }` (from `threadContext.rightFileEnd`)
   - `comments` (full array)
   - `status` (ADO thread status integer)
   - `isSummaryThread` — `true` when `filePath` is `null` and the first comment begins with the prefix `## PR Review Summary` (substring match — the actual heading may include a ` — {PR_TITLE}` suffix)
5. Identifies the most recent bot comment across all prior threads and parses `PRIOR_ITERATION_ID` from its signature suffix (`— Iteration N`). When the suffix is absent (legacy format), sets `PRIOR_ITERATION_ID=null` — spec 03 resolves the actual ID via timestamp comparison against the iterations API.
6. Sets `IS_REREVIEW=true` and records `PRIOR_THREADS` and `SUMMARY_THREAD_ID`.
7. Logs a one-line summary: `Detected N prior Claude Code threads — re-review mode ON` (or `…OFF`).

## Edge cases

- Thread `status` may be `closed`/`fixed` — keep in `PRIOR_THREADS` with status; downstream specs decide how to act.
- General threads (no `threadContext`) have `filePath = null`, `start = null`, `end = null`. The summary thread is the general thread with `isSummaryThread = true`.
- A thread can have multiple comments; scan all of them for the signature prefix to confirm bot authorship.
- A human who quotes the signature string triggers a false positive — this is accepted and documented in Notes.
- Threads from a prior run that was interrupted (no completion marker) are included in `PRIOR_THREADS` normally; spec 06 detects the partial-run state from the missing completion marker.

## Implementation steps

1. Insert a new section "Step 3.5: Detect prior review" with the paginated API call and parsing logic.
2. Write thread JSON to a temp file under `$TMPDIR`; parse with `jq`.
3. Export `IS_REREVIEW`, `PRIOR_THREADS_FILE` (path to the jq-readable JSON file — downstream steps consume it as `jq ... < "$PRIOR_THREADS_FILE"`), `SUMMARY_THREAD_ID`, and `PRIOR_ITERATION_ID` for use by later steps. Within spec descriptions, `PRIOR_THREADS` refers to the in-memory thread collection; `PRIOR_THREADS_FILE` is the on-disk path used by the command layer.

## Test cases

- Against a PR with no prior bot comments: `IS_REREVIEW=false`, `PRIOR_THREADS` empty.
- Against a PR with prior bot comments across two pages (>100 threads): all threads collected, count matches total across both pages.
- Against a PR with a summary thread: `SUMMARY_THREAD_ID` set, `isSummaryThread=true` on that entry.
- Against a PR where a human quoted the signature: detected as prior review (accepted false positive).
- Against a PR with a multi-line inline thread: `start.line != end.line`, offsets preserved.

## Acceptance criteria

- Step 3.5 runs unconditionally and prints the summary line.
- All threads are fetched before proceeding (pagination loop complete).
- No write actions occur during detection.
- `isSummaryThread` is set on exactly one thread (or zero if no prior summary exists).

## Verification

- Dry-run on a PR with no prior review: confirm OFF path, command continues unchanged.
- Dry-run on a PR with known prior threads: confirm ON path, thread count matches ADO UI.

## Out of scope

- Acting on the detection (specs 03–07).

## Notes

Detection is signature-prefix only. There is no `createdBy` bot-identity check. This makes detection PAT-agnostic: it works correctly regardless of which team member's credentials were used to post the original review.

## Follow-ups

— none —
