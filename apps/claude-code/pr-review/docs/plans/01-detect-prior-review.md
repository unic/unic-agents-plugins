# 01. Detect prior review on PR

**Status: pending**

- Priority: P0
- Effort: S
- Version impact: minor
- Depends on: 00
- Touches: `commands/review-pr.md`

## Context

A re-review must first know whether Claude Code already reviewed this PR. The signal is the canonical signature (spec 00) inside the body of any thread comment authored on the PR.

## Current behaviour

The command never inspects existing threads before posting. Re-runs duplicate every comment.

## Target behaviour

After Step 3 (PR metadata) and before Step 4 (iteration), the command runs a detection step that:

1. Calls `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={REPO_ID} pullRequestId={PR_ID} --org {ORG_URL} --api-version 7.1`.
2. Parses every thread's first comment `content` for the canonical signature substring.
3. Sets a boolean `IS_REREVIEW` and a list `PRIOR_THREADS` containing `{threadId, filePath, rightFileLine, content, status}`.
4. Logs a one-line summary: `Detected N prior Claude Code threads — re-review mode ON` (or `…OFF`).

## Edge cases

- Thread `status` may be `closed`/`fixed` (author resolved) — keep them in `PRIOR_THREADS` with their status; downstream specs decide how to treat each.
- Threads created by Claude Code that have no file context (general comments) appear too — keep `filePath = null` for them.
- A thread can have multiple comments; only the first comment carries the bot signature.

## Implementation steps

1. Insert a new section "Step 3.5: Detect prior review" with the API call and parsing logic.
2. Reuse the existing `az devops invoke` snippet style (write JSON to a temp file under `$TMPDIR`, parse with `jq`).
3. Export `IS_REREVIEW`, `PRIOR_THREADS_FILE` (jq-readable JSON path) for use by later steps.

## Test cases

- Against a PR with no prior review: `IS_REREVIEW=false`, `PRIOR_THREADS` empty.
- Against PR 5509 (known to have prior threads): `IS_REREVIEW=true`, count matches manual count.
- Against a PR where a human posted a comment quoting the signature: still detected (acceptable false positive — documented in Notes).

## Acceptance criteria

- Step 3.5 runs unconditionally and prints the summary line.
- No write actions occur during detection.

## Verification

- Dry-run on a PR with no prior review: confirm OFF path, command continues unchanged.
- Dry-run on PR 5509: confirm ON path, count of prior threads matches.

## Out of scope

- Acting on the detection (specs 02–06).

## Follow-ups

— none —
