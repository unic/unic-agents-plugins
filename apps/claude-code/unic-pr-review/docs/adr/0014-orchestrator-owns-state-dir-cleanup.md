# 0014. Orchestrator owns Approval Loop state-directory cleanup

**Status:** Accepted (2026-06)

## Context

The Approval Loop persists its per-PR decisions under `.unic-pr-review/<key>/state.json` so a run is resumable (ADR-0003), and the `review-pr` orchestrator deletes that directory at the end of the `--post` path (Step 1.13) **only when the ADO Writer reports `success: true`** — leaving it intact on a failed write so a `--post` (not `--yes`) re-run resumes the saved decisions. ADR-0006 and `agents/ado-writer.md` both rely on this "keep-on-failure-for-retry" promise.

But `approval-loop.mjs` also ran an **unconditional** `rmSync(stateDir)` as soon as it finished capturing decisions — *before* the ADO Writer runs. The loop's self-cleanup therefore contradicted the orchestrator's success-gated cleanup: on an ADO write failure the state directory was already gone, so the documented retry-resume could never actually resume. (The bug was masked in practice because the Step 1.13 cleanup one-liner crashed on an undefined env var — see #227 — so neither deleter behaved as documented.)

Two approaches were considered:

- **Loop owns cleanup.** Rejected — the loop runs before the write-back and cannot know whether the write succeeded, so it cannot honour the keep-on-failure-for-retry contract.
- **Orchestrator owns cleanup.** Accepted — only the orchestrator sees the ADO Writer result, so only it can gate deletion on `success: true`.

## Decision

The Approval Loop (`approval-loop.mjs`) **never deletes its own state directory**. It only writes resumable state and the approved-Findings file.

Deletion of `.unic-pr-review/<key>/` is owned **solely** by the `review-pr` orchestrator at Step 1.13, gated on the ADO Writer reporting `success: true`. On a failed write the directory is left in place so a `--post` re-run resumes the saved decisions. The orchestrator builds the directory path via `getApprovalStateDir()` in `scripts/lib/cache-paths.mjs` rather than hand-rebuilding it.

## Consequences

- The unconditional `rmSync(stateDir)` block in `approval-loop.mjs` is removed; `approval-loop.test.mjs` is updated to assert the loop no longer deletes the state directory.
- A genuine error that stops the orchestrator before Step 1.13 (e.g. the Approval Loop exits non-zero) leaves the state directory behind — acceptable, since that is exactly the resumable case.
- The keep-on-failure-for-retry promise in ADR-0006 and `ado-writer.md:78` is now actually honoured by the code, not just documented.
- This ADR does **not** address the separate concern that first-review re-posting re-sends *all* approved Findings on retry (risking duplicate ADO comments); that is tracked as its own issue.
