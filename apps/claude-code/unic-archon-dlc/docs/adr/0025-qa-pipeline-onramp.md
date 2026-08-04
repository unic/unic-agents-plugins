# 0025. `/qa` is an Archon pipeline with two config-gated approvals and an issue-producing on-ramp

**Status:** Accepted (2026-07-02)

## Context

`/qa` is the final main-line box ([ADR-0014](0014-workflow-per-box-decomposition.md)): it validates an
implemented feature end-to-end and merges it. It is an **Archon workflow** because it is AFK-isolatable
pipeline work ([ADR-0017](0017-container-follows-structural-need.md)) — but unlike `/build` it needs a
**live human at UAT**, so it carries an interactive **approval** gate. PLAN #5 additionally makes `/qa`
an **issue-producing on-ramp**: defects found during QA become agent-ready issues rather than a dead
halt.

The shipped `qa` workflow used the inert `type:`-style schema — a blocking migration
([ADR-0011](0011-archon-schema-target.md)): its `type: interactive` UAT gate never paused, and it read
a flat `.archon/unic-dlc.config.json` with `docs/workflow/<slug>/` paths. `/qa` is the second Archon
box ported after `/build`, so it inherits `/build`'s conventions ([ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5)
rather than inventing new ones.

Two step-doc references were stale and are corrected here:

1. **"file it as a tracker issue via `lib/tracker-adapter.mjs`"** — `tracker-adapter` was **dissolved**
   ([ADR-0016](0016-dlc-thin-process-layer.md)/[ADR-0018](0018-generic-core-config-compose.md)). QA
   composes the configured tracker instead.
2. **"findings feed `/build`"** — PLAN decision #8 and [ADR-0024](0024-triage-intake-on-ramp.md) route
   on-ramps to `/tickets` (the convergence point). PLAN wins, exactly as `/triage` resolved it.

## Decision

### 1. Node graph — ported to the key-discriminated schema

`bootstrap → guard-not-ready → e2e → coverage-gate → uat-prep → uat-gate → verify-pr-base →
merge-gate → merge`, with `interactive: true` at the workflow level so both approval messages reach the
user ([ADR-0011](0011-archon-schema-target.md) §2). Following [ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5,
`bootstrap` is a `prompt:` node with `output_format` (it parses the slug from `$ARGUMENTS`, reads
`.archon/unic-dlc.config.yaml`, emits scalars); every node that touches config/tracker/repo context is a
`prompt:` node reading files with its own tools — **no plugin-`lib/` import, no `$CLAUDE_PLUGIN_ROOT`**.
Artefact paths are `<artifacts_dir>/<slug>/` ([ADR-0015](0015-workflows-slug-artifact-home.md)). The QA
baton is `<artifacts_dir>/<slug>/PRD.md` (the acceptance criteria) plus `report.md` if present.

`e2e` and `coverage-gate` **report a verdict** (`pass|fail|skip`) rather than hard-failing: a missing
`e2e_command` or `coverage_threshold` **skips with a warning** (generic-installable friendly), and a
real failure is surfaced at UAT and fail-closes the merge (below) — it does not abort the run before the
human sees it.

### 2. Test config: a `qa` block that falls back to `build.*`

A new `qa: { e2e_command, coverage_threshold }` block joins `defaultConfig()`, resolved as
`qa.e2e_command ?? build.e2e_command` (and likewise for coverage) in `bootstrap`. This lets a team run a
heavier QA suite than the unit tests `/build` runs, while defaulting to the same command. Both leaves
default `null` (→ skip). `mergeConfig` auto-fills the block for configs that predate it, so **no
`/setup` change is required** this step (same pattern as [ADR-0024](0024-triage-intake-on-ramp.md)).

### 3. Two separate gates, both governed by `gates.qa`; AFK survives via `trigger_rule: all_done`

UAT sign-off and merge authorisation are **distinct `approval:` nodes**, each `when: gates.qa == 'hitl'`.
Because a `when:false` node is skipped and **skipped state propagates to dependants**
(`references/workflow-dag.md`), the nodes downstream of a gate use **`trigger_rule: all_done`** (skipped
counts as terminal) so that in AFK mode (`gates.qa: afk`) the pipeline flows past the skipped gates and
**auto-merges a clean build**. A rejected gate cancels the whole run, so downstream never executes on a
rejected build.

The **merge node fail-closes** with
`when: "$e2e.output.result != 'fail' && $coverage-gate.output.result != 'fail' && $verify-pr-base.output.base_ok == 'true'"`.
This guarantees a red e2e/coverage or a wrong PR base **never auto-merges**, in either HITL or AFK —
the safety that `all_done` alone would not provide. `verify-pr-base` reports `base_ok` (a boolean in
`output_format`) rather than exiting non-zero, keeping the merge guard in one declarative place.

### 4. Finding-capture: UAT rejection files agent-ready issues before halting

When a defect surfaces, `/qa` is an on-ramp, not a dead end. The UAT gate's `approval.on_reject.prompt`
turns each failing criterion into a tracker issue **directly** (a human is present — no PR gate), then
re-pauses (`max_attempts: 1`) so a second reject halts the run with the findings durably tracked. The
issues are filed **`ready-for-agent`**, not `needs-triage`: the reviewer at the UAT gate has already
vetted the defect, so a second `/triage` pass is redundant. Filing composes the configured tracker
(MCP-first, CLI-fallback — [ADR-0016](0016-dlc-thin-process-layer.md)) and takes labels **only** from
`classification.labels` (the single source of truth — [ADR-0024](0024-triage-intake-on-ramp.md); Matt's
`docs/agents/*` are never read). The issue body follows the finding-capture brief shape (what happened /
expected / steps / blocked-by / context — no file paths, blocked-by honesty, prefer many thin issues) and carries
the mandated `> *This was generated by AI during QA.*` disclaimer. Findings feed `/tickets` (or `/build`
if already atomic), per PLAN #8.

## Consequences

- **`/qa` gains AFK opt-in** it lacked (the old `type: interactive` gate never paused, so QA was
  effectively always inert-HITL). Behavioural validation — gates pause, AFK skips-and-merges, a red
  build blocks merge — is required beyond `archon validate` ([ADR-0011](0011-archon-schema-target.md) §6),
  since `validate` passes inert forms too. `archon validate workflows unic-dlc-qa` passes clean.
- **New `qa` config block** in `config-schema.mjs` + tests; `mergeConfig` back-fills existing configs.
- **The on-ramp target is `/tickets`**, reconciling the step doc's "feed `/build`" with PLAN #8 — the
  same reconciliation [ADR-0024](0024-triage-intake-on-ramp.md) made for `/triage`.
- **Merge-safety is declarative, not procedural:** `all_done` + a fail-closed `when` replace the old
  script's imperative branching, and keep the AFK/HITL behaviour in the DAG rather than in prose.
- **Known item, not fixed here:** full end-to-end behavioural validation needs a real Archon run against
  a Consumer with an open PR; it is logged as a manual follow-up, not asserted by CI.
