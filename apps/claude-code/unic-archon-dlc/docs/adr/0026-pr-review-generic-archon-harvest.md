# 0026. `/pr-review` is a generic fan-out Archon workflow that harvests unic-pr-review's learnings, not its code

**Status:** Accepted (2026-07-03)

## Context

`/pr-review` is the main-line box between `/build` and `/qa` ([ADR-0014](0014-workflow-per-box-decomposition.md)):
it reviews the open PR and posts feedback. It is an **Archon workflow** because it is AFK-isolatable work
([ADR-0017](0017-container-follows-structural-need.md)) — but unlike `/qa` it merges nothing, so its human
checkpoint is a **confirm-before-post** gate, not a merge gate.

The shipped `unic-dlc-review` workflow used the inert `type:`-style schema — a blocking migration
([ADR-0011](0011-archon-schema-target.md)): a single monolithic `type: prompt` node that posted one
sentinel-guarded comment, read a flat `.archon/unic-dlc.config.json`, and used stale `docs/workflow/<slug>/`
paths. Its command stub also referenced the **dissolved** `lib/tracker-adapter.mjs`
([ADR-0016](0016-dlc-thin-process-layer.md)/[ADR-0018](0018-generic-core-config-compose.md)) — the same
stale reference [ADR-0025](0025-qa-pipeline-onramp.md) had to correct for `/qa`.

Three questions had to be resolved:

1. **Relationship to the separate `unic-pr-review` plugin.** That plugin is a rich but cautionary PR
   reviewer welded to Azure DevOps (an ~880-line procedural orchestrator, 16 interdependent ADRs of
   iteration-state machinery). It holds real, hard-won review _learnings_ — but they are buried in
   ADO-specific IO. Does `/pr-review` delegate to it, share a module with it, or stay self-contained?
2. **How rich a review**, and in what node shape — one prompt or a fan-out?
3. **How much re-review awareness** — none, a counter, or full finding classification?

These were grilled with the maintainer (2026-07-03); the decisions below are that outcome.

## Decision

### 1. Self-contained — harvest the learnings, depend on nothing

`/pr-review` **stays deliberately self-contained** (PLAN #7). It re-derives, in generic config-composed
form, the _portable learnings_ of `unic-pr-review` — the six review aspects and what each hunts for, the
confidence→severity rubric, the structured grouped summary, the hidden-marker (never author-identity)
idempotency, the conditional spawn table, and the summary+inline two-surface model — but takes **none of
its ADO code and no runtime dependency on it** ([ADR-0016](0016-dlc-thin-process-layer.md)/
[ADR-0017](0017-container-follows-structural-need.md)). `unic-pr-review`'s fate stays deferred; the two
are not coupled. What makes this _not_ a second cautionary tale is that the review lives in a declarative
Archon DAG over a config-composed tracker (MCP-first, CLI-fallback), not a procedural orchestrator with a
host welded in.

### 2. Node graph — a fan-out ported to the key-discriminated schema

`bootstrap → guard-not-ready → prep → {code-quality, tests, silent-failure, type-design, comment-rot,
simplifier, intent-check} → synthesize → reconcile → review-gate → post`, with `interactive: true` at the
workflow level so the gate message reaches the user ([ADR-0011](0011-archon-schema-target.md) §2).
Following [ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5, every node is a self-contained
`prompt:` node reading files with its own tools — **no plugin-`lib/` import, no `$CLAUDE_PLUGIN_ROOT`** —
and artefacts live under `<artifacts_dir>/<slug>/pr-review/` ([ADR-0015](0015-workflows-slug-artifact-home.md)).

The **seven aspects fan out as parallel fresh nodes** rather than one prompt: each judges the diff through
a focused lens in its own context. Fresh nodes share no memory, so `prep` writes the diff, changed-file
list, and Intent Brief to disk and each aspect **writes its findings to `findings/<aspect>.json`**;
`synthesize` reads whatever files exist. A **skipped aspect writes nothing**, so `synthesize` never
references a skipped node's output — and it uses `trigger_rule: all_done` so the skips don't block it.

### 3. Intent composed once in prep, injected into every aspect

`prep` composes **one Intent Brief** from every source that resolves — the linked work items (User Story /
Bug / Jira ticket, via the configured tracker), Confluence/MD docs (via the configured docs system-skill),
the **PR description body**, and `PRD.md` if present — and every aspect reads it. This is the primary
quality lever: an intent-grounded aspect raises **precision** (a spec-mandated fallback or wide type is not
flagged as a defect) and **recall** (a missing AC path or a dropped spec-required telemetry event _is_
flagged), and composing once keeps intent consistent across the seven aspects instead of re-derived seven
ways. Intent-check (the dedicated AC-coverage aspect) is skipped **only when no source resolves** — a
missing `PRD.md` alone is not a reason to skip. When sources **contradict**, `prep` records each and the
contradiction surfaces both at the gate and in the summary — the review never silently picks a winner.

### 4. Conditional spawn gates, confidence rubric

Aspects are spawned only when meaningful (the harvested SPAWN_TABLE, biased to over-spawn — a false spawn
is a cheap empty result, a false skip silently drops a finding set): code-quality + intent-check always
run; `tests` when the diff touches tests; `type-design` when it touches types; `comment-rot` when it
touches docs/comments; `silent-failure` when it touches source or error-handling; `simplifier` when it
touches source. Every aspect scores findings on the same rubric — confidence 90–100 Critical, 80–89
Important, 60–79 Minor, below `pr-review.confidence_threshold` **dropped before writing**.

### 5. First-class re-review — iteration counter + finding classification

Re-review is a dedicated **`reconcile`** node, not folded into synthesize. Every bot comment carries a
hidden `<!-- unic-dlc-pr-review:iteration=N -->` marker + an `Iteration N` footer; `prep` detects the
**highest** prior N on the PR (the PR itself is the source of truth, not the session dir — detection keys
on the marker, **never author identity**, so a human comment is never mistaken for a prior review) and
sets this run to N+1. `reconcile` matches this run's findings against the prior iteration by their stable
per-finding marker (tolerating small line drift — matched on aspect + file + semantic title, not the exact
line) and **classifies each new / still-present / fixed / regressed**, computes the "since iteration N−1"
delta, and finalises the summary + inline plan. `post` reconciles per classification: still-present →
update in place, fixed → resolve, regressed → reopen, new → new thread.

### 6. Confirm-before-post gate; two write surfaces

`review-gate` is an `approval:` node gated `when gates.pr-review == 'hitl'` (default HITL). In HITL it
shows the finalised summary + counts + contradiction warnings and pauses; in AFK it is skipped and `post`
runs via `trigger_rule: all_done`. Posting is **advisory and non-blocking** — unlike `/qa` there is no
fail-closed merge guard, because `/pr-review` merges nothing. `post` writes **two surfaces**: one
structured **summary comment** (matched/updated by its iteration marker) and, when
`pr-review.inline_comments` is set and the tracker supports inline threads, **inline comments** per
finding. Trackers without inline threads (jira / local-markdown) degrade to summary-only with a note.

### 7. Config: a `pr-review` block that back-fills

A `'pr-review': { confidence_threshold: 60, inline_comments: true }` block joins `defaultConfig()`.
`mergeConfig` auto-fills it for configs that predate it, so **no `/setup` change is required** this step
(same pattern as [ADR-0024](0024-triage-intake-on-ramp.md)/[ADR-0025](0025-qa-pipeline-onramp.md) §2). The
`gates.pr-review` key already existed in `defaultConfig()`.

## Consequences

- **`/pr-review` gains a real, AFK-capable review** it lacked (the old single node ran the inert schema).
  Behavioural validation — the gate pauses in HITL, AFK skips-and-posts, the summary + inline update in
  place, a second run increments the iteration and classifies findings — is required beyond
  `archon validate` ([ADR-0011](0011-archon-schema-target.md) §6), which passes inert forms too.
- **New `pr-review` config block** in `config-schema.mjs` + tests; `mergeConfig` back-fills existing
  configs.
- **The rename** `unic-dlc-review` → `unic-dlc-pr-review` propagates to the workflow `name:`, the command
  stub, the sentinel (`<!-- unic-dlc-pr-review:iteration=N -->`), and the plugin/marketplace descriptions
  (which also drop the retired `plan`).
- **Self-containment keeps the two PR reviewers decoupled:** improvements to one do not obligate the other,
  and the DLC never inherits ADO-specific coupling.
- **Known item, not fixed here:** the re-review matching is deliberately generic — there is **no
  delta-diff engine** for exact line-drift tracking (we match on aspect+file+semantic title), and
  ADO-style inline thread _status_ transitions (resolve/reopen) are best-effort where the tracker exposes
  them. Full end-to-end behavioural validation (including a second-iteration run) needs a real Archon run
  against a Consumer PR; it is logged as a manual follow-up, not asserted by CI.
