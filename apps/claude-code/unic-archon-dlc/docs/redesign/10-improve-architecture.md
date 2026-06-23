# Step 10 — `/improve-architecture` (off-line, from `cleanup` part A)

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** Off the main line — periodic / on demand, not per-feature.

## Goal
A `unic-dlc-improve-architecture` workflow = Matt's `improve-codebase-architecture`: surface architectural drift + deepening opportunities, and **consolidate ADRs including superseding** older ones.

## Task
- Reuse the existing `cleanup` workflow's `arch-review` + `adr-consolidation` content (drop its `run-triage` call — triage-snapshot is gone).
- **arch-review:** technical drift (shallow modules, tight coupling, leaky abstractions), intent drift (behaviour vs PRD), deepening opportunities. Write `workflows/<slug>/arch-review.md` (or a non-slug location if run repo-wide — decide).
- **ADR consolidation w/ superseding:** when a new decision overwrites an old one, mark the old ADR `Status: Superseded by NNNN` (don't delete); write the new ADR. Per-ADR A/R/E human gate.
- Use `/codebase-design` + `/improve-codebase-architecture` vocabulary (deep modules, seams, deletion test).
- Off-line, on-demand; no end-of-cycle auto-hook (PLAN decision #8).

## Open questions to grill first
- Run scope: per-slug (reads that session's PRD/report) vs repo-wide periodic sweep? Maybe both modes.
- Superseding mechanics — how the ADR index/links are maintained.
- Cadence guidance for consumers ("every few days").

## Done when
`/improve-architecture` produces a drift+deepening report and can supersede ADRs through a per-ADR human gate, off the main line. PR to `develop`.

## Suggested skills
`/archon`, `/improve-codebase-architecture`, `/codebase-design`, `/domain-modeling`.
