# Architectural Decision Records

Back-filled from existing specs and tooling in 2026-05. Format: MADR-lite.

## Format

```markdown
# NNNN. Title

**Status:** Accepted (YYYY-MM)

## Context

Why this decision had to be made.

## Decision

What was decided.

## Consequences

- Bullet list of implications for future contributors.
```

## Numbering

Files are named `NNNN-slug.md`, zero-padded to 4 digits, per directory.
Numbers are assigned in the order decisions were recorded, not by importance.

## Amending records

- Never delete an ADR.
- If a decision is superseded, update the original status to `Superseded by ADR-NNNN` and create a new ADR.
- If the decision still stands but a detail of it changes — ownership, scope, a named tool — **amend in place** instead. Append a dated `## Amendment (YYYY-MM)` section, leave Context and Decision untouched so the original record survives, and extend the status line: `**Status:** Accepted (YYYY-MM); <what> amended YYYY-MM, see [Amendment](#amendment-yyyy-mm)`. [ADR-0032](0032-label-taxonomy.md) is the worked example.
- Pick by subject, not by size: a change to the same subject amends, a change of subject gets its own ADR. [ADR-0033](0033-de-dogfood-unic-archon-dlc.md) is a new record precisely because de-dogfooding is not a label-taxonomy decision, even though it reversed one clause of ADR-0032.
