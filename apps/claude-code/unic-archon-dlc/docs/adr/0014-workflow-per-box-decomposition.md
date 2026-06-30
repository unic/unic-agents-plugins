# 0014. Workflow-per-box decomposition

**Status:** Accepted (2026-06-30)

## Context

The plugin shipped **six bundled workflow DAGs** (`explore`, `plan`, `build`, `qa`, `cleanup`, `triage`) as one indivisible set. Two of those DAGs each did two unrelated jobs:

- `plan` bundled _grill → PRD_ (requirements) with _decompose → issues_ (slicing) in one workflow.
- `cleanup` bundled _architecture health_ (drift review, deepening, ADR consolidation) with _operational janitoring_ (pruning stale worktrees/branches/PRs).

And `triage`'s only job — generating `HANDOFF.md`/`ROADMAP.md` — is retired by [ADR-0013](0013-tracker-single-source-of-truth.md).

The redesign ([`docs/redesign/PLAN.md`](../redesign/PLAN.md), decisions #2/#6/#8) replaces the bundle with a **workflow-per-box** set aligned to Matt Pocock's skills, where each box is independently invocable and hands a written artefact (the "baton") to the next.

## Decision

The plugin's workflows are decomposed into the following **box set**:

```
MAIN LINE   /specs ──► /tickets ──► /build ──► /pr-review ──► /qa
                          ▲
ON-RAMPS    /triage ──────┤   (raw bugs/requests → agent-ready issues)
            /qa findings ─┤
            humans ───────┘
OFF-LINE    /setup · /explore · /improve-architecture · /cleanup · /handoff
```

Mapping from the shipped workflows:

| Shipped           | → Target                                         | Disposition                                                                                          |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `setup` (command) | `/setup`                                         | Keep; gains config flags (gates, red/green, model profile).                                          |
| `explore`         | `/explore`                                       | Keep, **moved off-line**; optional; emits `findings.md` that may feed `/specs`.                      |
| `plan`            | **split** → `/specs` + `/tickets`                | `/specs` = grill → PRD. `/tickets` = decompose → issues (incl. Nyquist map + yaml-gen).              |
| `triage` (old)    | **retired**                                      | State-snapshot job dropped ([ADR-0013](0013-tracker-single-source-of-truth.md)).                     |
| —                 | `/triage` (new)                                  | **Intake on-ramp**: raw bugs/requests → agent-ready issues.                                          |
| `build`           | `/build`                                         | Keep; reworked for anti-cheating red/green ([ADR-0012](0012-fresh-context-red-green-separation.md)). |
| `review`          | `/pr-review`                                     | Renamed; same 4-aspect review.                                                                       |
| `qa`              | `/qa`                                            | Keep; also recognised as an issue-producing on-ramp.                                                 |
| `cleanup`         | **split** → `/improve-architecture` + `/cleanup` | Arch-health (incl. ADR consolidation/superseding) vs. operational janitor.                           |
| —                 | `/handoff` (new)                                 | Matt's per-thread session bridge.                                                                    |

Revised meanings to note explicitly:

- **`/triage`** is now an _intake on-ramp_ (Matt's), not the old state-snapshot generator.
- **`/cleanup`** is now an _operational janitor_ (prune merged/stale worktrees, branches, PRs), distinct from **`/improve-architecture`**, which owns architecture health and ADR consolidation/superseding.
- **`/pr-review`** is the renamed `review` box.

This ADR also introduces the term **agent-ready issue**: an issue carrying acceptance criteria (in the tracker, not conversation memory) suitable for `/build` to consume. Agent-ready issues are produced by the `/triage` intake on-ramp, `/tickets` slicing, `/qa` findings, or humans.

## Consequences

- This supersedes the bundled six-phase design and the bundled `plan` workflow. The plugin's `AGENTS.md` one-liner, doctrines, and "Do not add" entries that asserted "all six phases ship as one bundle" are updated; [`CONTEXT.md`](../../CONTEXT.md) gains the new workflow names and the revised `triage`/`cleanup`/`improve-architecture` meanings.
- Each box is built in its own redesign step (02–13); this ADR fixes the box set and names, not the per-box internals.
- ADR consolidation/superseding moves from the old `cleanup` workflow to `/improve-architecture`; the `ADR` and `arch-review` vocabulary in `CONTEXT.md` is repointed accordingly.
- Per-box invocability does **not** introduce parallel-Session orchestration — the linear main line still runs one Session at a time (existing doctrine preserved).
