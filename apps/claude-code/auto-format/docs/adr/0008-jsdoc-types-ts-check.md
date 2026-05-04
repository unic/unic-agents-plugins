# 0008. JSDoc types and tsc --checkJs for type safety without compilation

**Status:** Accepted (2025-04)

## Context

Consistent with the monorepo-wide decision (repo ADR-0003). Recorded here for plugin-local reference.

## Decision

Hook script files use `// @ts-check` and JSDoc annotations. Type checking runs via `pnpm typecheck` (`tsc --checkJs --noEmit`). No TypeScript compilation occurs.

## Consequences

- Same as repo-level ADR-0003.
- Plugin contributors need to write JSDoc for new function parameters and return types.
