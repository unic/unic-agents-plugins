# Extract `lib/runners.mjs` with `runFormatter` and tests

**Status:** closed
**Category:** refactor

## Parent

`docs/issues/auto-format-runners/PRD.md`

## What to build

Create two new files: `scripts/lib/runners.mjs` and `scripts/lib/runners.test.mjs`.

`runners.mjs` exports a single `runFormatter(descriptor, filePath, cwd, timeoutMs)` function that
owns the subprocess contract — binary existence check, `spawnSync` invocation, SIGTERM/null
detection, tolerated-exit-code filtering, stderr reporting. It imports `FormatterDescriptor` from
`./types.mjs` via JSDoc `@import`. It has no knowledge of Prettier, ESLint, or Biome.

`runners.test.mjs` tests the contract with real child processes (stub Node.js scripts in temp
directories). Six tests covering: missing binary silent, missing binary warn, timeout, tolerated
status, non-tolerated status, args passed correctly.

`package.json#scripts.test` is updated to include `scripts/lib/runners.test.mjs` so `pnpm test`
covers the new file.

Full implementation details in `apps/claude-code/auto-format/docs/plans/26-runner-module.md`.

## Acceptance criteria

- [ ] `scripts/lib/runners.mjs` exists and exports `runFormatter`
- [ ] All 6 tests in `scripts/lib/runners.test.mjs` pass
- [ ] `pnpm test` passes (existing tests unaffected)
- [ ] `pnpm typecheck` passes
- [ ] `format-hook.mjs` is not modified in this issue

## Blocked by

01-formatter-descriptor-type
