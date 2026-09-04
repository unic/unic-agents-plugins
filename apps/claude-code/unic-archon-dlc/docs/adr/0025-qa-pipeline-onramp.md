# 0025. `/qa` is an Archon pipeline with two config-gated approvals and an issue-producing on-ramp

**Status:** Accepted (2026-07-02, revised 2026-09-04)

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

`bootstrap → guard-not-ready → test → e2e → coverage-gate → uat-prep → uat-gate → verify-pr-base →
merge-gate → merge`, with `interactive: true` at the workflow level so both approval messages reach the
user ([ADR-0011](0011-archon-schema-target.md) §2). Following [ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5,
`bootstrap` is a `prompt:` node with `output_format` (it parses the slug from `$ARGUMENTS`, reads
`.archon/unic-dlc.config.yaml`, emits scalars); every node that touches config/tracker/repo context is a
`prompt:` node reading files with its own tools — **no plugin-`lib/` import, no `$CLAUDE_PLUGIN_ROOT`**.
Artefact paths are `<artifacts_dir>/<slug>/` ([ADR-0015](0015-workflows-slug-artifact-home.md)). The QA
baton is `<artifacts_dir>/<slug>/PRD.md` (the acceptance criteria) plus `report.md` if present.

`test`, `e2e` and `coverage-gate` **report a verdict** (`pass|fail|unresolved`) rather than hard-failing:
a need this project does not declare is `unresolved`, and a real failure is surfaced at UAT and
fail-closes the merge (below) rather than aborting the run before the human sees it. `skip` left that
enum with [ADR-0037](0037-config-declares-sdlc-needs.md): each of these nodes exists to run one need, so
it always wants it, and an absent result is not a skipped one. `test` is new with that decision — before
it, this Box ran no test suite at all.

### 2. Test config: one `sdlc_needs` block, and a `qa` coverage threshold that falls back to `build.*`

Every command this Box runs comes from the top-level `sdlc_needs` block
([ADR-0037](0037-config-declares-sdlc-needs.md)): `test`, `e2e` and `coverage`, plus `install` at
`bootstrap`. The per-Box `qa.e2e_command ?? build.e2e_command` tier this ADR introduced is **retired**.
It let a team run a heavier QA suite than `/build`'s, but all four values were `null` in the only
Consumer that existed, so nothing ever used the tier, and a tier nobody uses is a second place for a
value to disagree with itself. What survives is `qa.coverage_threshold ?? build.coverage_threshold`,
resolved in `bootstrap` — a threshold is a number, not a need, so it stays out of the block.

### 3. Two separate gates, both governed by `gates.qa`; AFK survives via `trigger_rule: all_done`

UAT sign-off and merge authorisation are **distinct `approval:` nodes**, each `when: gates.qa == 'hitl'`.
Because a `when:false` node is skipped and **skipped state propagates to dependants**
(`references/workflow-dag.md`), the nodes downstream of a gate use **`trigger_rule: all_done`** (skipped
counts as terminal) so that in AFK mode (`gates.qa: afk`) the pipeline flows past the skipped gates and
**auto-merges a clean build**. A rejected gate cancels the whole run, so downstream never executes on a
rejected build.

The **merge node fail-closes** with
`when: "$test.output.result == 'pass' && $e2e.output.result != 'fail' && $coverage-gate.output.result != 'fail' && $verify-pr-base.output.base_ok == 'true'"`.
The asymmetry is the floor of [ADR-0037](0037-config-declares-sdlc-needs.md): `test` is the one need
this gate cannot advance without, so an `unresolved` test holds the merge, while an unresolved e2e or
coverage reports and lets it through.
This guarantees that a red test, e2e or coverage, a test that could not run, or a wrong PR base
**never auto-merges**, in either HITL or AFK —
the safety that `all_done` alone would not provide. `verify-pr-base` reports `base_ok` (a boolean in
`output_format`) rather than exiting non-zero, keeping the merge guard in one declarative place.

### 4. Finding-capture: UAT rejection files agent-ready issues before halting

When a defect surfaces, `/qa` is an on-ramp, not a dead end. The UAT gate's `approval.on_reject.prompt`
turns each failing criterion into a tracker issue **directly** (a human is present — no PR gate), then
re-pauses (`max_attempts: 1`) so a second reject halts the run with the findings durably tracked. The
issues are filed **`ready-for-agent`**, not `needs-triage`: the reviewer at the UAT gate has already
vetted the defect, so a second `/triage` pass is redundant. Filing composes the configured tracker
(MCP-first, CLI-fallback — [ADR-0016](0016-dlc-thin-process-layer.md)) and resolves every role through
the **tracker contract**, `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`, where each
role carries its own axis. Those two repo-local files replaced the config's `classification.labels` and
its `tracker.access` / `tracker.coords` keys in #389; wherever an older reading of this ADR resolved a
role or named a tracker through config, it reads those files now
([ADR-0024](0024-triage-intake-on-ramp.md)). The issue body follows the finding-capture brief shape (what happened /
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
