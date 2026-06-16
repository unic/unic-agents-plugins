# 0016. Human Threads are read-only review context, never a suppression signal

**Status:** Accepted (2026-06)

## Context

The ADO Fetcher fetches every PR Thread but classifies them on a single axis: does `comments[0].content` carry the Iteration Marker (a Bot Thread, ADR-0006) or not. In `first-review` mode the fetched Threads are then dropped — no step reads them — and in `re-review` only Bot Threads feed the Re-review Coordinator's `priorFindings`. Human review discussion is invisible to a Review in every Mode.

This surfaced in a head-to-head against the legacy `pr-review` plugin on ADO PR #5570. That plugin read the five Human Threads on the PR, cross-referenced a Finding to a still-open one, and noted a Thread marked *fixed* whose issue was in fact still present ("re-verify before merge"). `unic-pr-review` could surface none of this — a structural gap, not a fetch failure.

The tempting fix — let a resolved Human Thread suppress or down-rank a matching Finding — is the mirror image of the work-item-discovery false negative (issue #247): where that bug made the Plugin *under-gather intent*, suppression would make it *under-report code issues*. A wrongly-resolved Thread would silently hide a real defect.

## Decision

Human Threads are **read-only context**, surfaced after the aspect fan-out and never used to suppress a Finding.

1. **Classification.** The Fetcher gains a human/system split alongside the existing bot detection: *Bot Thread* = Iteration Marker (ADR-0006); *System Thread* = `comments[0].commentType === "system"` (ref updates, votes, policy); *Human Thread* = neither. Only Human Threads are surfaced; System Threads are never shown to the Reviewer.

2. **Context-only, never suppress.** A Finding is never dropped or down-ranked because a Human Thread exists. Confidence < 60 remains the sole filter (ADR-0002).

3. **Post-fan-out matching, agents untouched.** Human Threads are not injected into Review Aspect agent prompts (no anchoring, no per-agent token cost, no change to the Spawn Set / ADR-0008). After the fan-out, a deterministic step matches Findings to Human Threads by `filePath` + line proximity and annotates the matched Finding ("overlaps open Human Thread #N").

4. **Status drives the Notice, not the Finding.** Unresolved Human Threads (`active` / `pending`) that no Finding matched are listed in a Notice above the Intent Check. Resolved Human Threads (`fixed` / `wontFix` / `closed` / `byDesign`) are **not** listed, but are still matched — a Finding overlapping a resolved Thread is annotated "Thread #N marked fixed but issue still present — re-verify." A Human Thread with no `threadContext` (a general, non-inline comment) cannot match a Finding; when unresolved it goes straight to the Notice.

5. **Both Modes; never write.** This applies in `first-review` (and `first-review-fallback`) and `re-review`. In `re-review` the Re-review Coordinator additionally receives Human Threads, but emits **zero** `threadActions` for them — the ADO Writer only ever replies to / resolves / reopens Bot Threads. No bot comment ever lands on a Human Thread in any Mode. Pre-PR Mode is unaffected (no ADO Threads).

## Considered alternatives

- **Suppress or down-rank Findings that duplicate a resolved Human Thread.** Rejected — introduces a second, human-driven suppression mechanism alongside Confidence (ADR-0002) and risks under-reporting when a Thread was resolved in error. Annotation captures the same signal without ever hiding a Finding.
- **Inject Human Threads into every aspect agent prompt** (as with the Intent Brief / re-review `priorFindings`). Rejected — adds tokens to all aspect agents and anchors their Findings to what humans already said; prose Threads also match poorly inside parallel agents. Post-fan-out matching keeps the agents pure.
- **Summary Notice only, no per-Finding linkage.** Rejected — loses the "this Finding = open Thread #N" cross-reference that was the legacy plugin's strongest signal.
- **first-review only.** Rejected — the gap exists in re-review too; the cost is the Coordinator's input contract growing by one read-only field, which is acceptable given the write boundary keeps it inert.

## Consequences

- The ADO Fetcher's output gains a classified Human Thread list (`{ threadId, filePath, startLine, status, excerpt }`), distinct from `priorFindings`.
- A new post-fan-out matching step (a pure, tested function) annotates Findings and produces the Human-Thread Notice; the Review Summary renderer gains that Notice source.
- The Re-review Coordinator's input contract grows by a read-only `humanThreads` field; its `threadActions` output is unchanged and never references a Human Thread.
- The ADO Writer is unchanged — it already only targets Bot Threads; this ADR records that boundary as deliberate.
- Confidence (ADR-0002) remains the only mechanism that removes a Finding from the Review.
