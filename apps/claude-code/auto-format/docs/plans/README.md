# Plugin Roadmap

This directory contains one Ralph-ready implementation spec per feature. Each file is a self-contained brief: context, affected files, step-by-step implementation, test cases, and acceptance criteria.

## How to use (for Ralph)

1. Pick the next unstarted spec in numerical order.
2. Read the spec top to bottom **before** touching any code.
3. If the "Current behaviour" section doesn't match what you find in the file, STOP and add a `## Deviations` section to the spec file documenting the discrepancy. Do NOT silently adapt.
4. After landing the change, add `**Status: done — <YYYY-MM-DD>**` at the top of the spec.
5. Read the spec's `**Version impact:** patch|minor|major` line and execute `PROMPT.md` Step 4.5 before committing.

## Ground rules

- **Package manager**: `pnpm` (workspace mode, after spec `00` lands). Before `00`: use `npm` only if unavoidable.
- **pnpm version pinning**: `package.json#packageManager` (e.g. `pnpm@10.33.0`) is the single source of truth.
- **Indentation**: tabs. Line endings: LF.
- **Commits**: conventional commits — `feat(scope): description`, `fix(scope): description`, `chore(scope): description`.
- **Dep versioning**: `devDependencies` go through the `catalog:` section in `pnpm-workspace.yaml`, pinned exactly. No `^` or `~` ranges.
- **No runtime deps**: the hook script uses only Node built-ins (`node:child_process`, `node:fs`, `node:path`). Keep it that way — no external npm deps in `dependencies`.
- **Node version**: Node ≥24.15.0 (Active LTS). `useNodeVersion` in `pnpm-workspace.yaml` pins the patch.
- **Plugin versioning**: `.claude-plugin/plugin.json` is the single source of truth for the version number. **Never hand-edit** `.claude-plugin/marketplace.json` — use `pnpm bump` (spec `07`).
- **Scope guard**: this plugin formats and lints. Do NOT add MCP servers, skills, agents, or any other Claude Code plugin features unless a spec explicitly calls for it.

## Versioning policy

**SemVer, strictly.**

| Change type | Bump |
|---|---|
| Breaking change to hook contract, plugin manifest, or on-disk config schema | MAJOR |
| New feature: new config option, new extension support, new hook matcher | MINOR |
| Bug fix, refactor, docs, internal tooling | PATCH |

## Execution order

| # | Spec | Priority | Effort | Status |
|---|---|---|---|---|
| 00 | [Bootstrap plugin tooling](./00-bootstrap-plugin-tooling.md) | P0 | S | — |
| 01 | [Plugin manifest](./01-plugin-manifest.md) | P0 | S | — |
| 02 | [Hook registration](./02-hook-registration.md) | P0 | S | — |
| 03 | [Format hook script](./03-format-hook-script.md) | P0 | M | — |
| 04 | [Per-project config support](./04-per-project-config.md) | P1 | S | — |
| 05 | [Plugin README](./05-readme.md) | P1 | S | — |
| 06 | [CHANGELOG and versioning docs](./06-changelog-and-versioning.md) | P1 | S | — |
| 07 | [pnpm bump tooling](./07-pnpm-bump-tooling.md) | P1 | M | — |
| 08 | [pnpm verify:changelog](./08-pnpm-verify-changelog.md) | P1 | S | — |
| 09 | [Smoke tests](./09-smoke-tests.md) | P1 | M | — |
| 10 | [CI workflow](./10-ci-workflow.md) | P1 | S | — |
| 11 | [CLAUDE.md](./11-claude-md.md) | P2 | S | — |

## Cross-cutting dependencies

- **`01` → `00`**: Manifest needs `package.json` with `name` and `version` already set.
- **`02` → `01`**: Hook registration references the plugin manifest structure.
- **`03` → `02`**: The hook script is the implementation of what `02` registers.
- **`04` → `03`**: Per-project config is a feature of the hook script; must be layered on top of spec `03`.
- **`05` → `03` + `04`**: README documents the hook behaviour and config format — land those first.
- **`06` → `01`**: CHANGELOG documents plugin version history; needs the versioning source of truth from `01`.
- **`07` → `06`**: `pnpm bump` automates what spec `06` sets up manually.
- **`08` → `07`**: `pnpm verify:changelog` references `pnpm bump` in its error messages.
- **`09` → `03` + `04`**: Smoke tests cover core hook logic from specs `03` and `04`.
- **`10` → `09`**: CI runs tests; land tests first.
- **`11`**: Can land at any time; no code dependencies.
