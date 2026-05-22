# 15. Fan-out resilience — agent-spawn Notice

- Priority: P1
- Effort: S
- Version impact: patch (new Notice kind; no retry; no behaviour change on the happy path)
- Depends on: 12
- Touches: `commands/review-pr.md` (post-Step-6 check), `scripts/ado/notices.mjs` (extend enum), `tests/notices.test.mjs`, new `docs/adr/0018-fan-out-resilience-trust-harness.md`, `docs/adr/0015-canonical-http-tier-mapping.md` (status amendment), `docs/adr/README.md`, `docs/plans/README.md`, `CHANGELOG.md`

## Context

The 2026-05-14 dry-run produced a transient `API Error: The socket connection was closed unexpectedly` from Claude Code's HTTP client during Step 6's parallel agent fan-out (Doc Context Orchestrator + up to 5 review-aspect agents — the plugin's largest concurrent spawn). All six agents completed normally afterward: the Claude Code harness either auto-retried or the server-side launch had already been accepted before the client socket dropped.

The error appeared in the user-facing output without framing, which made the run look broken even though it succeeded. More importantly: if a partial fan-out *had* happened (e.g. one agent's launch dropped server-side too), the orchestrator would currently have no way to detect or report it. The Review would post with N-1 aspects' findings and the user would not know.

ADR 0015 ("Canonical HTTP-Tier Mapping") explicitly forbids HTTP-tier retries in v1. That doctrine should extend to agent-spawn failures: trust the harness, don't retry, but surface partial fan-out as a DEGRADED Notice so the user sees reduced coverage.

## Current behaviour

- Step 6 launches Doc Context Orchestrator + 2–5 review-aspect agents in a single message.
- If any agent silently fails to return its `_RESULT_START`/`_END` block (or `pr-review-toolkit:*` returns nothing), the orchestrator parses what came back and proceeds.
- No Notice is emitted for missing agent results.
- The user has no signal that coverage was reduced.

## Target behaviour

- After Step 6 fan-out completes, the orchestrator asserts a result block came back for every agent it launched:
  - Doc Context Orchestrator → presence of the `## Business context` heading (or an explicitly empty string is acceptable).
  - Each Review Aspect agent → presence of a JSON findings array (`[]` is acceptable).
- For every missing result block, the orchestrator emits a `warning` Notice with `kind: agent-spawn` and `message: Review Aspect <agent-name> did not return findings — coverage is reduced for this run`.
- No retry. The Review still posts with whatever findings did arrive.
- The same post-condition runs in dry-run mode (spec 13) — Notice is rendered in the dry-run preamble.
- The new `agent-spawn` kind is added to ADR 0014's enum in `scripts/ado/notices.mjs`. Per ADR 0014's invariant ("each `kind` has exactly one source agent"), the source is **the orchestrator itself** — it is the only place that knows which agents it launched.

## Affected files

| File | Change |
|---|---|
| `commands/review-pr.md` | After parsing review aspect agent responses in Step 6, run a post-condition check: for every launched aspect, assert a JSON array was returned; for missing ones, push a `createNotice('warning', 'agent-spawn', '<message>')` to the orchestrator-owned notices list. Merge with Fetcher + Coordinator notices in Step 8. |
| `scripts/ado/notices.mjs` | Add `'agent-spawn'` to the `NoticeKind` union and its enumeration. No other helper changes — `createNotice` / `mergeNotices` / `formatNoticesAsSummaryBlock` / `formatNoticesAsPrePrPreamble` already handle new kinds via the enum. |
| `tests/notices.test.mjs` | Add cases for: single missing aspect → one `agent-spawn` warning; two missing aspects → two warnings (deduped by `kind` per existing `mergeNotices` rules — verify expected behaviour); rendering in Summary block; rendering in pre-PR preamble. |
| `docs/adr/0018-fan-out-resilience-trust-harness.md` | New ADR — extends ADR 0015's no-retry doctrine to agent-spawn failures. |
| `docs/adr/0015-canonical-http-tier-mapping.md` | Status line: `Accepted, amended by 0018`. |
| `docs/adr/README.md` | Add row 0018; status amendment for 0015. |
| `docs/plans/README.md` | Add row 15. |
| `CHANGELOG.md` | `### Added` entry: *New `agent-spawn` warning Notice surfaces when a Review Aspect agent fails to return findings (e.g. transient socket error during fan-out).* |

## Implementation steps

### 1. Write ADR 0018

Record: agent-spawn failures during parallel fan-out are treated identically to ADR 0015's network-error policy — DEGRADED, no retry, emit a Notice. Rationale: the Claude Code harness already handles transport-layer retries and idempotency on its side; double-spawning agents from the orchestrator would waste tokens and produce duplicate findings. The DEGRADED Notice is accurate information: one aspect was not run.

Alternative considered: retry missing agents sequentially after fan-out. Rejected — no idempotency guarantee; double-spawn risk.

Alternative considered: catch the socket error and retry the whole fan-out. Rejected — guaranteed double-spawn of agents that did succeed.

### 2. Amend ADR 0015

Status line: `**Status:** Accepted, amended by 0018`. Add a closing sentence to the "No retries in v1" section: *"This no-retry policy extends to agent-spawn failures during orchestrator fan-out — see ADR 0018."*

### 3. Add `'agent-spawn'` to `scripts/ado/notices.mjs`

Locate the `NoticeKind` enum / union literal. Add `'agent-spawn'`. Confirm `mergeNotices` deduplicates by `kind` — multiple missing aspects in one run produce one `agent-spawn` Notice with a deterministic message. Either:
- **(recommended)** Aggregate at the orchestrator before calling `createNotice` (build a single message listing every missing aspect), so the Notice carries useful detail. The dedup-by-kind invariant stays untouched.
- Or: change message-building in the orchestrator so each missing aspect becomes its own Notice; let `mergeNotices` keep the first. Loses information.

### 4. Extend `tests/notices.test.mjs`

`node:test` cases:

- `agent-spawn` Notice renders with `⚠` prefix in both Summary block and pre-PR preamble.
- `mergeNotices` collapses two `agent-spawn` Notices (first wins per existing rule).
- Trailer count includes `agent-spawn` Notices in `warning notices`.

### 5. Update Step 6 in `commands/review-pr.md`

After parsing the JSON arrays from each launched review-aspect agent, run:

```
For each agent in <launched aspects>:
  If no JSON array was returned (agent did not produce a parseable response):
    Add <agent name> to MISSING_ASPECTS

If MISSING_ASPECTS is non-empty:
  Push createNotice('warning', 'agent-spawn',
    'Review Aspects did not return findings: ' + MISSING_ASPECTS.join(', ') + '. Coverage is reduced for this run.')
  to ORCH_NOTICES.
```

Store `ORCH_NOTICES` and merge it with Fetcher and Coordinator notices in Step 8.

### 6. Update Step 8 in `commands/review-pr.md`

Change the merge call from `mergeNotices([...fetcherNotices, ...coordinatorNotices, ...result.notices])` to `mergeNotices([...fetcherNotices, ...coordinatorNotices, ...result.notices, ...ORCH_NOTICES])`. Pre-PR Step E gets the same treatment for the dry-run path (spec 13).

### 7. Update READMEs and CHANGELOG

- `docs/plans/README.md`: add row 15.
- `docs/adr/README.md`: add row 0018; mark 0015 as amended.
- `CHANGELOG.md`: `### Added` entry as described.

## Verification

- Force a missing Review Aspect response (e.g. mock `Agent` to return empty for `pr-review-toolkit:code-reviewer`) → orchestrator emits one `agent-spawn` warning Notice; Review still posts with the remaining aspects' findings; Trailer warning count is +1.
- Force two missing aspects → single Notice listing both; Trailer warning count is +1.
- Happy path (all aspects return) → no `agent-spawn` Notice in output.
- Dry-run with a missing aspect → Notice renders in dry-run preamble; Trailer reads `🔍 Dry-run complete: ... · 1 warning notices`.
- `mergeNotices` unit test still passes for the deduplication invariant.

## Acceptance criteria

- [ ] `scripts/ado/notices.mjs` `NoticeKind` includes `'agent-spawn'`.
- [ ] Orchestrator emits the Notice when any launched Review Aspect agent returns no parseable findings.
- [ ] No retry path is added.
- [ ] ADR 0015 status line ends with `, amended by 0018`.
- [ ] ADR 0018 exists and extends the no-retry doctrine to agent fan-out.
- [ ] Tests cover happy path, one missing aspect, two missing aspects, and rendering in both Summary and pre-PR preamble.
- [ ] CHANGELOG `[Unreleased]` has an `Added` entry.

## Out of scope

- Retry policy for the ADO Fetcher, Coordinator, or Writer. Those follow the ADR 0015 HTTP-tier mapping unchanged.
- Detecting which specific *HTTP error* caused a missing agent response — the orchestrator only sees "the agent did not return a result block". Detail is the harness's job.
- A configurable retry count behind a feature flag. If 5xx-driven Notices become painful, ADR 0018 can be revisited per its own re-evaluation clause.
