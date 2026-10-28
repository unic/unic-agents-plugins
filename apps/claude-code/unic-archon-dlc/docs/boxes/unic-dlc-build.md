# /unic-dlc-build

Implement an approved set of vertical-slice issues test-first, with structural anti-cheating.

## Usage

```
/unic-dlc-build <slug>
```

`<slug>` is the session identifier from `/unic-archon-dlc:tickets`. The only prerequisite is the
build-ready **`<artifacts_dir>/<slug>/issues.json`** that `/tickets` produced (dependency-ordered,
each slice carrying its `acceptance_criteria` + `test_command`). There is **no generated
`build-<slug>.yaml`** — `/build` consumes `issues.json` directly via one generic loop
([ADR-0022](../adr/0022-tickets-slice-to-build.md), [ADR-0023](../adr/0023-build-generic-red-green-refactor-loop.md)).

## What this workflow does

1. **bootstrap** — parse the slug from `$ARGUMENTS`, read `.archon/unic-dlc.config.yaml`
   (`artifacts_dir`, `gates.build`, `build.*`, and the whole `sdlc_needs` block)
   and confirm `issues.json` exists. It also runs `sdlc_needs.install` once for the whole run and
   reports whether it did.
   It resolves **no** repository: `docs/agents/issue-tracker.md` § Addressing names it, and the nodes
   that reach the tracker read that file themselves. Missing preconditions cancel cleanly with a
   "run /tickets first" message.

2. **slopcheck** — verify every package introduced since the last commit against the npm registry.
   Packages that can't be confirmed are flagged `[ASSUMED]` and halt the build until a human resolves
   them (or re-runs with `SLOPCHECK_BYPASS=1`).

3. **run-build** — one generic loop advances each slice through **two FRESH-context phases**, serially
   in dependency order (ADR-0012 / ADR-0023). Each phase is a separate fresh session; the baton is
   artefacts on disk + `<artifacts_dir>/<slug>/build-state.json`, never session memory:

   ```
   RED      write a test from the slice INTENT → run test_command → commit ONLY if it fails (exit ≠ 0)
   GREEN    read the committed test (not RED's reasoning) → minimum impl → assert green → commit
   ```

   A RED test that unexpectedly passes is not committed — the slice is flagged for human review.

   There is no REFACTOR phase: the `tdd` Method puts refactoring in the review stage, so it reaches
   the code through `/unic-archon-dlc:pr-review`'s Standards axis instead (ADR-0023 §7, #281).

4. **verification** — the `sdlc_needs.test` suite, the `sdlc_needs.e2e` suite when that key is
   declared, a stub scan (TODO/FIXME/empty-return/`pass`) on the diff, and `sdlc_needs.coverage`
   against the threshold when one is configured. `test` reports `pass`, `fail` or `unresolved`, and a
   `test` the project does not declare is `unresolved` — never a pass. This node runs e2e and coverage
   only when it has a reason to, so where it has none it reports nothing about them rather than calling
   them unresolved: not wanted and could not run are different facts (ADR-0037 §5).

5. **goals-check** — a coverage matrix mapping every PRD/issue acceptance criterion to test +
   implementation evidence.

6. **evidence** — prints a three-state verdict (`pass` / `fail` / `unresolved`) as JSON, and writes
   `$ARTIFACTS_DIR/evidence.json` on **every** verdict. The verdict is `pass` only when
   `verification` and `goals-check` both report `passed: true` with an empty `failures` list **and**
   the test outcome is `pass`. An unresolved test is not an absence of failures. The file names the
   verdict and lists the failures behind it, so it tells you what failed. The node mirrors it to
   `<artifacts_dir>/<slug>/evidence.json`. A script node, never a prompt
   ([ADR-0034](../adr/0034-evidence-gate-deterministic-writer.md)). The workflow-level
   `evidence_policy: { required: true }` still refuses terminal `completed` without the file, which
   now happens only when `evidence` itself fails before it writes
   ([ADR-0040](../adr/0040-build-verdict-decides-the-pull-request.md)).

7. **report** — writes `<artifacts_dir>/<slug>/report.md`, led by a block naming every check that came
   back `unresolved` and whether an install ran, then what was built, the matrix, test outcomes,
   decisions/ADRs and tech debt. It runs on every verdict.

8. **commit-session → push-branch** — run on **every** verdict. `commit-session` stages an explicit
   list of **named paths** (source, tests, `PRD.md`, `issues.json`, `report.md`, `build-state.json`,
   `evidence.json`, and any drafted ADR), confirms with `git status --porcelain` that nothing else is
   staged, and commits. `build-state.json` is committed in `commit-session` and **only** there, never
   during a loop iteration, so the loop's anti-cheat record survives `/cleanup`. `push-branch` pushes
   the branch and reports the branch and the commit. If the push fails, the run ends `failed`: no work
   reached the remote.

9. **guard-not-pass** or **open-pr → build-pr-gate** — two siblings after `push-branch`, and the
   verdict picks one:
   - A verdict other than `pass` (`fail` or `unresolved`): `guard-not-pass` ends the run
     `cancelled` and no pull request is opened. Its message names the verdict, the pushed branch and
     commit, and the path of `report.md` and `evidence.json` on that branch. Read those to see what
     failed.
   - A `pass` verdict: `open-pr` opens a PR from the pushed branch against the repository the tracker
     contract names, with the run's base branch, Archon's `$BASE_BRANCH`, as its target, and links it
     to the slices' work items. `/unic-archon-dlc:setup` reports which branch that is. The gate is
     **HITL by default** and honours `gates.build`: skipped when `afk`, and the PR stays open. On
     **reject**, a verify-and-fix pass runs from the reviewer's feedback and the gate re-pauses — it
     does **not** rebuild from scratch.

## Prerequisites

- `/unic-archon-dlc:tickets <slug>` has run and its tickets PR is approved.
- `<artifacts_dir>/<slug>/issues.json` exists.
- `.archon/unic-dlc.config.yaml` is present (from `/unic-archon-dlc:setup`).
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` are present — this repository's
  tracker contract, which names the server, the repository, the work-item scope and every role.
- Archon ≥ 0.7.0 ([ADR-0033](../adr/0033-archon-070-schema-target.md)).

## Runs

```
archon workflow run unic-dlc-build "<slug>"
```
