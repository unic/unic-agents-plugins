# 0018. Fan-out resilience — trust the harness, surface partial failure as a Notice

**Status:** Accepted (2026-05)
**Context:** Amends ADR 0015 (canonical HTTP-tier mapping — no-retry doctrine)
**Date:** 2026-05-14

## Context

The 2026-05-14 dry-run captured in `docs/conversations/pr-review-dry-run-01.txt` produced a transient `API Error: The socket connection was closed unexpectedly` from the Claude Code HTTP client during Step 6's parallel agent fan-out. Step 6 is the plugin's largest concurrent spawn: Doc Context Orchestrator plus 2–5 review-aspect agents in a single message.

The error printed in the output but all spawned agents completed normally. The Claude Code harness either auto-retried the launch transparently or the server-side launch had already been accepted before the client socket dropped. The user-visible outcome was a successful run that _looked_ broken.

Two unaddressed risks:

1. **Cosmetic confusion.** A scary API error appeared with no framing. AFK users skimming the output can't tell whether a partial failure occurred.
2. **Real partial-failure invisibility.** If a future fan-out _does_ lose one agent (e.g. the harness fails to recover), the orchestrator currently has no post-condition that detects the missing result block. The Review posts with N-1 aspects' findings and the user has no signal that coverage was reduced.

ADR 0015 already forbids retries for HTTP failures in v1 with three reasons: (1) AFK latency, (2) retry-storm failure mode, (3) DEGRADED Notices carrying accurate information. All three reasons apply identically to agent-spawn failures during fan-out. This ADR extends ADR 0015's doctrine to the orchestrator's fan-out layer.

## Decision

**Trust the harness. Don't retry. Surface partial fan-out as a DEGRADED Notice.**

After Step 6's fan-out completes, the orchestrator runs a post-condition check: every launched Review Aspect agent must have returned a parseable JSON findings array. Agents that return nothing (no result block, no JSON, empty stdout) are recorded as missing.

If any aspects are missing, the orchestrator emits a single Notice:

```js
{ severity: 'warning', kind: 'agent-spawn',
  message: 'Review Aspects did not return findings: <name>, <name>. Coverage is reduced for this run.' }
```

The Notice flows through the same pipeline as Fetcher and Coordinator notices: merged via `mergeNotices`, rendered in the Review Summary (or pre-PR / dry-run preamble), counted in the Trailer's `warning notices` field.

The Review still posts with whatever findings did arrive. No retry. No double-spawn risk.

The `agent-spawn` kind is added to the `NoticeKind` enum in `scripts/ado/notices.mjs`. Per ADR 0014's invariant _"each `kind` has exactly one source agent"_, the source agent is **the orchestrator itself** — it is the only place that knows which agents were launched.

## Alternatives considered

**Retry missing agents sequentially after fan-out.** The orchestrator detects the missing ones and re-spawns them in a second pass. Rejected: the harness may already have launched them server-side (the dry-run example demonstrates the harness recovers transparently). Re-spawning risks double inferences, double findings, and confusing the user with duplicate output. No idempotency guarantee.

**Catch the socket error itself and retry the whole fan-out.** Guaranteed double-spawn of agents that did succeed — explicitly worse than the previous option.

**Add a feature-flagged single retry behind a configuration option.** Postponed. ADR 0015's clause _"Re-evaluate if 5xx Notices prove painful in practice"_ applies equivalently here. If `agent-spawn` Notices become a frequent reality, this ADR can be revisited with the same opt-in approach.

**Treat partial fan-out as ABORTED.** Rejected: one missing aspect (e.g. `comment-analyzer`) is not run-corrupting. The Notice tells the user; they can rerun if needed. ABORTED is reserved for failures that would corrupt cross-run state.

## Consequences

- The orchestrator gains a single post-condition check after Step 6 — a few lines of bash + a `createNotice` call. No new helper, no new test infrastructure beyond extending the existing `tests/notices.test.mjs` cases.
- The user always sees a documented status: either findings (success), findings + `agent-spawn` Notice (partial), or aborted Trailer (full failure upstream).
- Future failure modes affecting fan-out (e.g. a `pr-review-toolkit` upgrade introducing a non-JSON response) become observable via the same Notice, without a new failure-classification path.
- ADR 0015's no-retry doctrine is documented as load-bearing across two layers (HTTP and agent-spawn). Its status line gains `, amended by 0018` and its "No retries in v1" section closes with a cross-reference to this ADR.

## See also

- ADR 0014 — Notice Tier doctrine (`agent-spawn` is a new `kind` in the enum)
- ADR 0015 — Canonical HTTP-tier mapping (amended)
- Spec 15 — Implementation of this ADR
