# Step 06 — `/build` (KEYSTONE: anti-cheating red/green)

> **⚠ Two-axis update (2026-07-02):** `/build` **stays an Archon workflow** (AFK-isolated — where Archon earns its keep). Port it to the key-discriminated schema (ADR-0011) and keep it generic + config-driven (ADR-0016/0018). The red/green contract is unchanged (ADR-0012). **[PLAN.md](./PLAN.md) is canonical.**

> **⚠ Step-05 update ([ADR-0022](../adr/0022-tickets-slice-to-build.md), 2026-07-02):** `/tickets` no longer generates a per-slug `build-<slug>.yaml`, and `lib/dag-builder.mjs` is off the main path. `/build` consumes step 05's build-ready, dependency-ordered **`issues.json`** directly. Author **one generic `unic-dlc-build` workflow** whose `loop:` node walks the sorted `issues.json`, running fresh-context red→green **per slice** — contract B is preserved, its delivery mechanism is a generic loop, not codegen. Slices build **serially** in dependency order. Decide `dag-builder`'s fate here (likely dissolve it + its test).

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md), especially contract B.** The most important step. Depends on step 05 (build-ready `<artifacts_dir>/<slug>/issues.json`).

## Goal

A generic `unic-dlc-build` workflow that loops over `issues.json` in dependency order with **structural anti-cheating**: tests (red) and implementation (green) never share session context, yet both receive the slice's original intent (its `acceptance_criteria`) and its `test_command`.

## Task

- Keep the existing wrapper shape where useful: `slopcheck → run-build → verification → goals-check → report → build-pr-gate`.
- **Enforce contract B in a generic `loop:` node** (ADR-0011 schema; reads `<artifacts_dir>/<slug>/issues.json`, iterating in the already-sorted dependency order): for each slice, a RED phase runs with fresh context (`loop.fresh_context: true` / `context: fresh` — never the inert node-level `fresh_context:`), writes the failing test from the **slice intent** (`acceptance_criteria`), RUNS `test_command`, **asserts it fails**, commits; a GREEN phase starts fresh, receives the same intent + the committed failing test (NOT red's reasoning), writes minimum impl, asserts green. Slices with `test_command_planned` write the test as part of the slice.
- Decide **how RED proves failure** in the target schema (exit code, `until_bash`, a verification node).
- Decide **refactor placement** (open item from step 05): tail of GREEN vs a third fresh phase.
- **Revisit the nested-invocation risk** (PLAN.md risk #2): with no generated child workflow to invoke, `run-build` no longer needs to shell out to `archon workflow run` — the loop runs inline. Confirm the inline loop is the right shape and retire the risk if so.
- `build-pr-gate` = HITL by default; on reject → return to `verification` (not full rebuild). Honour `gates.build` config.

## Open questions to grill first

- RED-failure assertion mechanism on the confirmed schema.
- Refactor phase: separate or folded into GREEN?
- `dag-builder`'s disposition: dissolve now that the generic loop replaces it?

## Done when

A fixture slice (from a sample `issues.json`) demonstrates: RED commits a provably-failing test → GREEN runs in a **fresh context**, sees only intent + committed test, reaches green. The loop advances through dependency order; verification/goals-check/report/gate all run. The keystone ADR (step 01) is reflected in the implementation. PR to `develop`.

## Suggested skills

`/archon`, `/tdd`, `/grilling`, `/domain-modeling`. Reference `.agents/skills/{tdd,implement}/SKILL.md`.
