# PRD: auto-format — Formatter Runner Extraction

**Status:** open
**Plugin:** `apps/claude-code/auto-format`
**Specs:** `apps/claude-code/auto-format/docs/plans/25` through `28`

---

## Problem Statement

`format-hook.mjs` contains three formatter runner functions — `runPrettier`, `runEslint`, and
`runBiome` — that duplicate identical subprocess handling logic. Each function: checks for binary
existence, calls `spawnSync` with identical `cwd/stdio/timeout/killSignal` options, checks for
SIGTERM/null, and emits a stderr diagnostic on failure. A bug in the timeout or signal handling
must be patched in three places.

Two asymmetries between the runners are implicit in the per-function code rather than expressed as
explicit configuration:

- Biome warns to stderr when its binary is missing (user explicitly configured or auto-detected it);
  Prettier and ESLint are silently skipped.
- ESLint tolerates exit code 1 (lint violations remaining after `--fix`); Prettier and Biome treat
  any non-zero exit as a failure.

There is no way to test the subprocess contract (timeout behaviour, SIGTERM handling, tolerated exit
codes) without running the full hook against real formatter binaries.

## Solution

Extract a `runFormatter(descriptor, filePath, cwd, timeoutMs)` function to a new
`scripts/lib/runners.mjs` module. Each formatter is represented by a `FormatterDescriptor` object —
defined in `format-hook.mjs` — that declares the binary path, arg-builder function,
missing-binary behaviour, and tolerated exit codes. The runners module is formatter-agnostic; it
owns only the subprocess contract.

## Implementation Decisions

### 1. `args` is a function, not a static array

```js
args: (filePath) => ['--write', '--ignore-unknown', '--log-level', 'warn', filePath]
```

A static array with an implicit "filePath appended last" convention is fragile. A function makes
each formatter's argument construction explicit and handles cases where the file path position varies.

### 2. Descriptors live in `format-hook.mjs`, not in `lib/runners.mjs`

`lib/runners.mjs` is a generic subprocess runner with no knowledge of Prettier, ESLint, or Biome.
The three `FormatterDescriptor` constants (`PRETTIER_DESCRIPTOR`, `ESLINT_DESCRIPTOR`,
`BIOME_DESCRIPTOR`) are defined in `format-hook.mjs`, alongside the binary path constants and
`PROJECT_DIR` resolution logic they depend on.

### 3. `runFormatter` signature

```js
runFormatter(descriptor, filePath, cwd, timeoutMs)
```

`cwd` and `timeoutMs` are caller-supplied because they come from module-level `PROJECT_DIR` and
`CONFIG.formatTimeoutMs` — both owned by `format-hook.mjs`, not by `runners.mjs`.

### 4. Missing-binary asymmetry via `warnIfMissing`

`warnIfMissing?: boolean` in the descriptor. Biome sets it `true`; Prettier and ESLint omit it
(defaults `false` = silent). This captures the semantic: Biome is explicitly configured so a
missing binary is a real warning; Prettier/ESLint are opportunistically detected.

### 5. ESLint exit-code tolerance via `toleratedStatuses`

`toleratedStatuses?: number[]` in the descriptor. ESLint carries `[1]`; Prettier and Biome omit it
(defaults `[]`). Exit code 1 from ESLint means lint violations remain after `--fix` — not a hook
failure.

### 6. `FormatterDescriptor` typedef added to `lib/types.mjs`

Centralises the type alongside `HookEvent`, `FormatterName`, and `ProjectConfig`. The runners
module imports it via JSDoc `@import`.

## Testing Decisions

### No mocks — real child processes

Tests in `scripts/lib/runners.test.mjs` use `spawnSync` against stub Node.js scripts written to
temp directories. No mocking framework.

| Scenario                               | Stub                                            | Observable                                      |
| -------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Missing binary, `warnIfMissing: false` | non-existent path                               | zero stderr lines                               |
| Missing binary, `warnIfMissing: true`  | non-existent path                               | stderr contains "binary not found"              |
| Timeout                                | `setInterval(()=>{}, 999)` with `timeoutMs: 50` | stderr contains "timed out"                     |
| Tolerated exit code                    | `process.exit(1)`                               | zero stderr lines with `toleratedStatuses: [1]` |
| Non-tolerated exit code                | `process.exit(2)`                               | stderr contains "failed (exit 2)"               |
| Args passed correctly                  | echoes `process.argv[2]` to sentinel file       | sentinel file exists                            |

### Test command update

`package.json#scripts.test` is updated to include `scripts/lib/runners.test.mjs` so `pnpm test`
covers the new file:

```
node --test tests/format-hook.test.mjs scripts/lib/runners.test.mjs
```

### Existing tests unaffected

`tests/format-hook.test.mjs` tests end-to-end hook behaviour via stub binaries. External behaviour
is unchanged (same formatters, same skip rules), so those tests must pass without modification.

## Out of Scope

- Adding new formatters (Oxc, Rome, etc.)
- Making the runner async
- Changing the config schema or adding formatter-specific config keys
- Changing the binary discovery strategy
- Changing error message text format
