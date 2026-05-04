# Replace runner functions with descriptors in `format-hook.mjs`

**Status:** ready-for-agent
**Category:** refactor

## Parent

`docs/issues/auto-format-runners/PRD.md`

## What to build

Replace the three inline runner functions (`runPrettier`, `runEslint`, `runBiome`) in
`scripts/format-hook.mjs` with three `FormatterDescriptor` constants and a dispatch through
`runFormatter` from `lib/runners.mjs`.

Changes:

1. Add `import { runFormatter } from './lib/runners.mjs'`
2. Add `/** @import { FormatterDescriptor } from './lib/types.mjs' */` type-import tag
3. Define `PRETTIER_DESCRIPTOR`, `ESLINT_DESCRIPTOR`, `BIOME_DESCRIPTOR` constants
4. Update `main()` dispatch to bind `cwd` and `timeoutMs` once and call `runFormatter`
5. Delete `runPrettier`, `runEslint`, `runBiome` functions

External behaviour is identical. `tests/format-hook.test.mjs` must pass without modification.

Full implementation details in
`apps/claude-code/auto-format/docs/plans/27-replace-runner-functions.md`.

## Acceptance criteria

- [ ] `grep -n "function runPrettier\|function runEslint\|function runBiome" scripts/format-hook.mjs` → 0 matches
- [ ] `grep -n "PRETTIER_DESCRIPTOR\|ESLINT_DESCRIPTOR\|BIOME_DESCRIPTOR" scripts/format-hook.mjs` → 3 matches
- [ ] `pnpm test` passes without any changes to `tests/format-hook.test.mjs`
- [ ] `pnpm typecheck` passes

## Blocked by

02-runner-module
