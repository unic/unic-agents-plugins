# 0002. Zero runtime dependencies in the hook script

**Status:** Accepted (2025-04)

## Context

The hook script is installed into users' Claude Code environments. Every runtime dependency adds install time, version pinning concerns, and potential breakage. The repo guideline is "zero runtime deps unless truly essential."

## Decision

The hook script uses only Node.js built-in modules (`node:child_process`, `node:fs`, `node:path`, `node:os`). No third-party packages are listed in `dependencies`.

## Consequences

- Install is instant (`npm install` / `pnpm install` fetches no extra packages).
- The hook cannot use convenience libraries (e.g. `glob`, `chalk`); all logic is hand-rolled.
- devDependencies (Biome, TypeScript) are allowed and are not installed in production.
