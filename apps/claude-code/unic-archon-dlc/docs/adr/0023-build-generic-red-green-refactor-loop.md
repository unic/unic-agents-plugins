# 0023. `/build` is one generic red/green/refactor loop over `issues.json`

**Status:** Accepted (2026-07-02)

## Context

`/build` is the keystone main-line box ([ADR-0014](0014-workflow-per-box-decomposition.md)): it turns
the build-ready `issues.json` that `/tickets` produces ([ADR-0022](0022-tickets-slice-to-build.md))
into committed, tested code. It is an **Archon workflow** because it is AFK-isolated work with no live
conversation ([ADR-0017](0017-container-follows-structural-need.md)), and its red/green discipline must
be **structurally anti-cheating** ([ADR-0012](0012-fresh-context-red-green-separation.md)): the agent
that writes the failing test and the agent that makes it pass must not share a session, or an
unattended loop can write tests it already plans to pass.

Two constraints shaped the port:

1. **The shipped workflow uses the inert `type:`-style schema** — a blocking migration to the
   key-discriminated node schema ([ADR-0011](0011-archon-schema-target.md)). `/build` is the **first**
   Archon box ported, so it sets conventions the remaining boxes (`/qa`, `/pr-review`, `/explore`)
   inherit.
2. **`/tickets` no longer generates a per-slug `build-<slug>.yaml`** ([ADR-0022](0022-tickets-slice-to-build.md)).
   `/build` consumes `issues.json` (dependency-ordered) directly. That removes the codegen path and
   forces a decision on how a _generic runtime loop_ realizes the fresh-context red/green contract.

Open questions carried into this step (from `docs/redesign/06-build.md`): how RED proves failure on the
real schema; where refactor sits; whether `lib/dag-builder.mjs` dissolves; and whether the
nested-`archon workflow run` risk (PLAN risk #2) survives.

## Decision

### 1. One generic workflow, one `loop:` node — no codegen

`/build` ships a single, fixed, generic `unic-dlc-build` workflow. A single `loop:` node
(`fresh_context: true`) walks the already-sorted `issues.json` **serially in dependency order**. There
is **no generated child workflow**, so `run-build` runs the loop **inline** — the nested
`archon workflow run` fragility under `CLAUDECODE=1` (PLAN risk #2) **no longer applies and is
retired**. Independent-slice parallelism is dropped on purpose ([ADR-0022](0022-tickets-slice-to-build.md)):
slices in one feature often touch overlapping files, so serial is also collision-safe in the worktree.

### 2. Three fresh phases per slice, state on disk

A loop iteration is **one fresh session**, so RED and GREEN cannot both live in one iteration without
sharing context — the exact cheat [ADR-0012](0012-fresh-context-red-green-separation.md) forbids.
Therefore each slice is advanced by **three separate fresh iterations**:

```
RED      (fresh) ← slice INTENT (acceptance_criteria)          → write failing test → prove RED → commit
GREEN    (fresh) ← slice INTENT + committed test (NOT red's session) → min impl → assert GREEN → commit
REFACTOR (fresh) ← committed impl + green tests as the safety net    → clean up → assert still GREEN → commit
```

The baton between phases is **artefacts on disk, never session memory**: the committed failing test is
what GREEN must satisfy; the committed implementation + green suite is what REFACTOR guards. A
`<artifacts_dir>/<slug>/build-state.json` file records each slice's phase (`pending → red-done →
green-done → refactor-done`), so any fresh iteration can compute the next `(slice, phase)` by reading
`issues.json` + `build-state.json`. The loop signals `<promise>COMPLETE</promise>` when every slice is
`refactor-done`.

Refactor is a **separate third fresh phase**, not a tail of GREEN: it keeps every commit single-purpose
and keeps the loop's state machine uniform (one phase per iteration). Refactor writes no tests, so its
fresh context costs no anti-cheat guarantee; it reads the committed impl from disk.

### 3. RED proves failure by exit code, inside the RED iteration

RED writes the test, **runs the slice's `test_command`, and commits the test only if the command exits
non-zero.** If the new test unexpectedly **passes** (exit 0), RED does **not** commit — it flags the
slice in `build-state.json` (`red_unexpected_pass`) for human review, because a test that passes before
any implementation is not testing the new behaviour. The observed exit status is recorded in
`build-state.json`. This is the schema-native fit: RED is a loop iteration, so proof lives _inside_ the
iteration (exit-code gate), not in a separate node or the loop's `until_bash` (which signals _loop_
completion for the whole run, not per-slice red-proof). Slices carrying `test_command_planned: true`
write the test as part of the slice, then follow the same exit-code gate.

### 4. `lib/dag-builder.mjs` is dissolved

The generic loop replaces the per-slug DAG codegen, so `lib/dag-builder.mjs` and
`test/dag-builder.test.mjs` are **deleted** and removed from the `test` script. This was flagged as
likely in [ADR-0022](0022-tickets-slice-to-build.md) and realizes the generic-core principle
([ADR-0018](0018-generic-core-config-compose.md)): codegen was the least-generic artefact in the plugin.

### 5. Shipped Archon workflows are self-contained — no plugin-`lib/` import

`/setup` installs only the workflow YAMLs and command stubs into a Consumer's `.archon/` — **not** the
plugin's `lib/`. And `$CLAUDE_PLUGIN_ROOT` is a Claude Code env var that is not reliably set inside
Archon's `bun`/`uv` script runner. Therefore **shipped Archon workflow `script:` nodes must be
self-contained** (inline the logic; no `import` of plugin `lib/`), and anything needing repo/config
context that would otherwise use lib is done in a **`prompt:` node** (the agent reads files with its
own tools). Concretely for `/build`:

- **`bootstrap`** is a `prompt:` node with `output_format`: it parses the slug from `$ARGUMENTS`, reads
  `.archon/unic-dlc.config.yaml`, and emits `{ slug, artifacts_dir, gate, test/e2e/coverage }` as
  structured JSON.
- **`slopcheck`** is a self-contained `script:` node (`runtime: bun`) that inlines the new-package
  registry gate. `lib/slopcheck.mjs` remains the **tested reference** the inline mirrors, but the
  shipped node does not import it.

This convention is binding for the remaining Archon boxes.

### 6. Gate honoring; reject returns to verification, not a full rebuild

The `build-pr-gate` is an `approval:` node with `interactive: true` at the workflow level
([ADR-0011](0011-archon-schema-target.md)). It honours `gates.build` from config: it runs `when` the
gate is `hitl` and is skipped when `afk` (the PR is still opened by the preceding `open-pr` node). On
**reject**, `approval.on_reject.prompt` re-runs verification-and-fix from the reviewer's feedback and
re-pauses at the same gate (`max_attempts: 3`) — it does **not** restart the whole build.

## Consequences

- The keystone contract B ([ADR-0012](0012-fresh-context-red-green-separation.md)) is **preserved**; only
  its delivery mechanism moved from per-slug codegen to a generic runtime loop with on-disk state.
- `max_iterations` is a static YAML integer (it cannot be derived from the slice count at author time);
  it is set generously (`60` ≈ 20 slices × 3 phases). A pathological over-large `issues.json` would need
  the ceiling raised — a known, logged limit, not silent truncation.
- The self-contained-script convention (§5) is the pattern the next Archon boxes follow; it is recorded
  here because `/build` is the first port.
- `docs/workflow/<slug>/` artefact paths become `<artifacts_dir>/<slug>/` ([ADR-0015](0015-workflows-slug-artifact-home.md)).
- Full behavioural validation (gates pause, loop iterates, fresh context isolates) is required beyond
  `archon validate` ([ADR-0011](0011-archon-schema-target.md) §6), since `validate` passes the inert
  forms too.
