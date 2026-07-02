# Step 06 — `/build` (KEYSTONE: anti-cheating red/green)

> **⚠ Two-axis update (2026-07-02):** `/build` **stays an Archon workflow** (AFK-isolated — where Archon earns its keep). Port it to the key-discriminated schema (ADR-0011) and keep it generic + config-driven (ADR-0016/0018). The red/green contract is unchanged (ADR-0012). **[PLAN.md](./PLAN.md) is canonical.**

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md), especially contract B.** The most important step. Depends on step 05 (generated `build-<slug>.yaml`).

## Goal

A `unic-dlc-build` workflow that executes the per-slug generated build DAG with **structural anti-cheating**: tests (red) and implementation (green) never share session context, yet both receive the slice's original intent.

## Task

- Keep the existing wrapper shape where useful: `slopcheck → run-build → verification → goals-check → report → build-pr-gate`.
- **Enforce contract B in the generated DAG** (coordinate with `lib/dag-builder.mjs` from step 05): each `code-red-<id>` and `code-green-<id>` node runs with `fresh_context: true`; RED writes the failing test from the **slice intent** (acceptance criteria), RUNS it, **asserts it fails**, commits; GREEN starts fresh, receives intent + the committed failing test (NOT red's reasoning), writes minimum impl, asserts green.
- Decide **how RED proves failure** in the target schema (exit code, `until_bash`, a verification node).
- Decide **refactor placement** (open item from step 05): tail of GREEN vs a third fresh node.
- **Resolve the nested-invocation risk** (PLAN.md risk #2): `run-build` shells out to `archon workflow run` from inside a workflow, which the `/archon` skill warns can hang under `CLAUDECODE=1`. Choose: nested (with the documented workaround), inlined generation, or sibling invocation.
- `build-pr-gate` = HITL by default; on reject → return to `verification` (not full rebuild). Honour `gates.build` config.

## Open questions to grill first

- RED-failure assertion mechanism on the confirmed schema.
- Refactor node: separate or folded?
- Nested vs inlined build-DAG execution.

## Done when

A fixture slice demonstrates: RED commits a provably-failing test → GREEN runs in a **fresh context**, sees only intent + committed test, reaches green. Verification/goals-check/report/gate all run. The keystone ADR (step 01) is reflected in the implementation. PR to `develop`.

## Suggested skills

`/archon`, `/tdd`, `/grilling`, `/domain-modeling`. Reference `.agents/skills/{tdd,implement}/SKILL.md`.
