# Architectural Decision Records

Back-filled from existing specs and tooling in 2025-05. Format: MADR-lite.

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
