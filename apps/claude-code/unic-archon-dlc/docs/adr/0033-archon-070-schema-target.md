# 0033. Archon 0.7.0 schema target — floor bump, `always_run`, sub-runs deferred

**Status:** Accepted (2026-08-10); amended 2026-08-18 — see the note below. Amends [ADR-0011](0011-archon-schema-target.md) on the version floor only — its key-discriminated schema conventions stand unchanged.

> **Amended (2026-08-18):** § "Repository derivation: settled by #289, not reopened here" describes a
> mechanism that no longer exists. This Harness derives no repository from a remote: each Box reads the
> one `docs/agents/issue-tracker.md` § Addressing names, so there is nothing left to diverge from
> Archon's own `worktree.remote` resolution. `/archon-upgrade` still classifies that algorithm
> VERIFY-ONLY, on the new reason. See [ADR-0024](0024-triage-intake-on-ramp.md)'s 2026-08-18
> amendment (#389).

> **Amended (2026-08-24):** § "Where Archon's own remote resolution differs from this Harness's
> derivation" described `worktree.remote` as present in 0.7.0 without anyone having measured it. It is
> measured now, by the behavioural probe `/archon-upgrade` Step 6 carries
> ([#396](https://github.com/unic/unic-agents-plugins/issues/396)): on Archon 0.7.0 the key is **read**
> — set to a second remote's name, the binary's own startup error names that remote as the one it
> resolved the base branch against, where the control run naming no key says `origin`. Two limits on
> that result. It belongs to 0.7.0 and to no other release, which is why the key is a claim Step 6
> re-probes rather than a fact this ADR asserts. And it governs base-branch resolution only: in the
> same run the workspace path still came out of `origin`, so `worktree.remote` does not steer the
> `owner/repo` derivation — the shared `~/.archon/workspaces/_git/` directory every `dxp` repository
> lands in is Archon reading the second-to-last URL segment as the organisation, an Archon defect
> recorded on [#373](https://github.com/unic/unic-agents-plugins/issues/373), and this key is not its
> fix.

## Context

[ADR-0011](0011-archon-schema-target.md) pinned the floor at Archon ≥ 0.5.0 and named the key-discriminated node schema, not the release number, as the stable contract — instructing authors to "re-validate behaviourally on each bump" but shipping no mechanism to do it with. Archon 0.7.0 closes two structural holes this plugin's own thesis argues for and could not previously express.

**The verification hole.** `unic-dlc-build.yaml` ran `verification` and `goals-check` as prose-only reporters — nothing structurally prevented a run reaching terminal `completed` with a red suite or uncovered acceptance criteria; the human caught it at `build-pr-gate`. 0.7.0 adds `evidence_policy: { required: true }` at workflow level: once every node has succeeded, the engine refuses terminal `completed` unless `evidence.json` exists in the run's `$ARTIFACTS_DIR`, gating on file **presence** only — what counts as valid evidence is for the workflow's own bash/script nodes to produce.

**The stale-resume hole.** Archon's resume skips any node that completed successfully in the prior attempt and feeds downstream consumers its cached output. `unic-dlc-qa.yaml`'s `verify-pr-base` emits `base_ok`, and `merge` depends on it — but `base_ok` is a fact about the remote PR, not about the node's own exit code. A cached `base_ok: true` would let `merge` fire against a base retargeted after the first attempt: the exact failure this Harness has already hit by hand, now with a documented mechanism (`always_run: true`, a per-node boolean opting a node out of resume caching, valid on every node type).

Both fields were verified behaviourally against the installed `archon` CLI v0.7.0 (build `cb417a2a`) rather than taken from a release note — `evidence_policy.required` resolves to a presence check on `<artifacts_dir>/evidence.json` with an actionable failure message, and `always_run` appears in the shipped node schema and the bundled `parameter-matrix.md` and `workflow-dag.md` references. This is the behavioural re-validation ADR-0011 asks for and did not previously supply.

## Decision

### Version floor

Raise the floor to Archon ≥ 0.7.0 (`MIN_ARCHON_VERSION` in `lib/archon-check.mjs`), stated identically in `commands/setup.md` Step 1, `AGENTS.md`, `README.md`, `CONTEXT.md`, and the four Box command docs under `.archon/commands/` (`unic-dlc-build.md`, `unic-dlc-qa.md`, `unic-dlc-pr-review.md`, `unic-dlc-explore.md`). Those four ship into a Consumer project as the operator-facing description of each Box, so a floor they contradict is refused at `/setup` with no warning from the doc the operator checked — the first draft of this ADR omitted them and all four kept `≥ 0.5.0`. As with the 0.5.0 pin, this is not a hard version pin — the durable contract is still the key-discriminated schema plus the two fields below; re-validate behaviourally on the next bump rather than trusting a number.

### `always_run` closes the stale-resume hole

`always_run: true` is set on every node in `/build` and `/qa` whose exit code reports a verdict about EXTERNAL or MUTABLE state rather than about itself: `slopcheck`, `verification`, `goals-check`, `evidence` (build); `verify-pr-base`, `e2e`, `coverage-gate` (qa). Each carries an inline one-line comment naming the specific fact its exit code fails to validate — the same discipline [ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5 already applies to provider knowledge: a Box node is self-contained, so a rule that lives only in this ADR is invisible at run time.

Not every node gets it. `bootstrap`, `open-pr`, `report`, the `run-build` loop, and the various `guard-*`/`approval:` nodes are excluded: their exit code either IS the fact being asserted (a guard's `cancel`), or their output is durable committed state that a resume should not redundantly regenerate (`report.md`, the PR itself).

### Evidence gate: a script writes it, a prompt never does

[ADR-0034](0034-evidence-gate-deterministic-writer.md) (companion, authored alongside this one) records the evidence gate's own shape: `unic-dlc-build.yaml` declares `evidence_policy: { required: true }`; `verification` and `goals-check` gain a boolean `output_format`; a new `evidence` script node deletes any stale `evidence.json` from a prior resumed attempt, writes `$ARTIFACTS_DIR/evidence.json` only when both verdicts are green, and mirrors it to `<artifacts_dir>/<slug>/evidence.json` (the Session-artifact home, [ADR-0015](0015-workflows-slug-artifact-home.md)) so it survives the worktree `/cleanup` prunes.

### Repository derivation: settled by #289, not reopened here

This bump does not touch repository derivation. Each Box derives its target repository from the worktree's `origin` remote in its `bootstrap` node ([ADR-0011](0011-archon-schema-target.md)'s cancel-vs-fail distinction governs the ambiguity guard); `project.repo_ref` is an optional override, absent from `MANDATORY_PATHS` and from `defaultConfig()`, and `/setup` does not ask for it or write it. A regression test asserts that absence so a later bump cannot quietly promote it. This ADR also does not change [ADR-0016](0016-dlc-thin-process-layer.md)'s explicit-staging rule.

**Where Archon's own remote resolution differs from this Harness's derivation** (recorded deliberately, NOT re-aligned): Archon 0.7.0 carries a `worktree.remote` key in **its own** `.archon/config.yaml` — a different file from this plugin's `.archon/unic-dlc.config.yaml`, the exact naming trap [ADR-0015](0015-workflows-slug-artifact-home.md) already documents for `workflows/<slug>/` vs `.archon/workflows/` — plus auto-detection: `origin` if present → **the sole remote if only one is configured** → an actionable error only when neither resolves. This Harness's own `bootstrap` derivation has no "sole remote" fallback tier: it reads `origin` only, and treats a checkout with **no `origin` at all** as `ambiguous-repo` — cancelling — even when exactly one other remote exists and would have resolved unambiguously under Archon's own algorithm. This is deliberate, not a bug to fix here: widening the derivation to match Archon's fallback is a separate decision with its own blast radius, not a byproduct of the floor bump. `/setup` reports what Archon's config resolves and **never writes that file**.

### Sub-runs (`workflow:` nodes): deferred, with the trigger to revisit

0.7.0 adds a `workflow:` runtime sub-run node — a child workflow run with its own run row, artifacts, approval gates, cost line, and audit trail; the child's terminal output threads back as `$<nodeId>.output`. The wanted use in this Harness is one child run per slice inside `/build` — its own run row, cost line, artifacts, and gate per slice, in place of today's single `run-build` loop iterating every slice in one session.

**Blocked, not adopted, in this bump.** Slice count is runtime data read from `issues.json`, and 0.7.0's sub-run support is sequential composition in a shared checkout — dynamic fan-out, per-child worktrees, `first_success` racing, and `with:` parameter mapping are reserved in the schema and rejected fail-fast. Revisit when upstream ships fan-out and `with:` parameter mapping over a dynamic list.

**The `include:` vs `workflow:` rule**, recorded here so it is not re-derived by a later author: use `include:` for textual reuse of a node fragment inside the SAME governance object (no separate run, artifacts, or gate); use `workflow:` only when the block must be a genuinely separate governed object (its own run row, its own approval gate, its own audit trail). This keeps [ADR-0014](0014-workflow-per-box-decomposition.md)'s box set and [ADR-0017](0017-container-follows-structural-need.md)'s container-follows-structural-need test intact — a sub-run is a new CONTAINER decision, not a convenience for splitting a long prompt.

## Consequences

- `lib/archon-check.mjs`'s `MIN_ARCHON_VERSION` moves to `0.7.0`; a Consumer on Archon 0.5.x/0.6.x is refused at the next `/setup` preflight (Step 1) with an upgrade message. Already-configured Consumers who do not re-run `/setup` are unaffected until they do — the check runs only there, never inside a workflow run itself.
- `unic-dlc-build.yaml` and `unic-dlc-qa.yaml` gain `always_run: true` on the nodes named above; no other Archon workflow (`unic-dlc-explore.yaml`, `unic-dlc-pr-review.yaml`) is touched by this ADR.
- `/setup` gains a plain refusal for a project with no git remote at all, and a verify-only report of what Archon's own config resolves. It writes neither.
- The repository-derivation divergence recorded above is documentation only — no code change follows from it in this ADR.
- `workflow:` sub-runs remain unadopted; the next redesign step that wants to revisit `/build`'s per-slice isolation should start from the trigger recorded above, not re-derive it.
- [ADR-0011](0011-archon-schema-target.md)'s status line gains a pointer to this ADR for the floor; its schema-convention decision is otherwise untouched.
