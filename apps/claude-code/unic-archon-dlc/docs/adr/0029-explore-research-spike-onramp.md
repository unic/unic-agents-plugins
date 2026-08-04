# 0029. `/explore` is an off-line, optional research + AFK-spike on-ramp

**Status:** Accepted (2026-07-03); amended 2026-08-04 — the four research nodes now read the `research`
Method instead of carrying no Method grounding at all (#281). See §5.

## Context

`/explore` is the off-line, optional research/spike box ([ADR-0014](0014-workflow-per-box-decomposition.md);
PLAN decision #3/#8). It is **never required**, but its `findings.md` may seed `/specs`. It is an
**Archon workflow** because it is AFK-isolatable research/spike work with no live conversation
([ADR-0017](0017-container-follows-structural-need.md)) — the last Archon box ported after `/build`,
`/qa`, and `/pr-review`.

The shipped `explore` workflow was **broken and inert**:

- It used the `type:`-style schema ([ADR-0011](0011-archon-schema-target.md)): its `type: interactive`
  spike gate never paused, and `inputs.slug` never substituted.
- It imported `lib/config-loader.mjs` — **already deleted** — so the workflow could not run at all.
- It also imported `findings-writer` / `spike-verdicts` / `labels-config` (dissolution targets in
  [ADR-0018](0018-generic-core-config-compose.md) #3) and wrote to `docs/workflow/<slug>/` — the wrong
  artefact home ([ADR-0015](0015-workflows-slug-artifact-home.md) says `<artifacts_dir>/<slug>/`).

Three questions were grilled with the maintainer (2026-07-03):

1. **`findings.md` → `/specs` contract** — which sections actually feed `/specs`' load-context?
2. **Spike-branch preservation gate** — keep it, or simplify?
3. **Prototype scope** — is prototyping in scope here, or does it lean on Matt's `/prototype` skill?

## Decision

### 1. Node graph — ported to the key-discriminated schema

`bootstrap → guard-not-ready → {research-stack, research-features, research-architecture,
research-pitfalls} → synthesize → spike → spike-ticket → spike-branch-gate → preserve-spike`, with
`interactive: true` at the workflow level so the spike-branch approval message reaches the user
([ADR-0011](0011-archon-schema-target.md) §2). Following [ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5,
every node is a **self-contained `prompt:` node** that reads config/repo with its own tools — **no
plugin-`lib/` import, no `$CLAUDE_PLUGIN_ROOT`**. `bootstrap` parses the slug from `$ARGUMENTS` and
emits scalars; artefacts live at `<artifacts_dir>/<slug>/` ([ADR-0015](0015-workflows-slug-artifact-home.md)).
There is **no PRD/findings precondition** — `/explore` _produces_ findings.md, so `ready` needs only a
slug + a readable config.

### 2. `findings.md` → `/specs` contract: three named lenses

`/specs`' load-context step reads `<artifacts_dir>/<slug>/findings.md` and summarises three lenses:
**Domain Model**, **Established Decisions**, **Prior Research**. So `synthesize` now writes the
**Integrated Brief** as those three explicitly-named `###` subsections (above the four dimension
sections Stack / Features / Architecture / Pitfalls). Keeping the headings exact makes the `/explore →
/specs` handoff lossless — `/specs` picks up Domain Model vocabulary, ADR-cited Established Decisions,
and the Prior-Research synthesis + open questions verbatim, rather than re-deriving them.

### 3. Spike scope: AFK spike here, interactive prototyping is Matt's `/prototype`

PLAN keeps research + **AFK spike** in scope for `/explore`, but interactive prototyping is Matt's
`/prototype` skill. The `spike` node therefore runs a **non-interactive** experiment pass: build/measure
a throwaway experiment where AFK-feasible, else reason it through, then append a `## Spike verdicts`
section (VALIDATED / INVALIDATED / PARTIAL) to findings.md. Where a live UI/UX judgement is needed it
does **not** build it — it **references** `/prototype` (which needs a live conversation and so cannot run
in an Archon node — [ADR-0017](0017-container-follows-structural-need.md)) and records a `PARTIAL`
verdict. `synthesize` and `spike` write findings.md directly with Write/Edit — which is why
`findings-writer` and `spike-verdicts` are dissolved (below).

### 4. Spike-branch gate: config-gated approval; ticket filed first

The spike-branch preservation gate is kept, but converted to an `approval:` node governed by
`gates.explore` (already in `defaultConfig()`, default `hitl`). Because the approval schema exposes only
`on_reject` (reject reworks/cancels — it never proceeds past a reject), the **`spike-ticket` node runs
before the gate** so the durable tracker output survives a "discard". APPROVE flows to `preserve-spike`
(creates `spike/<slug>` + commits); a bare REJECT (no `on_reject`) cancels cleanly with the ticket
already filed. In **AFK** (`gates.explore: afk`) the gate's `when` is false → it is skipped, and skip
propagates to `preserve-spike` (also guarded `when gate == 'hitl'`), so no branch is created and the
isolated worktree is left for `/cleanup` to prune. The spike ticket is filed in **either** mode.

The ticket composes the configured tracker (MCP-first, CLI-fallback — [ADR-0016](0016-dlc-thin-process-layer.md))
and takes labels **only** from `classification.labels` (single source of truth —
[ADR-0024](0024-triage-intake-on-ramp.md); Matt's `docs/agents/*` are never read), with the mandated
`> *This was generated by AI during exploration.*` disclaimer. It is idempotent (search-then-create).

### 5. The four research nodes read the `research` Method

_Amended 2026-08-04 (#281), tranche 3 of the Matt v1.1.0 migration. Applies
[ADR-0030](0030-harness-hosts-methods.md)'s structural bar to this Box._

`research-stack`, `research-features`, `research-architecture` and `research-pitfalls` shipped with no
Method grounding: each listed the files to read and the shape to emit, but nothing said how to hold a
claim to a source. Each now reads `.archon/methods/research/SKILL.md` by literal repo-relative path and
applies its **primary-source discipline** — follow every factual claim back to the source that owns it
(official docs, source code, specs, first-party APIs, or this repo's own files) and cite that source,
never a secondary write-up of it.

The Method is background-agent-shaped by construction: it opens "spin up a background agent to do the
research, so you keep working while it reads". A `context: fresh` Archon node running in parallel with
three siblings **is** that background agent, so each node is told its own execution satisfies that
instruction and must not spawn another. The four dimensions, the `findings` output shape and the
`synthesize` contract of §2 are unchanged — this is grounding added to existing nodes, not a re-shaped DAG.

**On "through the resolver".** The acceptance criterion for this change reads "`/explore`'s research nodes
read `research` through the resolver", while the node prompts forbid calling `resolveMethod`. Both are
correct and the tension is only in the word: "resolver" names the **three-tier resolution scheme** of
[ADR-0031](0031-methods-bundled-three-tier-resolution.md), not the `lib/methods-resolver.mjs` function. An
Archon node cannot import plugin `lib/` ([ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5), so
it reads the installed **bundle tier** directly at `.archon/methods/<name>/SKILL.md`. The consequence is
worth stating plainly: the config and `.local` override tiers **do not apply inside an Archon Box**, and
there is no resolved-tier log line here either. That is a real asymmetry with the four command Boxes, not
an oversight. A missing Method file is fatal for the node; the fix is `/unic-archon-dlc:setup`.

`test/archon-box-methods.test.mjs` holds this workflow to `lib/methods-manifest.mjs` in both directions, so
`research.providedTo` and the four node prompts cannot drift apart silently.

## Consequences

- **`/explore` runs again** — the shipped workflow was doubly dead (inert schema + a deleted import).
  Behavioural validation (the gate pauses in HITL, is skipped in AFK, the ticket is always filed) needs
  a real Archon run against a Consumer; it is logged as a manual follow-up, not asserted by CI (same
  posture as `/qa`, `/pr-review` — `archon validate` passes inert forms too,
  [ADR-0011](0011-archon-schema-target.md) §6).
- **`findings-writer.mjs` + `spike-verdicts.mjs` are dissolved** (and their tests), completing
  [ADR-0018](0018-generic-core-config-compose.md) #3 for the explore-only libs — the nodes write
  findings.md with their own tools. `labels-config.mjs` **stays** (`config-schema.mjs` still imports
  `getDefaultLabels`). This is a breaking change for any external caller of the two deleted modules;
  they were internal to the dead workflow, so there is none.
- **No new config key.** `gates.explore` + `artifacts_dir` already exist in `defaultConfig()`, so **no
  `/setup` change** is required this step (contrast [ADR-0025](0025-qa-pipeline-onramp.md)/
  [ADR-0028](0028-cleanup-operational-janitor.md), which added blocks).
- **The `/explore → /specs` handoff is now an explicit contract**, not an implicit one — a future change
  to either side must keep the three lens headings in sync.
