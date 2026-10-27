---
description: Run the unic-archon-dlc QA workflow — test suite, e2e, coverage gate, UAT sign-off, PR-base check, and merge. UAT findings become agent-ready tracker issues.
---

# /unic-dlc-qa

Runs the `qa` box: PR check → test suite → end-to-end tests → coverage gate → UAT sign-off → PR-base
verification → merge. The test suite is the floor: the merge gate cannot advance without a pass.
Every run that does not merge ends `cancelled`, with a message that names why. Only a merge that
landed ends `completed`.
It is also an **issue-producing on-ramp** — when UAT surfaces a defect, the workflow files it directly
as an **agent-ready tracker issue** (feeding `/tickets`) instead of only halting. Ported to the
key-discriminated Archon node schema ([ADR-0011](../adr/0011-archon-schema-target.md)); design in
[ADR-0025](../adr/0025-qa-pipeline-onramp.md).

## Usage

```
/unic-dlc-qa <slug>
```

`<slug>` is the session identifier from `/unic-archon-dlc:specs` / `tickets` / `build`. The only
prerequisite baton is `<artifacts_dir>/<slug>/PRD.md` (the acceptance criteria the UAT checklist reads
from), which `/build` implemented against.

## What this workflow does

1. **bootstrap** — parse the slug from `$ARGUMENTS`, read `.archon/unic-dlc.config.yaml`
   (`artifacts_dir`, `gates.qa`, `qa.coverage_threshold ?? build.coverage_threshold`,
   `project.branching`, and the whole `sdlc_needs` block) and confirm `PRD.md`
   exists. It also runs `sdlc_needs.install` once for the whole run and reports whether it did. It resolves **no** repository: `docs/agents/issue-tracker.md` § Addressing names it, and the
   nodes that reach the tracker read that file themselves. Missing preconditions cancel cleanly with a
   "run /build first" message.

2. **pr-check** — read the state of the PR for the current branch through the tracker contract,
   before any test runs. It reports `pr_state`: `open`, `merged`, `closed`, `none` or `unknown`. On
   any state but `open`, `guard-no-open-pr` cancels the run before `test` starts, with the message for
   its case:

   | `pr_state` | Message                                                                                                                                                                                                                                                                  |
   | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `none`     | No PR was ever opened for this branch. Fix the build and re-run /build.                                                                                                                                                                                                  |
   | `merged`   | The PR for this branch is already merged. Nothing to do.                                                                                                                                                                                                                 |
   | `closed`   | The PR for this branch was closed without merging. Reopen it, or abandon the work.                                                                                                                                                                                       |
   | `unknown`  | The PR state could not be read, with the cause. A failed query gives the error as received and says to check access to the tracker and re-run /qa. A missing or unusable `docs/agents/issue-tracker.md` names the file and says to add it with `/unic-archon-dlc:setup`. |

3. **test** — run `sdlc_needs.test`. Reports `pass`, `fail` or `unresolved`; a need this project does
   not declare is `unresolved`, never a skip. This is the **floor**: the merge below cannot advance
   without a `pass` here.

4. **e2e** — run `sdlc_needs.e2e`. Same three states, and `unresolved` here does not hold the merge.
   Reports a verdict (does not hard-fail).

5. **coverage-gate** — run `sdlc_needs.coverage` and compare the figure to the resolved threshold.
   Same three states: a null key or a null threshold is `unresolved`, not a skip, and it does not hold
   the merge either.

6. **uat-prep** — build a numbered UAT checklist (`AC-1`, `AC-2`, …) from the PRD acceptance criteria +
   `/build`'s goals-check matrix in `report.md`. It **writes** the checklist to
   `<artifacts_dir>/<slug>/qa-checks.md` as well as printing it, led by a block naming every check that
   came back `unresolved` and whether an install ran. This Box has no report node, so a block only
   printed would die with the worktree.

7. **uat-gate** — **HITL by default** (`gates.qa`); skipped in AFK. The human reviews the checklist and
   the test/e2e/coverage results. On **reject**, each failing item is **filed as an agent-ready tracker
   item** (through the tracker contract in `docs/agents/`, with the inlined finding-capture brief
   shape, blocked-by honesty, and the `> *This was generated by AI during QA.*` disclaimer), then the
   gate re-pauses so a second reject halts the run. A red check still reaches this gate, so the human
   can file it as a ticket.

8. **verify-pr-base** — read the PR state again, because a PR can be merged or closed during UAT, and
   confirm the open PR targets the run's base branch, Archon's `$BASE_BRANCH`, through the tracker
   contract and naming the repository it gives explicitly. `/unic-archon-dlc:setup` reports which
   branch that is. It reports `pr_state` and `base_ok`. `base_ok` means only "the open PR targets
   `$BASE_BRANCH`", so it is `false` whenever no PR is open, on a mismatch, and on a failed query.
   It also reports `blockers`: one sentence for every reason the merge cannot run.

   `guard-not-mergeable` then cancels the run when any of these holds: `test` is not `pass`, `e2e` or
   `coverage-gate` is `fail`, the PR is not open, or `base_ok` is not `true`. Its message joins the
   sentence for every cause that held, so one cause never hides another. A PR that is not open gets
   the message for its case from the table in step 2. A wrong base reads "The PR targets `<actual>`
   but `<expected>` was expected", never that the PR is missing. The message ends with the raw
   results. An `unresolved` e2e or coverage result is not a cause and does not block the merge.

9. **merge-gate → merge** — **HITL by default** (`gates.qa`); skipped in AFK. `merge-gate` asks for
   approval only when `merge` would run: its `when` is the HITL check plus every condition of the
   `when` on `merge`. On approval (or in AFK) the PR is merged via the configured tracker and the
   feature branch is cleaned up on Gitflow. The merge **fail-closes**: it never runs on a failed test,
   e2e or coverage, on a PR that is not open, on a wrong base, or on a `test` need that could not run.
   `test` is the floor and its clause requires a `pass`, while e2e and coverage only have to avoid a
   `fail`.

   `merge` reports `merged`. When it runs and the merge does not land, because the tracker contract
   is missing, the tracker cannot merge, the branch policy refuses or the merge call errors,
   `guard-not-merged` cancels the run with the reason, and with the manual steps when the tracker
   cannot merge. The line `merge: QA for "<slug>" complete … ✓` appears only after a merge that
   landed. If writing `resolved` failed on some items, the line names them and does not count them.
   Such a run still ends `completed`, because the merge is never undone.

## Gates & AFK

`gates.qa` (default `hitl`) governs **both** the UAT gate and the merge gate. Set it to `afk` to run the
whole pipeline unattended — the gates are skipped and a clean build auto-merges. An unresolved or red test, a red e2e or coverage, or a
mismatched PR base blocks the merge even in AFK (fail-closed `when`), and the run ends `cancelled`.

## Prerequisites

- `/unic-archon-dlc:build <slug>` has run and its PR has been reviewed.
- `<artifacts_dir>/<slug>/PRD.md` exists.
- `.archon/unic-dlc.config.yaml` is present (from `/unic-archon-dlc:setup`).
- The current branch has an open PR targeting the base branch (for verify-pr-base + merge).
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` are present — this repository's
  tracker contract, which names the server, the repository, the work-item scope and every role.
- Archon ≥ 0.7.0 ([ADR-0033](../adr/0033-archon-070-schema-target.md)).

## Configuration reference

Read from `.archon/unic-dlc.config.yaml`:

| Field                   | Type         | Default     | Description                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gates.qa`              | `hitl`/`afk` | `hitl`      | HITL pauses at UAT + merge; AFK skips both and auto-merges a clean run                                                                                                                                                                                                                                                                                |
| `qa.coverage_threshold` | number/null  | `null`      | Minimum coverage %; falls back to `build.coverage_threshold`; null → unresolved                                                                                                                                                                                                                                                                       |
| `sdlc_needs`            | object       | nine nulls  | What this project's development process needs. A key names a **need**, never a tool. `test`, `e2e` and `coverage` are the check keys this Box reads, and a null one is an **unresolved** check. `install` is not a check: `bootstrap` runs it once if it is declared and reports either way through `install_report`, which has no `unresolved` state |
| `artifacts_dir`         | string       | `workflows` | Session artefact home (`<artifacts_dir>/<slug>/`)                                                                                                                                                                                                                                                                                                     |
| `project.branching`     | string       | `gitflow`   | `gitflow` → delete the merged `feature/*` branch after the merge. It names no base branch. The run's base is Archon's `$BASE_BRANCH`, which `/unic-archon-dlc:setup` reports                                                                                                                                                                          |

The tracker itself is **not** configured here. `docs/agents/issue-tracker.md` and
`docs/agents/triage-labels.md` carry the server, the repository, the work-item scope and the roles.

The merge **style** is not configured either. The host's branch policy decides it, and where that
policy allows a choice the team's own `CLAUDE.md` states the rule.

## Runs

```
archon workflow run unic-dlc-qa "<slug>"
```
