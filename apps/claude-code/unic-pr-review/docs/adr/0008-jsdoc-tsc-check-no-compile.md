# 0008. JSDoc + `tsc --checkJs`, no compilation step

**Status:** Accepted (2026-05)

## Context

This is consistent with the monorepo-wide convention and the pattern established by `auto-format` and `unic-confluence`. Compilation adds CI complexity without benefit for scripts that run directly via Node.

## Decision

All `.mjs` files use `// @ts-check` at the top and JSDoc annotations for types. `tsconfig.json` inherits `checkJs: true` from `@unic/tsconfig` and sets `noEmit: true`. There is no build step.

## Consequences

- Type errors are caught by `pnpm typecheck` (`tsc --noEmit`) before commit.
- No `dist/` directory is produced or committed.
- The `include` glob in `tsconfig.json` covers `scripts/**/*.mjs` and `tests/**/*.mjs`.
