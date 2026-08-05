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
([ADR-0022](../../docs/adr/0022-tickets-slice-to-build.md), [ADR-0023](../../docs/adr/0023-build-generic-red-green-refactor-loop.md)).

## What this workflow does

1. **bootstrap** — parse the slug from `$ARGUMENTS`, read `.archon/unic-dlc.config.yaml`
   (`artifacts_dir`, `gates.build`, `build.*`), confirm `issues.json` exists, and **derive the target
   repository** from the worktree's `origin` remote (`project.repo_ref` is an optional override, absent
   by default). Missing preconditions cancel cleanly with a "run /tickets first" message; an ambiguous
   repository cancels with its own message.

2. **slopcheck** — verify every package introduced since the last commit against the npm registry.
   Packages that can't be confirmed are flagged `[ASSUMED]` and halt the build until a human resolves
   them (or re-runs with `SLOPCHECK_BYPASS=1`).

3. **run-build** — one generic loop advances each slice through **three FRESH-context phases**, serially
   in dependency order (ADR-0012 / ADR-0023). Each phase is a separate fresh session; the baton is
   artefacts on disk + `<artifacts_dir>/<slug>/build-state.json`, never session memory:

   ```
   RED      write a test from the slice INTENT → run test_command → commit ONLY if it fails (exit ≠ 0)
   GREEN    read the committed test (not RED's reasoning) → minimum impl → assert green → commit
   REFACTOR clean up under the green suite → assert still green → commit (or no-op)
   ```

   A RED test that unexpectedly passes is not committed — the slice is flagged for human review.

4. **verification** — full test suite + a stub scan (TODO/FIXME/empty-return/`pass`) on the diff, plus
   the coverage threshold if configured.

5. **goals-check** — a coverage matrix mapping every PRD/issue acceptance criterion to test +
   implementation evidence.

6. **report** — writes `<artifacts_dir>/<slug>/report.md` (what was built, matrix, test outcomes,
   decisions/ADRs, tech debt).

7. **open-pr → build-pr-gate** — stages an explicit list of **named paths** (source, tests, `PRD.md`,
   `issues.json`, `report.md`, `build-state.json`, and any drafted ADR), confirms with
   `git status --porcelain` that nothing else is staged, opens a PR against the derived repository with
   base `develop`, then gates it. `build-state.json` is committed here and **only** here — never during
   a loop iteration — so the loop's anti-cheat record survives `/cleanup`. The gate is **HITL by default**
   and honours `gates.build`: skipped when `afk` (the PR is still opened). On **reject**, a
   verify-and-fix pass runs from the reviewer's feedback and the gate re-pauses — it does **not** rebuild
   from scratch.

## Prerequisites

- `/unic-archon-dlc:tickets <slug>` has run and its tickets PR is approved.
- `<artifacts_dir>/<slug>/issues.json` exists.
- `.archon/unic-dlc.config.yaml` is present (from `/unic-archon-dlc:setup`).
- The checkout has an `origin` remote, or `project.repo_ref` is set.
- Archon ≥ 0.5.0.

## Runs

```
archon workflow run unic-dlc-build --input <slug>
```
