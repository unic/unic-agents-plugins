# 0020. Each plugin has its own Ralph loop with its own ralph.yml and PROMPT.md

**Status:** Accepted (2025-04)

## Context

Ralph Orchestrator implements specs one at a time in a loop. A single monorepo-wide loop would mix plugin-specific specs with workspace specs, making iteration focus unclear.

## Decision

Two levels of Ralph loops exist:

1. **Monorepo root loop** (`pnpm ralph` at repo root): implements `docs/plans/` specs (workspace structure, shared packages, CI).
2. **Per-plugin loop** (`pnpm --filter <name> ralph`): implements `apps/claude-code/<plugin>/docs/plans/` specs.

Each level has its own `ralph.yml` and `PROMPT.md`.

## Consequences

- Adding a new plugin requires creating its own `ralph.yml` and `PROMPT.md`.
- Running the root loop does not touch plugin-specific specs and vice versa.
- Status markers (`**Status: done**`) are scoped per loop level.
