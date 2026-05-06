# Extract `lib/config.mjs` with `DEFAULTS`, `loadConfig`, and tests

**Status:** resolved
**Category:** refactor

## Parent

`docs/issues/auto-format-config/PRD.md`

## What to build

Create `scripts/lib/config.mjs` and `scripts/lib/config.test.mjs`.

`config.mjs` exports:

- `DEFAULTS` — the `ProjectConfig` constant currently at lines 25–57 of `format-hook.mjs`
- `loadConfig(projectDir: string) → ProjectConfig` — the merge logic currently in
  `loadProjectConfig()`, with `PROJECT_DIR` replaced by the `projectDir` parameter

`config.test.mjs` covers ten scenarios via real temp directories (see PRD for the full list).

`package.json#scripts.test` is updated to include `scripts/lib/config.test.mjs`.

`format-hook.mjs` is not modified in this issue.

Full implementation details in `apps/claude-code/auto-format/docs/plans/29-config-module.md`.

## Acceptance criteria

- [ ] `scripts/lib/config.mjs` exports `DEFAULTS` and `loadConfig`
- [ ] `loadConfig` takes `projectDir: string`, does not close over any module-level constant
- [ ] All 10 tests in `scripts/lib/config.test.mjs` pass
- [ ] `pnpm test` passes (existing tests unaffected)
- [ ] `pnpm typecheck` passes
- [ ] `format-hook.mjs` is not modified

## Blocked by

None — can start immediately.
