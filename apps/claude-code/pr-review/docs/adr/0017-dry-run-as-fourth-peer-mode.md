# 0017. Dry-run as a fourth peer operating mode

**Status:** Accepted (2026-05)
**Date:** 2026-05-14

## Context

The 2026-05-14 dry-run captured in `docs/conversations/pr-review-dry-run-01.txt` was invoked with the natural-language instruction _"Make a dry-run PR review. DO NOT POST ANY COMMENT TO THE PR! Only report inline"_. The plugin had no formal dry-run mechanism. The LLM-as-orchestrator improvised: inlined `az` data fetches (compounding the Step 4 bug), skipped the `pr-review:ado-fetcher` agent entirely, and never invoked the ADO Writer. The user got useful findings but only by accident — the documented spec was bypassed.

Two design problems:

1. **No deterministic dry-run path.** Asking the LLM to "not post comments" works most of the time but invites free-form deviation from the spec. A documented mode replaces persuasion with branching.
2. **Dry-run is genuinely useful and not just a debug helper.** Previewing what a re-review would post — before letting it edit threads in a customer-facing PR — is a legitimate user need.

Two shapes for the formalisation: a fourth peer mode, or an orthogonal boolean flag.

## Decision

**Dry-run is a fourth peer mode, alongside pre-PR, first-review, and re-review.** CLI surface: `/pr-review:review-pr <url> --dry-run`. The orchestrator's mode resolution applies the flag after URL parsing; `IS_REREVIEW` (whether a prior bot signature exists) is captured separately and drives Coordinator inclusion within dry-run mode.

Dry-run runs every read-side step identically to first-review / re-review (preflight, metadata fetch, ADO Fetcher, Doc Context Orchestrator, Review Aspects fan-out, and Re-review Coordinator's Thread Classification when `IS_REREVIEW=true`). The **ADO Writer is never invoked**. Findings render to the Claude interface using pre-PR Step E's severity-grouped format. Notices from Fetcher and Coordinator render via `formatNoticesAsPrePrPreamble`. The Trailer reads `🔍 Dry-run complete: <N> findings (<criticals> critical, <importants> important) · <warnings> warning notices · would have posted to <PR URL>`.

Coordinator runs in dry-run mode when `IS_REREVIEW=true`, but its reply-posting branch is short-circuited. Its `freshFindings` output still feeds `FINDINGS_JSON` so the user previews exactly the incremental finding set the real re-review would have posted.

## Alternatives considered

**Orthogonal `DRY_RUN` boolean flag.** Any mode (first-review / re-review) could be dry-run. Conceptually cleaner — dry-run is "do the work, don't post" — but produces awkward mode names internally (`first-review-dry-run`, `re-review-dry-run`) and forces every branch in the orchestrator to read two state variables instead of one. Rejected: peer-mode keeps the orchestrator's mode-switch readable as a single discriminator.

**Document a "DO NOT POST" convention and trust the LLM.** Zero implementation cost. Rejected because it is exactly what failed on 2026-05-14: the LLM honoured the instruction by skipping not just Writer but also the entire structured fetch path, masking the Step 4 bug and producing inconsistent behaviour across runs.

**Make dry-run a flag that disables only the Writer agent invocation.** Halfway between the other two. Rejected because the orchestrator's other branches (Step 8 trailer text, Notice rendering) still need to know whether to use the pre-PR rendering path or the ADO Summary path. A single mode value carries that decision uniformly.

## Consequences

- The orchestrator branches on `MODE ∈ {pre-pr, dry-run, first-review, re-review}` — four cases, no nested flags.
- Re-review-eligible PRs can be previewed safely: classification runs and reports its plan, but no replies are posted and no thread statuses are PATCHed.
- The Pre-PR rendering helpers (`formatNoticesAsPrePrPreamble`, severity-grouped finding print) are reused by dry-run — confirming that "render to interface" is a coherent capability, not a pre-PR-only quirk.
- The Trailer line gets a fourth shape (`🔍 Dry-run complete: ...`). `formatTrailer` in `scripts/ado/notices.mjs` grows one branch + test cases.
- `CONTEXT.md` gains a `Dry-run mode` term and updates three relationship lines documenting which agents run in which modes.

## See also

- Spec 13 — Implementation of this ADR
- Spec 12 — Step 4 fix (the upstream bug that exposed the no-formal-dry-run gap)
- ADR 0014 — Notice Tier doctrine (`formatTrailer`, `formatNoticesAsPrePrPreamble` are governed here)
- `CONTEXT.md` — `Dry-run mode` definition and the agent-invocation matrix
