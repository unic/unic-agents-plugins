# 0026. `/pr-review` is a generic fan-out Archon workflow that harvests unic-pr-review's learnings, not its code

**Status:** Accepted (2026-07-03); amended 2026-08-04 — the seven hand-written aspect nodes collapsed
into one `review` node that runs the `code-review` Method's own two-axis fan-out (#281). See §8.

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

> **Amended by §8 (#281).** "Every aspect" now means both review axes. The lever itself is unchanged and
> is the reason `prep` survives the collapse untouched.

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

> **Amended by §8 (#281).** The spawn gates are retired with the seven nodes they gated; the confidence
> rubric and finding contract are unchanged and are now applied by the single `review` node.

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

### 8. Seven hand-written aspects become one node hosting `code-review`'s own two axes

_Amended 2026-08-04 (#281), tranche 3 of the Matt v1.1.0 migration. Applies
[ADR-0030](0030-harness-hosts-methods.md)'s structural bar to this Box._

The seven aspect nodes — `code-quality`, `tests`, `silent-failure`, `type-design`, `comment-rot`,
`simplifier`, `intent-check` — carried hand-written prompts describing ground the `code-review` Method
already covers along two axes: **Standards** (does the diff follow this repo's documented standards, plus
a twelve-item Fowler smell baseline) and **Spec** (does the diff match what the originating issue asked
for). The Plugin was maintaining review criteria upstream now maintains. They are replaced by a single
`review` node that reads `.archon/methods/code-review/SKILL.md` by literal repo-relative path.

**The DAG shrinks from seven parallel nodes to one, and that is the point, not a regression.** The Method
implements its own parallelism — its step 4 says "send a single message with two `Agent` tool calls, use
the `general-purpose` subagent for both" — for the same reason the old fan-out existed: so the axes do not
pollute each other's context. Re-implementing step 4 as two Archon nodes would keep a prettier DAG while
re-doing what the Method already does, which is precisely the defect ADR-0030's bar forbids: nothing about
running two sub-agents needs the Harness. `synthesize` therefore consumes ONE `SESSION/findings/review.json`
instead of seven aspect files, and it drops `trigger_rule: all_done` — that existed only to keep skipped
aspect siblings from blocking it, and `review` always runs.

**Refactoring arrives here.** `/build`'s loop no longer has a REFACTOR phase, because `tdd` puts
refactoring in the review stage ([ADR-0023](0023-build-generic-red-green-refactor-loop.md) §7). The Fowler
smell baseline inside the Standards axis is where it lands. The `review` node **must paste that baseline in
full** into the Standards sub-agent's prompt: the Method's step 4 is explicit that the sub-agent has no
other access to it, so an abridged paste silently narrows the review, and this Box now owns that duty
because it is the node spawning the axes.

**What the Harness keeps, because no Method supplies it.** The Intent Brief `prep` composes and both axes
receive; the confidence→severity finding contract and threshold; the hash-keyed re-review classification
on the `<!-- unic-dlc-pr-review:iteration=N -->` marker; the `gates.pr-review` confirm-before-post; and
both posting surfaces. This Box holds the **only review-posting authority** in the lifecycle — `/build`'s
new `implement-review-precheck` deliberately posts nothing.

**Two Method questions are answered by injection, never asked.** The Method asks a live human for the fixed
point and for the spec location; `prep` already resolved both. The fixed point is `$prep.output.base_ref`
(the merge-base it computed); the spec source is `SESSION/intent-brief.md`. When
`$prep.output.intent_available` is `"false"` the Method's own rule applies — skip the Spec sub-agent and
report "no spec available". The Methods' `/setup-matt-pocock-skills` fallback never applies
([ADR-0024](0024-triage-intake-on-ramp.md)).

**AC coverage survives the loss of `intent-check`.** The Spec axis _is_ the AC-coverage judgement —
requirements missing or partial, scope creep, requirements implemented wrongly — so `synthesize` renders
the review node's `spec_report` verbatim under the existing `### Intent Check` heading. The summary keeps
its shape; the per-AC verdict list becomes the Spec axis's prose, which cites the spec line per finding.

**One migration wrinkle, handled in `reconcile`.** A prior iteration posted before this change carries the
retired seven aspect names in its finding hashes, where this run carries `standards` / `spec`. `reconcile`
is instructed to match those on file + semantic title alone, ignoring the aspect, so the first re-review
after the rewiring does not report every existing finding as new.

**Verification status, recorded rather than implied.** `archon validate` accepts all four workflows on
Archon v0.7.0, and its `allowed_tools` check confirmed the sub-agent tool is `Agent`, not `Task` — the old
name "is silently ignored at runtime", so the axes would never have spawned and no error would have been
raised. That is why the node declares `Agent`. What is **not** yet exercised is a real
`archon workflow run` proving the two sub-agents spawn from inside a prompt node; the design fork was
resolved by reading, and the node is instructed to fail loud ("REVIEW BLOCKED: Agent tool unavailable…")
rather than quietly reverting to a one-axis or seven-aspect shape if it turns out otherwise. This is the
same posture this ADR and [ADR-0029](0029-explore-research-spike-onramp.md) already take for the
shipped-but-unexercised Archon Boxes.

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
