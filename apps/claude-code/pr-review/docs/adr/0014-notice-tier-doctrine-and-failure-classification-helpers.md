# 0014. Notice Tier doctrine and failure-classification helpers

**Status:** Accepted (2026-05)

## Context

ADO Fetcher reads and ADO Writer writes can fail in many ways — auth revoked, transient 5xx, a fetch returning an empty array that is sometimes a legitimate domain state and sometimes a degradation. Before this ADR, every failure was treated independently:

- `parseIterations([])` silently defaulted to `{ latestIterationId: 1 }`, violating the CLAUDE.md "iteration 1 is never used" rule.
- `parseWorkItemIds(null)` returned `[]`, indistinguishable from a legitimate "no work items linked" PR.
- The diff-range fallback from incremental to full was silent — the Coordinator could not tell which range it was classifying threads against.
- The H1 hardening from PR #29 made the inline-post call site log-and-continue on errors, but the rule was call-site-local; the rest of the Writer's POSTs still had ad-hoc handling.

The result was a Review that could be posted on degraded inputs (corrupting re-review detection forever afterwards on iteration drift) without the reviewer or the invoker seeing any signal.

ADR 0013 split `review-pr.md` into a thin orchestrator and three focused agents but kept failure-handling logic inside the agent prompts as inline bash-and-Node heredocs. Those heredocs are hard to test in isolation and hard to keep consistent: the canonical HTTP-tier mapping (401 means abort everywhere; 5xx means degrade everywhere) cannot be enforced when each call site re-implements it.

## Decision

Adopt a **four-state Notice Tier doctrine** for every orchestration-agent operation:

- **OK** — operation completed with a non-empty result. No Notice emitted.
- **EMPTY-BY-DESIGN** — operation completed with an empty result that is a legitimate domain state. Silent for most operations; the Doc-Context family is the one carve-out (when `WORK_ITEM_IDS=[]` the orchestrator emits an `info` Notice, because the reviewer cannot tell from the PR alone whether the bot considered linked business context).
- **DEGRADED** — operation failed but the Review can still complete with reduced coverage. Emits a `warning` Notice; the Review still posts.
- **ABORTED** — operation failed and continuing would corrupt cross-run state (Bot Signature drift, Summary thread desync, mode misdetection). The run stops before the Review Summary is composed; the failure goes to stderr plus the end-of-run Trailer.

There is **no fifth ASK tier**. AFK invocations never block on user input. Failure modes that tempt an ASK tier are reclassified as ABORTED.

Each orchestration agent emits a `NOTICES` JSON array as a new field in its structured result block. The orchestrator parses each agent's array, merges them via `mergeNotices` (deduplicating by `kind`), and passes the merged array to the ADO Writer alongside `FINDINGS`. The ADO Writer renders a `## Notices` block above the severity-grouped findings in the Review Summary content. Each item carries its own per-severity emoji prefix (`ℹ️` for `info`, `⚠` for `warning`); the heading stays bare so a mixed list does not require the heading emoji to misrepresent one tier.

Notice shape:

```js
{ severity: 'info' | 'warning', kind: NoticeKind, message: string }
```

`kind` is a small enum: `doc-context`, `diff-range`, `work-items`, `iterations`, `default-branch`, `partial-run-check`, `thread-match`, `thread-classify`, `inline-post`, `summary-post`, `patch-to-fixed`, `diff-parse`, `delta-reply`, `completion-marker`. Free-form strings and severity-coded numerics were rejected — the enum lets the merge step dedup by `kind` without parsing message text. Each `kind` value has exactly one source agent — this is the invariant that makes first-wins dedup safe.

A mandatory single-line **Trailer** is printed to the Claude interface at end-of-run, regardless of mode or outcome:

- ADO modes: `✅ Review posted: <N> findings (<criticals> critical, <importants> important) · <warnings> warning notices · <infos> info notices → <PR URL>`
- Pre-PR mode: `✅ Pre-PR review complete: <N> findings (<criticals> critical, <importants> important) · <warnings> warning notices`
- Aborted: `❌ Review aborted: <kind> — <one-line reason>`

The same `NOTICES` array drives both the Summary rendering and the Trailer counts. Designed for AFK skim: the invoker sees outcome status without opening the PR.

**Helper layer refinement of ADR 0013.** Failure classification moves from inline bash-and-Node heredocs to pure JS helpers under `scripts/ado/`. ADR 0013 keeps orchestration in agent prompts; this ADR refines that — orchestration still lives in agent prompts, but **failure classification** lives in helpers that the prompts call via `await import(...)`. New helper modules:

- `scripts/ado/notices.mjs` — pure helpers `createNotice`, `mergeNotices`, `formatNoticesAsSummaryBlock`, `formatNoticesAsPrePrPreamble`, `formatTrailer`.
- `scripts/ado/classify-http-error.mjs` — canonical HTTP-tier mapping (added in PRD A slice A2; covered by ADR 0015).
- `scripts/ado/fetch-iterations.mjs`, `scripts/ado/fetch-work-items.mjs` — discriminated-union refactors of the existing parsers (added in A2 and A3, replacing `parseIterations` / `parseWorkItemIds`).

Helpers come with `node:test` unit tests in the prior-art style of `tests/parse-diff-hunks.test.mjs`.

## Consequences

- The Bot Signature is never signed with an empty Iteration ID again (the discriminated-union refactor of `parseIterations` will reclassify the empty-`value` case as ABORTED in slice A3).
- A failure that today is silent (work-item fetch failed, diff-range fallback fired) becomes a Notice in the Summary and a count in the Trailer.
- A consequential failure (401/403 on iterations) becomes a fast abort with a clear stderr message instead of a corrupted Review.
- Agent prompts shrink. The bash side around a failure-classification call becomes uniform `if [ "$RESULT_OK" != "true" ]; then ...`.
- The doctrine and helper layer are reused by PRD B (the consumer side): the ADO Writer call sites, the Re-review Coordinator's PATCH-to-fixed and `match-finding` flows, and the Pre-PR `parseChangedFilesFromDiff` / default-branch-fallback all route through the same helpers.
- Adding a new failure mode is a `createNotice` call plus a `kind` enum entry, not a new ad-hoc bash branch.

**Alternatives considered:**

_Three tiers (OK / DEGRADED / ABORTED)._ Rejected because the legitimate empty cases (no work items, no prior threads, no findings) need a distinct classification — they are not failures. Conflating them with DEGRADED would either silence them entirely (losing the Doc-Context info signal) or fire false-positive Notices on every clean PR.

_Five tiers including ASK._ Rejected because the plugin's deployment model is AFK — there is no user to ask. Every failure must be decidable from data the agent already has. ASK-flavoured failures are reclassified as ABORTED.

_Free-form Notice strings rather than `{ severity, kind, message }`._ Rejected because dedup across agents (Fetcher and Doc-Context Orchestrator both noticing a Confluence outage) requires a stable key.

**See also:**

- ADR 0013 — orchestrator split for `review-pr.md` (this ADR refines its testing posture for failure classification).
- ADR 0015 — canonical HTTP-tier mapping (the concrete mapping consumed by the helper layer).
- ADR 0004 — incremental diff baseline (amended in slice A4 with the γ-downgrade rule consumed by PRD B).
- `docs/issues/pr-review-ado-fetcher-reliability/PRD.md` for the feature PRD and the slices that deliver the doctrine.
