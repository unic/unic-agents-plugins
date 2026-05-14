# Cleanup workflow — arch-review, ADR consolidation, triage

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

Post-merge cleanup that catches drift, locks in architectural decisions, and refreshes project state. Ends by reusing the triage workflow from slice 03.

In scope:

- `/unic-dlc-cleanup <slug>` command and `.archon/workflows/cleanup.yaml`.
- **`arch-review` node:**
  - Reads both `docs/workflow/<slug>/PRD.md` (intent) and `docs/workflow/<slug>/report.md` (technical outcome) alongside the changed code.
  - Catches **technical drift** (modules that became too shallow, tight coupling, leaky abstractions) and **intent drift** (delivered behaviour diverges from the PRD).
  - Proposes **deepening opportunities** for modules that grew thin during implementation.
  - Writes `docs/workflow/<slug>/arch-review.md`.
- **`adr-consolidation` interactive node:**
  - Reviews decisions logged during `build` (the "Decisions made during implementation" section of `report.md`) plus any ADR drafts proposed during `arch-review`.
  - **Per-ADR approval gate**: each proposed ADR is presented individually for accept / reject / edit. Only accepted ADRs are written to `docs/adr/`.
- **Final node reuses slice 03's `triage` workflow** — the same `.archon/workflows/triage.yaml` is referenced via Archon's workflow-include mechanism. Both invocations (standalone vs as cleanup's final node) produce the same `HANDOFF.md` and the same `ROADMAP.md` update.

Out of scope: changes to `triage` itself (any new behaviour belongs in slice 03's file).

## Acceptance criteria

- [ ] `/unic-dlc-cleanup <slug>` writes `docs/workflow/<slug>/arch-review.md` covering technical drift, intent drift, and at least one deepening opportunity (or "none identified").
- [ ] `adr-consolidation` presents each proposed ADR individually; reject/accept choices are recorded; only accepted ADRs land in `docs/adr/`.
- [ ] Cleanup's final node reuses `.archon/workflows/triage.yaml` (no duplicate triage logic); `HANDOFF.md` is produced exactly once per cleanup run.
- [ ] The reused triage node updates `docs/workflow/ROADMAP.md` when invoked as cleanup's final node (no duplicate ROADMAP logic in cleanup itself).
- [ ] Command file uses the `unic-dlc-` prefix.

## Blocked by

- `docs/issues/unic-archon-dlc/12-qa-workflow.md`
- `docs/issues/unic-archon-dlc/03-triage-workflow-and-tracker-adapter.md`
