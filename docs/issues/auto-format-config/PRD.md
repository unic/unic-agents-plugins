# PRD: auto-format — Config Loading Extraction

**Status:** open
**Plugin:** `apps/claude-code/auto-format`
**Specs:** `apps/claude-code/auto-format/docs/plans/29` through `31`

---

## Problem Statement

`loadProjectConfig()` (lines 65–93 of `format-hook.mjs`) contains non-trivial merge logic — three
branches for `skipPrefixes` (full replacement, additive, or default), timeout clamping to
[1000, 120000], and formatter validation. This logic is currently only reachable by running the
full hook, because the function closes over the module-level `PROJECT_DIR` constant rather than
accepting a directory as a parameter.

`DEFAULTS` (lines 25–57) defines the full config contract — all extension lists, the timeout, and
the `formatter` mode — but lives in the same file as the hook's entry point, making the config
surface implicit.

There are no unit tests for the merge strategy. A test that verifies, say, that `additionalSkipPrefixes`
appends to DEFAULTS rather than replacing them requires either mocking Node's `fs` module or
running the whole hook.

## Solution

Extract `loadProjectConfig` and `DEFAULTS` to a new `scripts/lib/config.mjs` module. The function
is renamed `loadConfig(projectDir)`, taking the project directory as a parameter. `DEFAULTS` is
exported so tests can assert against it without hardcoding expected values.

`format-hook.mjs` replaces `const CONFIG = loadProjectConfig()` with
`const CONFIG = loadConfig(PROJECT_DIR)` and removes the now-moved code.

## Implementation Decisions

### 1. `DEFAULTS` moves to `lib/config.mjs` and is exported

Config contract and config loading belong together. `format-hook.mjs` doesn't use `DEFAULTS`
directly (only `CONFIG`, the merged result), so the move removes `DEFAULTS` from the hook file
entirely. Tests import `DEFAULTS` to assert "returns DEFAULTS when no config file exists" without
hardcoding expected values.

### 2. `loadConfig(projectDir: string) → ProjectConfig` — directory as parameter

Removing the closure over `PROJECT_DIR` makes `loadConfig` a near-pure function of its input: given
a directory, it returns a `ProjectConfig`. Tests pass a temp directory. The hook passes
`PROJECT_DIR`. No change to behavior.

### 3. `VALID_FORMATTERS` becomes a module-internal constant in `lib/config.mjs`

Not exported — it is an implementation detail of the validation step, not part of the interface.

### 4. Test strategy: real temp directories

Consistent with spec-26 (runners). Tests in `scripts/lib/config.test.mjs`:
- `mkdtempSync` to create isolated project root
- Write `.claude/unic-format.json` for scenarios that need it
- Call `loadConfig(tempDir)`, assert on returned `ProjectConfig`
- `rmSync(dir, { recursive: true })` in every `finally` block

No mocking of `fs` module.

## Tests

Ten scenarios covering the complete merge logic:

| Scenario | Input | Expected |
|---|---|---|
| No config file | directory with no `.claude/` | `DEFAULTS` |
| Malformed JSON | invalid JSON in config file | `DEFAULTS` + stderr warning |
| Full `skipPrefixes` replacement | non-empty `skipPrefixes` array | provided array only |
| Additive `additionalSkipPrefixes` | `additionalSkipPrefixes` array, no `skipPrefixes` | DEFAULTS + provided extras |
| Neither field | empty config object `{}` | `DEFAULTS.skipPrefixes` |
| `formatTimeoutMs` lower clamp | value below 1000 | 1000 |
| `formatTimeoutMs` upper clamp | value above 120000 | 120000 |
| `formatTimeoutMs` valid | value within range | provided value |
| Invalid `formatter` value | `"webpack"` | `DEFAULTS.formatter` |
| Valid `formatter` value | `"biome"` | `"biome"` |

`tests/format-hook.test.mjs` must pass without modification (no external behaviour change).

## Out of Scope

- Changing the config schema
- Adding new config keys
- Hot-reloading config during a hook run
- Exporting `VALID_FORMATTERS`
