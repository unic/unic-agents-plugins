# Build workflow — verification, goals-check, report, and PR gate

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

Quality and consolidation phase of `build`: a verification node that catches low-quality implementations, a goals-check coverage matrix that ties code back to the PRD, a consolidated report, and the human PR gate that follows.

In scope:

- **`verification` node:**
  - Runs the full test suite for the slug's touched packages.
  - Checks coverage thresholds (from `.archon/unic-dlc.config.json`).
  - Detects stub patterns: `TODO` / `FIXME` / empty function bodies that only `return` or `pass` / hardcoded sentinel values returned where logic was expected.
  - Audits wiring across layers: component → API → DB; form → handler. Mismatches are reported with file:line references so the report is actionable.
- **`goals-check` node:** reads `docs/workflow/<slug>/PRD.md` and produces a **coverage matrix** mapping each acceptance criterion (from every user story / issue) to implementation evidence (file paths, test names, or "MISSING"). The matrix is the artifact reviewers look at before merging.
- **`report` node:** writes `docs/workflow/<slug>/report.md` consolidating:
  - What was built (high-level summary of merged issues)
  - Goals-check matrix (verbatim from the previous node)
  - Test outcomes (pass/fail counts, coverage numbers)
  - Decisions made during implementation (links to any new ADRs)
  - Tech debt flagged for cleanup (consumed by slice 13)
- **Human PR gate (`interactive: true`)** after `report`: opens a PR with the implementation plus `report.md`. Workflow pauses until approved. Rejected approvals return control to `verification` for another pass.

Out of scope: the `/unic-dlc-review` command itself (slice 11) — this slice's PR gate is the human review; slice 11 adds the automated AFK review.

## Acceptance criteria

- [ ] `verification` fails when coverage is below threshold, when stub patterns are present, or when a wiring mismatch is detected.
- [ ] `goals-check` produces a coverage matrix where each row maps an acceptance criterion to evidence or "MISSING"; matrices with any "MISSING" rows fail the node.
- [ ] `report.md` contains all five sections and is committed to `docs/workflow/<slug>/`.
- [ ] Human PR gate blocks until approved; rejection returns control to `verification`.
- [ ] Tests cover the stub-pattern detector with at least three positive and three negative cases.

## Blocked by

- `docs/issues/unic-archon-dlc/09-build-tdd-core-and-slopcheck.md`
