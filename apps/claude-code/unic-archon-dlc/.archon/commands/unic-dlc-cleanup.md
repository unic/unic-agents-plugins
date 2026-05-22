# /unic-dlc-cleanup

Post-merge cleanup for a planning session: architecture review, ADR consolidation, and a
triage pass to refresh project state.

## Usage

```
/unic-dlc-cleanup <slug>
```

Where `<slug>` is the session identifier used throughout the plan → build → qa cycle.

## What this command does

1. **`arch-review` node** — reads `docs/workflow/<slug>/PRD.md` (intent) and
   `docs/workflow/<slug>/report.md` (technical outcome) alongside the changed code.
   Detects three categories of drift:

   - **Technical drift**: too-shallow modules, tight coupling, leaky abstractions.
   - **Intent drift**: delivered behaviour that diverges from the PRD; silently dropped
     acceptance criteria; scope creep added during build.
   - **Deepening opportunities**: modules that could hide more complexity behind their
     current interface.

   Output: `docs/workflow/<slug>/arch-review.md`

2. **`adr-consolidation` interactive node** — presents each proposed ADR individually for
   human approval. Sources:

   - "Decisions Made" section of `report.md`
   - "Accept as ADR" items from `arch-review.md`

   Each ADR is shown with Context, Decision, and Consequences. The user accepts (A),
   rejects (R), or edits (E) each candidate. Only accepted ADRs are written to `docs/adr/`.

3. **`run-triage` node** — invokes the shared triage workflow by name via
   `archon workflow run unic-dlc-triage`. No triage logic is duplicated in the cleanup
   workflow. This produces `HANDOFF.md` and updates `docs/workflow/ROADMAP.md` exactly
   once per cleanup run.

## Prerequisites

- The build and QA cycles for `<slug>` must be complete (build PR merged, QA approved)
- `docs/workflow/<slug>/PRD.md` and `docs/workflow/<slug>/report.md` must exist
- `.archon/unic-dlc.config.json` must be present

## Outputs

| File                                  | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| `docs/workflow/<slug>/arch-review.md` | Architecture review with drift findings         |
| `docs/adr/NNNN-*.md`                  | Accepted ADRs (one file per accepted candidate) |
| `HANDOFF.md`                          | Updated handoff snapshot (from triage)          |
| `docs/workflow/ROADMAP.md`            | Updated project phase (from triage)             |

## Runs

```
archon workflow run unic-dlc-cleanup --input slug=<slug>
```
