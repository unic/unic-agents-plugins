# 0022. `/tickets` slices a PRD into build-ready issues; `/build` consumes them via a generic loop

**Status:** Accepted (2026-07-02)

## Context

`/tickets` is the second main-line box ([ADR-0014](0014-workflow-per-box-decomposition.md) box set):
it turns one approved PRD into independently-grabbable **vertical tracer-bullet slices**. The shipped
design carved this out of the monolithic `unic-dlc-plan.yaml` as five Archon nodes
(`to-issues → nyquist-map → plan-checker → yaml-gen → plan-pr-gate`), where `yaml-gen` called
`lib/dag-builder.mjs` to compile the slices into a per-slug `.archon/workflows/build-<slug>.yaml`
that `/build` would then execute.

Two questions surfaced when implementing the box:

1. **Container.** Slicing is a live negotiation (granularity, dependencies) — it needs the
   conversation, so per [ADR-0017](0017-container-follows-structural-need.md) `/tickets` is a
   command/skill, not an Archon workflow.
2. **Does `/build` need a _generated_ DAG at all?** The generated `build-<slug>.yaml` is codegen —
   the least-generic thing in a plugin whose north-star is "generic core + config"
   ([ADR-0018](0018-generic-core-config-compose.md)). Its only real payoff over a generic runtime
   loop is running _independent_ slices in **parallel** (an arbitrary `blocked_by` partial order
   can't be expressed by a runtime loop, only by static graph edges) — at the cost of codegen plus
   the risk of parallel worktree edits colliding on shared files. `issues.json` (dependency-ordered,
   each slice carrying its acceptance criteria + test command) is the real baton either way.

## Decision

`/tickets` is an **in-session command/skill** ([ADR-0017](0017-container-follows-structural-need.md))
that **composes** Matt Pocock's `/to-issues` for slicing and the configured **tracker system-skill /
CLI** for publishing ([ADR-0016](0016-dlc-thin-process-layer.md)). It owns the flow:

1. Slice the PRD into vertical tracer bullets — one slice = **one demoable behaviour**, thin enough
   that strict red/green ([ADR-0012](0012-fresh-context-red-green-separation.md)) is safe; iterate
   with the user until approved.
2. **nyquist-map** — attach a test seam (`test_command` or `test_command_planned`) per slice.
3. **plan-checker** — validate the set (dependency integrity, PRD-criteria coverage, mandatory
   fields, test-seam presence, decision coverage) as a **single conversational pass**, not the
   old Archon 3-iteration loop with stall detection (loop mechanics are meaningless when the user
   drives the iterations).
4. Write a dependency-ordered **`issues.json`** to `<artifacts_dir>/<slug>/` (reusing
   `lib/issues-schema.mjs`: `validateIssue`, `sortByDependency`, `buildIssuesJson`).
5. Publish issues to the tracker in dependency order; **intent (acceptance criteria) lives on the
   tracker issue** (contract C, [ADR-0013](0013-tracker-single-source-of-truth.md)) **and** in
   `issues.json`.
6. A HITL **tickets gate** (`tickets.gate = open-pr | stage-only`, default `open-pr`).

**`/tickets` stops at a build-ready `issues.json`. It does NOT generate a build workflow.** `/build`
(step 06) ships **one generic Archon workflow** whose `loop:` node walks the sorted `issues.json`,
running fresh-context red→green per slice — so contract B ([ADR-0012](0012-fresh-context-red-green-separation.md))
is **preserved**, its _delivery mechanism_ moves from per-slug codegen to a generic runtime loop.
Slices build **serially** in dependency order (independent-slice parallelism is dropped — slices in
one feature often touch overlapping code, so serial is also safer against worktree collisions).

Estimation is config-gated and **composed, never built** ([ADR-0021](0021-earns-its-place-compose-verbatim.md)):
`/tickets` runs the **definitive** wave when `estimations` is `definitive | both`.

## Consequences

- `lib/dag-builder.mjs` is no longer on the main path; its fate (likely dissolution in favour of the
  generic loop) belongs to the `/build` step. Step 05 leaves it untouched.
- The legacy `.archon/workflows/unic-dlc-plan.yaml` + its command stub are **deleted** — `/specs` +
  `/tickets` fully cover their scope, and the old workflow used the inert `type:`-style schema
  ([ADR-0011](0011-archon-schema-target.md)).
- `lib/tracker-adapter.mjs` is **dissolved** ([ADR-0018](0018-generic-core-config-compose.md)):
  `/tickets` composes the tracker skill/CLI from config in prose (MCP-first, CLI-fallback) rather
  than a lib building CLI strings.
- A `tickets.gate` config key is added (mirrors `specs.gate`).
- The step-06 handoff doc (`docs/redesign/06-build.md`) is updated to consume `issues.json` via a
  generic loop rather than a generated DAG, and to revisit the nested-`archon workflow run` risk
  (there is no longer a generated child workflow to invoke).
