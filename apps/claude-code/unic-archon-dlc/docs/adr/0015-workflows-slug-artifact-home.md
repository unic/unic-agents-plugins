# 0015. `workflows/<slug>/` is the artifact home

**Status:** Accepted (2026-06-30)

> **Amended (2026-07-02):** the artifact base dir is **config-driven** (`artifacts_dir`, default `workflows`), so a team can relocate `<base>/<slug>/` (e.g. `docs/specs/`) — #257-aligned. Slug-scoping and the `docs/`-separation rule are unchanged.

## Context

Session artefacts (the PRD, issues JSON, findings, plan-checker report, run report) were written under **`docs/workflow/<slug>/`**. That places generated, machine-owned, per-Session output inside `docs/` — the tree humans browse for hand-written documentation. The two concerns are different: `docs/` is curated and durable; Session artefacts are slug-scoped, regenerated on re-run, and pruned when the Session is done.

The redesign ([`docs/redesign/PLAN.md`](../redesign/PLAN.md), integration contract C) separates them, and [ADR-0011](0011-archon-schema-target.md) already forecast this move (its Consequences flagged the `docs/workflow/<slug>/` → `workflows/<slug>/` migration as redesign pre-work #3, to be sequenced with the `$ARGUMENTS`-based slug change).

## Decision

- **Session artefacts move to slug-scoped `workflows/<slug>/`** (top-level, not under `docs/`): `PRD.md`, `issues.json`, `findings.md`, `plan-checker-report.md`, `report.md`, and any other per-Session output.
- **`docs/` stays human-facing only** — hand-written documentation and ADRs, never generated Session output.
- The **Slug** keys the worktree/branch **and** the `workflows/<slug>/` directory; `/cleanup` prunes stale `workflows/<slug>/` dirs alongside worktrees/branches/PRs.

### Caveat (must be documented to avoid confusion)

`workflows/<slug>/` (Session **artefacts**, the subject of this ADR) is **not** the same as `.archon/workflows/` (the generated Archon **DAG YAMLs**, e.g. `build-<slug>.yaml`). Two different directories with similar names and entirely different contents.

## Consequences

- This realizes the migration [ADR-0011](0011-archon-schema-target.md) forecast; it is **not** a supersession of ADR-0011 — the schema conventions there are unchanged. The two should be sequenced together, since both touch the `lib/` path constants and every workflow's artifact-path references.
- [`CONTEXT.md`](../../CONTEXT.md) artifact paths (`Slug`, `Session`, `PRD`, `Findings`, `Issues JSON`, `arch-review`) are updated from `docs/workflow/<slug>/` to `workflows/<slug>/`.
- The actual path change in workflow prompts and `lib/` constants is owned by the per-box redesign steps (02 onward), not this foundations step — this ADR records the target home; the steps move the code.
- Consistent with [ADR-0012](0012-fresh-context-red-green-separation.md) and [ADR-0013](0013-tracker-single-source-of-truth.md): intent lives in the tracker, artefacts in `workflows/<slug>/`, code in the worktree — nothing relies on conversation memory.
