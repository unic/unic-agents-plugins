# 05. Reply to threads instead of duplicating

**Status: pending**

- Priority: P0
- Effort: M
- Version impact: minor
- Depends on: 04
- Touches: `commands/review-pr.md`

## Context

Step 10 posts inline comments via `pullRequestThreads` (creates a new thread). On re-review we must reuse existing threads via `pullRequestThreadComments` instead.

## Current behaviour

Every finding becomes a fresh thread, regardless of whether one already exists at that file/line.

## Target behaviour

Per finding:

1. Match the finding to a `PRIOR_THREADS` entry by `(filePath, rightFileLine)` or by stable rule id where available.
2. If matched and prior `classification` is:
   - `pending` and the finding is unchanged → **skip** (do not re-post).
   - `pending` and the finding has new evidence → **reply** via `az devops invoke --area git --resource pullRequestThreadComments --route-parameters project={project} repositoryId={REPO_ID} pullRequestId={PR_ID} threadId={id} --org {ORG_URL} --api-version 7.1` with a body starting `🤖 *Reviewed by Claude Code* — Iteration N` and containing only the new evidence.
   - `disputed` → **reply** acknowledging the author's argument; never re-assert without explicit new info.
   - `addressed` → **reply** with `Resolved as of iteration N — thanks!` and PATCH the thread `status` to `fixed`.
   - `obsolete` → leave alone.
3. If no match: brand-new finding. Create a fresh thread as before, but include `Iteration N` in the first line so future re-reviews can date it.

## Edge cases

- Concurrency: if the author resolves a thread mid-run, the PATCH to `status=fixed` may 409 — log and continue.
- Reply rate limiting: cap replies at 50 per run; if exceeded, fall back to a single summary table comment listing the remainder.

## Implementation steps

1. Add the matching function (filePath + rightFileLine equality; fall back to fuzzy snippet match if line drifted by ≤ 3).
2. Branch Step 10 on `IS_REREVIEW`.
3. Wire the four classification branches.
4. Always include `Iteration N` in the first line of any new comment so spec 04 is cheaper next time.

## Test cases

- Re-running on PR 5509 with no code changes: zero new comments posted, zero replies (all matched threads are `pending` and unchanged).
- Re-run after author fixes one finding: one `addressed` reply, thread marked fixed.
- Re-run after author replies to one finding: one `disputed` acknowledgement.
- Re-run with one new commit introducing a new issue: one fresh thread.

## Acceptance criteria

- No duplicate thread is ever created when a matching prior thread exists.
- Replies always carry the canonical signature on their first line.

## Verification

- Inspect PR 5509 after a fresh re-run with this branch: comment count must not have grown unless a new commit is present.

## Out of scope

- Summary comment behaviour (spec 06).

## Follow-ups

— none —
