# 0027. `/improve-architecture` is a skill that composes Matt's method and owns ADR superseding

**Status:** Accepted (2026-07-03)

## Context

`/improve-architecture` is the off-line arch-health box ([ADR-0014](0014-workflow-per-box-decomposition.md)):
it surfaces architectural drift + deepening opportunities and **consolidates ADRs, including
superseding** older ones. It runs periodically or on demand, not per-feature and not as an
end-of-cycle auto-hook (PLAN #8).

The shipped `unic-dlc-cleanup` Archon workflow bundled two off-line concerns behind the inert
`type:`-style schema: an `arch-review` node (technical + intent drift, deepening) and an
`adr-consolidation` node (per-ADR approval gate). The two-axis pivot ([ADR-0017](0017-container-follows-structural-need.md))
splits arch-health out: because its core is a **design grilling loop** that needs the live
conversation, it is a **Claude Code command/skill**, not an Archon workflow — the same litmus that
kept `/triage` and `/specs` interactive.

There is already a strong reference implementation of the technical half: Matt Pocock's
`improve-codebase-architecture` skill, which walks the codebase for shallow modules / tight coupling /
leaky abstractions via the deletion test, presents deepening candidates as a self-contained HTML
report, and grills the picked candidate ([ADR-0021](0021-earns-its-place-compose-verbatim.md) says:
reference such a skill verbatim, don't reimplement). Three questions had to be resolved:

1. **How much to delegate to Matt's skill vs. reproduce** — does this box add enough over the raw skill
   to earn its place?
2. **Run scope** — per-slug (intent-grounded against a build session's PRD) or a repo-wide periodic
   sweep?
3. **Superseding mechanics** — which ADR homes, and how the index stays consistent.

These were grilled with the maintainer (2026-07-03); the decisions below are that outcome.

## Decision

### 1. Delegate the technical half verbatim; add the DLC layers

`/improve-architecture` **composes `improve-codebase-architecture` verbatim** for technical drift +
deepening (its `Explore` walk, deletion test, HTML report, before/after diagrams, and `/grilling` loop),
plus `/codebase-design` for the architecture vocabulary and `/domain-modeling` to keep `CONTEXT.md`
current — none of them reimplemented ([ADR-0016](0016-dlc-thin-process-layer.md)/
[ADR-0021](0021-earns-its-place-compose-verbatim.md)). It **earns its place** ([ADR-0021](0021-earns-its-place-compose-verbatim.md))
by adding three things Matt's skill lacks: (a) an **intent-drift** pass comparing the PRD's stories +
acceptance criteria against what shipped (harvested from the legacy `arch-review` node's Step 3), (b) a
**durable `arch-review.md`** artifact committed to the repo (Matt's HTML is ephemeral, in the OS temp
dir), and (c) an **ADR-consolidation gate with superseding** (harvested from the legacy
`adr-consolidation` node). It composes team skills for the _how_ and owns the _what_ — the same shape
as `/triage` ([ADR-0024](0024-triage-intake-on-ramp.md)).

### 2. Two modes, argument-driven

`/improve-architecture <slug>` runs **per-slug**: it resolves `<artifacts_dir>/<slug>/`, reads that
build session's `PRD.md` / `report.md` / `issues.json`, focuses the technical walk on the slug's changed
surface, and runs the intent-drift pass against the PRD. `/improve-architecture` with **no argument**
runs a **repo-wide sweep** over the whole codebase; with no PRD anchor the intent-drift pass is skipped
and recorded as `n/a`. A missing session file (or a missing config) is non-blocking — the box is
off-line and degrades rather than halting.

### 3. Durable artifact under the artifacts dir

Per-slug writes `<artifacts_dir>/<slug>/arch-review.md`; the sweep writes a dated
`<artifacts_dir>/arch-review-YYYY-MM-DD.md` (non-slug) ([ADR-0015](0015-workflows-slug-artifact-home.md)).
Sections: Technical Drift, Intent Drift (or `n/a`), Deepening Opportunities, Summary
(`CLEAN | ISSUES FOUND (count)`). This complements — not replaces — Matt's temp HTML.

### 4. ADR superseding across both homes, index-aware

The per-ADR gate (`Accept` / `Reject` / `Edit`) can write to **either ADR home** — the plugin-local
`apps/claude-code/<plugin>/docs/adr/` or the repo-root `docs/adr/` — inferred from what the decision
concerns and confirmed with the user; numbering is the next `NNNN` in the chosen home. Superseding
**never deletes** an ADR: it sets the old file's status to `**Status:** Superseded by ADR-NNNN`, adds a
`Supersedes ADR-NNNN` reference to the new one, and updates the **matching home's** `README.md` index
(old row Status cell → `Superseded by ADR-NNNN`; new row added). This follows the repo-root
`docs/adr/README.md` "Amending records" rule and keeps each home's index self-consistent.

### 5. No new config block, off-line, no auto-hook

The box reads `artifacts_dir` + `docs` + `skills.matt_suite` from `.archon/unic-dlc.config.yaml` but
adds **no new config keys** — it is thin ([ADR-0018](0018-generic-core-config-compose.md)) and needs no
tunable knobs. It is inherently HITL (interactive skill box) so it needs no `gates.*` entry. It stays
off the main line with **no end-of-cycle auto-hook** (PLAN #8); consumers run it on a cadence (every few
build cycles / when drift is felt).

## Consequences

- **Arch-health is now interactive and intent-grounded.** The technical review reuses Matt's proven
  method; the intent-drift pass and durable artifact are DLC additions the raw skill did not provide.
- **No `lib/` or `config-schema.mjs` change**, so no new tests; the existing suite stays green. Behaviour
  (lenient config load, per-slug vs sweep routing, superseding across both homes) is validated by
  reading, not by CI.
- **The legacy `unic-dlc-cleanup.yaml` still holds inert `arch-review` + `adr-consolidation` content.**
  This step **does not touch it** — retiring/rebuilding `/cleanup` as the repo-global operational janitor
  is **step 11's** scope. Until then the legacy workflow is dormant (inert schema), not a second live
  arch-review.
- **Manual follow-up:** a full end-to-end run against a real slug (and a real superseding of an ADR) is
  not asserted by CI; it is exercised on demand by consumers.
