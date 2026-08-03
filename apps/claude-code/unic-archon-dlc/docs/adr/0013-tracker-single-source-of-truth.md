# 0013. Issue tracker is the single source of truth; HANDOFF.md/ROADMAP.md dropped

**Status:** Accepted (2026-06-30)

## Context

The original design carried two repo-level state files:

- **`HANDOFF.md`** — a persistent snapshot of project state, refreshed by every `triage` run.
- **`ROADMAP.md`** — a persistent roadmap under `docs/workflow/`, with human content preserved outside `<!-- unic-archon-dlc:begin/end -->` markers.

A standing doctrine reserved both files to one writer: _"HANDOFF.md and ROADMAP.md are written exclusively by the triage workflow."_ The old `triage` workflow's entire job was producing them.

This duplicates state that the **issue tracker already holds authoritatively**. The redesign ([`docs/redesign/PLAN.md`](../redesign/PLAN.md), decision #6) treats the tracker as the answer to "where are we" — issues carry status, acceptance criteria, and sequencing (`## Blocked by`, see [ADR-0007](0007-blocked-by-canonical-sequencing.md)). A second hand-maintained snapshot can only drift from it, and a fresh-context pipeline ([ADR-0012](0012-fresh-context-red-green-separation.md)) cannot trust a file that may be stale.

## Decision

- **The issue tracker is the single source of truth** for project state and "where are we."
- **`HANDOFF.md` and `ROADMAP.md` are dropped.** No workflow writes either file.
- **The old `triage` workflow is retired.** Its only job was generating those files; that job no longer exists. The `triage` name is **reassigned** to an intake on-ramp (raw bugs/requests → agent-ready issues) — see [ADR-0014](0014-workflow-per-box-decomposition.md).
- **The doctrine "HANDOFF.md/ROADMAP.md written exclusively by triage" is retired.** This ADR supersedes it.

## Consequences

- The `HANDOFF.md` and `ROADMAP.md` vocabulary terms are removed from [`CONTEXT.md`](../../CONTEXT.md); the plugin's `AGENTS.md` doctrine and "Do not add" entries that referenced them are removed/replaced.
- Per-thread continuity that `HANDOFF.md` partly served is now covered by the dedicated `/handoff` workflow (Matt's session-bridge; redesign step 02), which writes a **throwaway** per-thread file, not a durable repo snapshot.
- "Where are we" queries go to the tracker, not a checked-in file — consistent with the fresh-context principle that all state lives external (tracker + disk), never in conversation memory.
