# 0005. Indentation policy: tabs for code, 2-space for data files

**Status:** Accepted (2025-04)

## Context

Mixed indentation across contributors and editors causes noisy diffs. A single explicit policy prevents this.

## Decision

- `.mjs`, `.js`, `.ts`: **tabs**
- `.json`, `.jsonc`, `.yml`, `.yaml`: **2 spaces**
- `.md`: Prettier default (2 spaces in lists, no tab indent)

Enforced by `@unic/biome-config` and Prettier config at the repo root.

## Consequences

- `editorconfig` at the root mirrors these rules for editor support.
- Biome and Prettier enforce them in CI; non-conforming files fail `pnpm check`.
