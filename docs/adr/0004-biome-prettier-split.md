# 0004. Biome 2 for code/JSON; Prettier reserved for Markdown

**Status:** Accepted (2025-04)

## Context

Biome 2 is fast and unifies linting + formatting for JS/TS/JSON. However, Biome does not format Markdown well. Prettier handles Markdown natively.

## Decision

- Biome 2: lint and format `.mjs`, `.js`, `.ts`, `.json`, `.jsonc`
- Prettier: format `.md` only

Both tools run in `pnpm check` / `pnpm format` at the workspace root.

## Consequences

- Contributors need both `biome` and `prettier` dev dependencies.
- Markdown formatting is Prettier-governed (2-space indent, 80-col prose wrap by default).
- Any new file type must be explicitly assigned to one tool to avoid gaps.
