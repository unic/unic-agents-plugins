# 0015. Write Retry completes a partially-written Iteration

**Status:** Accepted (2026-06)

## Context

A `--post` write can partially fail: the ADO Writer posts inline Review Threads and the Review Summary one at a time, and a transient network/auth error can leave some Findings posted and others not (`success: false`). ADR-0014 made the Approval Loop state directory survive such a failure so the run is resumable, and `commands/review-pr.md` Step 1.12 tells the Reviewer to re-run `--post` (not `--yes`) to "re-post only the threads that failed."

That promise was unimplemented, and the actual behaviour was worse than a no-op:

- Every bot comment carries an Iteration Marker (`renderFooter`, ADR-0006), so any partially-posted attempt leaves a marker on the PR.
- On re-run, the ADO Fetcher detects that marker → `hasPriorSignature = true` → `detectMode` routes to **re-review** (ADR-0009).
- Re-review uses a delta diff against the prior reviewed Revision (ADR-0007). On an immediate retry HEAD is unchanged, so the delta is **empty** → the aspect agents regenerate **zero** Findings → the Findings that failed to post are **silently dropped**, never retried.
- Re-review also skips the Approval Loop (Step 1.11), so the saved first-review approval state (ADR-0014) is never consulted, and the Summary is rewritten to a new Iteration.
- Duplicate comments — the original framing of issue #236 — only occur in the narrow `first-review-fallback` case (a force-push between attempt and retry re-posts everything against surviving threads).

The root gap: nothing distinguished "Iteration N was fully written" from "Iteration N half-failed," so a re-run always treated a prior marker as "time for the next Iteration."

## Decision

Introduce **Write Retry**: a re-run of `--post` that finishes a partially-written Iteration rather than starting a new one.

1. **Incomplete signal — reuse the local state directory (ADR-0014).** The state directory `<cwd>/.unic-pr-review/<key>/` is deleted only on a fully-successful write, so its presence on re-run means the prior `--post` did not complete. No new server-side marker is introduced. (Limitation: the signal is local — a retry from a different clone has no state and falls back to normal mode detection. Documented, accepted.)

2. **Staleness guard.** The Write Retry short-circuit fires only when the saved `headSha` in `state.json` equals the current HEAD. If HEAD moved, the partial attempt is stale: discard the state directory, print a Notice, and proceed as a normal Review (mode detection against the new HEAD).

3. **Short-circuit routing.** When the state directory is present and HEAD matches, the orchestrator skips the Fetcher, mode detection, and the aspect fan-out entirely. It resumes the Approval Loop (which re-prompts nothing — all decisions are already saved) at the **same** Iteration number stored in `state.json`.

4. **Dedup is local; the Writer stays mostly dumb.** After a write, each Finding's post outcome (`threadId` / success) and a `summaryPosted` flag are persisted into `state.json`. On retry the orchestrator passes the Writer only the Findings that did not already post, and sets `summaryAlreadyPosted` so the Writer skips the Summary (Step 3) when it already landed. On a first attempt the posted-map is empty, so behaviour is unchanged. A fully-successful retry then deletes the state directory per ADR-0014.

## Considered alternatives

- **Server-side completion marker** (a thread property or hidden `complete=N` comment). Rejected as the primary mechanism — it adds ADO surface and a second marker to maintain alongside the Iteration Marker, and still needs local state for the approved Findings to re-post. The local state directory already encodes "incomplete" for free.
- **Fully idempotent Writer** that matches every Finding against existing Threads by an embedded Finding id in both modes. Rejected as over-built for how rare a partial write is; it changes the comment format and the Writer's read path. Left as a possible future hardening.
- **Honest-promise-only**: correct the Step 1.12 wording and punt on retry. Rejected because ADR-0014 already invested in keeping resumable state; not wiring the resume leaves that investment dead.

## Consequences

- `state.json` gains a per-Finding post outcome and a `summaryPosted` flag (written by the orchestrator after the Writer returns, via a small tested helper).
- The ADO Writer's first-review input gains an optional `summaryAlreadyPosted` flag; everything else is unchanged.
- The orchestrator gains a top-of-flow Write Retry check (state directory present + `headSha` match) before the Fetcher.
- Cross-machine retry is **not** covered: without the local state directory the re-run still routes to re-review. Acceptable given the resume contract was already local (ADR-0014).
- The Step 1.12 warning is rewritten to describe Write Retry accurately and to state the cross-machine and HEAD-moved caveats.
