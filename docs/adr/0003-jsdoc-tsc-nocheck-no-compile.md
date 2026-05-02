# 0003. JSDoc + tsc --checkJs --noEmit — no TypeScript compilation

**Status:** Accepted (2025-04)

## Context

Plugin scripts must be runnable by Node directly (no build step). TypeScript provides type safety but the compilation output would be redundant for `.mjs` source.

## Decision

Use `// @ts-check` + JSDoc annotations in `.mjs` files. Run `tsc --checkJs --noEmit` for type-checking. No `tsc` compilation to JS; source files are the runtime artefacts.

## Consequences

- Zero-build deployments: Claude Code installs and runs source directly.
- Type errors surface at dev time via `pnpm typecheck`, not at deploy time.
- Some TypeScript features (decorators, enums, `as` casts in body) are unavailable.
- Contributors unfamiliar with JSDoc types need a brief onboarding.
