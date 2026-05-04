# Update `format-hook.mjs` to use `lib/config.mjs`

**Status:** ready-for-agent
**Category:** refactor

## Parent

`docs/issues/auto-format-config/PRD.md`

## What to build

Update `scripts/format-hook.mjs` to import `loadConfig` from `./lib/config.mjs` and remove the
now-moved code:

1. Add `import { loadConfig } from './lib/config.mjs'`
2. Delete the `DEFAULTS` constant (lines 25–57)
3. Delete the `loadProjectConfig` function (lines 65–93)
4. Replace `const CONFIG = loadProjectConfig()` with `const CONFIG = loadConfig(PROJECT_DIR)`

External behaviour is identical. `tests/format-hook.test.mjs` must pass without modification.

## Acceptance criteria

- [ ] `grep -n "const DEFAULTS\|function loadProjectConfig" scripts/format-hook.mjs` → 0 matches
- [ ] `grep -n "loadConfig" scripts/format-hook.mjs` → match on import and call site
- [ ] `pnpm test` passes without any changes to `tests/format-hook.test.mjs`
- [ ] `pnpm typecheck` passes

## Blocked by

01-config-module
