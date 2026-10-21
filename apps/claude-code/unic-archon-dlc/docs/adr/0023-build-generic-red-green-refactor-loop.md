# 0023. `/build` is one generic red/green loop over `issues.json`

**Status:** Accepted (2026-07-02, revised 2026-10-21)

The filename keeps its original slug, although refactoring has left the loop (§7). Five sibling documents
link to it by name, and renaming it would change no behaviour.

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

### 2. Two fresh phases per slice, state on disk

A loop iteration is **one fresh session**, so RED and GREEN cannot both live in one iteration without
sharing context — the exact cheat [ADR-0012](0012-fresh-context-red-green-separation.md) forbids.
Therefore each slice is advanced by **two separate fresh iterations**:

```
RED      (fresh) ← slice INTENT (acceptance_criteria)          → write failing test → prove RED → commit
GREEN    (fresh) ← slice INTENT + committed test (NOT red's session) → min impl → assert GREEN → commit
```

The baton between phases is **artefacts on disk, never session memory**: the committed failing test is
what GREEN must satisfy. A `<artifacts_dir>/<slug>/build-state.json` file records each slice's phase
(`pending → red-done → green-done`), so any fresh iteration can compute the next `(slice, phase)` by
reading `issues.json` + `build-state.json`. The loop signals `<promise>COMPLETE</promise>` when every
slice is `green-done`.

Refactoring is not a phase. §7 records where it went.

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
  `.archon/unic-dlc.config.yaml`, and emits structured JSON carrying, among other fields, `sdlc_needs` and `install_report`. The node's
  own `output_format` is the exact list; this ADR names only the fields its decision turns on. The per-node command scalars this ADR first described became the one `sdlc_needs`
  object ([ADR-0037](0037-config-declares-sdlc-needs.md)), and `bootstrap` also runs the declared
  install once for the whole run.
- **`slopcheck`** is a self-contained `script:` node (`runtime: bun`) that inlines the new-package
  registry gate and imports nothing.

This convention is binding for the remaining Archon boxes, and for the commands too. **Nothing this
plugin ships imports a plugin module or reads `$CLAUDE_PLUGIN_ROOT`.** The same two facts hold for a
command: `$CLAUDE_PLUGIN_ROOT` is not set inside the Bash tool either, and an installed plugin ships no
`node_modules`, so `import 'yaml'` cannot resolve outside this monorepo, where `"yaml": "catalog:"` is a
workspace protocol. Measured on 0.22.0 in a Consumer that installed the plugin through the marketplace,
all seven commands loaded and none ran past Step 1 while they still imported `lib/`. So an Archon
`script:` node inlines its logic, a command reads config, the tracker contract and its Methods with its
own tools, in prose. #381 deleted the plugin's `lib/` and `test/`.

One command keeps a bounded need for the plugin's own directory. `/setup`'s install step copies the Method
Bundle and the Box YAMLs out of it, so it locates that directory and confirms the path with the operator
rather than reading a variable. #383 settles how `/setup` learns its own location.

### 6. Gate honoring; reject returns to verification, not a full rebuild

The `build-pr-gate` is an `approval:` node with `interactive: true` at the workflow level
([ADR-0011](0011-archon-schema-target.md)). It honours `gates.build` from config: it runs `when` the
gate is `hitl` and is skipped when `afk` (the PR is still opened by the preceding `open-pr` node). On
**reject**, `approval.on_reject.prompt` re-runs verification-and-fix from the reviewer's feedback and
re-pauses at the same gate (`max_attempts: 3`) — it does **not** restart the whole build.

### 7. Refactor leaves the loop; the `tdd` and `implement` Methods replace the hand-rolled prose

_Amended 2026-08-04 (#281), tranche 3 of the Matt v1.1.0 migration. Applies
[ADR-0030](0030-harness-hosts-methods.md)'s structural bar to this Box: a Box survives only for what no
Method can supply._

**Refactor is no longer a phase.** The `tdd` Method states it outright — "refactoring is not part of the
loop. It belongs to the review stage (see the `code-review` skill)". The loop therefore runs
`pending → red-done → green-done`, `<promise>COMPLETE</promise>` fires when every slice is `green-done`,
and there is no `refactor(<SLUG>): tidy …` commit. Refactoring did not disappear: it reappears in
`/pr-review`, whose single `review` node carries `code-review`'s twelve-item Fowler smell baseline
([ADR-0026](0026-pr-review-generic-archon-harvest.md) §8). Ground this Box used to maintain by hand is
now ground upstream maintains.

**The loop reads its procedure, it does not restate it.** The `run-build` node reads
`.archon/methods/tdd/SKILL.md` (plus `tests.md` and `mocking.md`) and `.archon/methods/implement/SKILL.md`
in full, by literal repo-relative path. What stays written in the node is Harness-only and no Method
supplies it: the exit-code proof of §3, the per-phase commit convention, `build-state.json`, and the
serial dependency order.

**Reading a Method inside an Archon node is bundle-tier only — a real asymmetry with the command Boxes.**
`resolveMethod` lives in plugin `lib/`, which a node cannot import (§5). A node therefore reads
`.archon/methods/<name>/SKILL.md` directly, so the config and `.local` override tiers
([ADR-0031](0031-methods-bundled-three-tier-resolution.md)) **do not apply inside an Archon Box**, and
there is no resolved-tier log line either. A missing Method file is fatal for the node; the fix is
`/unic-archon-dlc:setup`, which installs the tree. `test/archon-box-methods.test.mjs` holds all four
Archon workflows to the manifest and forbids a `resolveMethod(` call, mirroring what
`test/command-methods.test.mjs` does for the four command Boxes under the opposite convention.

**`implement`'s closing review step runs as a local pre-check that posts nothing.** `implement` ends with
"once done, use /code-review to review the work". A new `implement-review-precheck` node
(`depends_on: [run-build]`, upstream of `verification`) runs `code-review` once over the whole build and
folds its `## Standards` / `## Spec` output into `report.md`'s "Decisions Made". It runs **no** tracker or
PR mutation: `/pr-review` keeps sole review-posting authority, so a build cannot double-comment the PR it
just opened. Read-only tracker queries, for the spec source, are the only tracker traffic allowed.

**Three Method questions are answered by injection, never by a new gate.** Each Method was written for a
live session and stops to ask something no one is present to answer. An `approval:` node would be the
wrong instrument, and not merely redundant: every gate in this Plugin is written
`when: "$bootstrap.output.gate == 'hitl'"`, so a gate added for `tdd`'s seam rule would fire only when a
human is already there and be **silently skipped in AFK** — leaving the node to proceed on unconfirmed
seams, the exact outcome the rule exists to prevent. Injection holds in both modes.

| Method asks                                                                                                     | Injected answer                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tdd`: confirm the seams with the user before writing any test                                                  | Already approved twice — at `/specs` Step 5 (the seam-approval halt, recorded in `PRD.md` § Testing Decisions) and again at `/tickets`' Nyquist-map gate, which is why the slice carries a `test_command`. The node is told the seams **are** confirmed and where to read them. |
| `code-review`: the fixed point, "if they didn't specify one, ask for it"                                        | The branch point of the build branch, `git merge-base origin/$BASE_BRANCH HEAD`. Archon's `$BASE_BRANCH` is the only source of a run's base branch ([ADR-0038](0038-base-branch-is-archons-base-branch.md)).                                                                    |
| `code-review`: "if nothing is found, ask the user where the spec is"                                            | `PRD.md` + `issues.json` for the slug, plus the tracker issue per slice.                                                                                                                                                                                                        |
| `code-review`, `implement`, `tdd`: run `/setup-matt-pocock-skills` if `docs/agents/issue-tracker.md` is missing | Never. `.archon/unic-dlc.config.yaml` is this Harness's single source of truth, and that skill writes a competing label file ([ADR-0024](0024-triage-intake-on-ramp.md)).                                                                                                       |

**The asymmetry worth naming: `test_command_planned` slices get an agent-chosen seam.** A slice may carry
`test_command_planned: true` instead of a `test_command` — no runner exists yet, or the test is itself the
deliverable (`commands/tickets.md` Step 5). There is no pre-agreed seam to inject for those, and `tdd`
forbids writing a test at an unconfirmed seam. The node **chooses the seam and records the choice** as a
`seam chosen: <issue-id> — <seam>` line in that slice's `notes` in `build-state.json`, which `report.md`
surfaces. So a slice with a pinned `test_command` inherits a human-approved seam, while a
`test_command_planned` slice gets an agent-chosen one that is **auditable after the fact** by
`/pr-review` and `/improve-architecture`. Halting the slice instead would have shrunk AFK coverage, which
this tranche exists to grow; an unrecorded choice is the defect, not the choice itself.

## Consequences

- The keystone contract B ([ADR-0012](0012-fresh-context-red-green-separation.md)) is **preserved**; only
  its delivery mechanism moved from per-slug codegen to a generic runtime loop with on-disk state.
- `max_iterations` is a static YAML integer, because it cannot be derived from the slice count at author
  time. It is `60`, which covers 30 slices × 2 phases. It was sized for 20 slices × 3 phases while
  refactoring was a phase, and was left at 60 when that phase went, since lowering it would only narrow
  the margin. An over-large `issues.json` needs the ceiling raised. That is a known, logged limit, not
  silent truncation.
- The self-contained-script convention (§5) is the pattern the next Archon boxes follow; it is recorded
  here because `/build` is the first port.
- `docs/workflow/<slug>/` artefact paths become `<artifacts_dir>/<slug>/` ([ADR-0015](0015-workflows-slug-artifact-home.md)).
- The loop's procedure lives upstream, so an upstream `tdd` or `implement` edit changes how this Box
  behaves without a change in this repo. That is the intended trade of
  [ADR-0030](0030-harness-hosts-methods.md). The plugin version is the pin that makes the change
  deliberate rather than continuous ([ADR-0031](0031-methods-bundled-three-tier-resolution.md)).
- Full behavioural validation (gates pause, loop iterates, fresh context isolates) is required beyond
  `archon validate` ([ADR-0011](0011-archon-schema-target.md) §6), since `validate` passes the inert
  forms too.
