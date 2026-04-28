# 22. JSDoc Types and `--checkJs` Type-Checking

**Priority:** P2
**Effort:** M
**Version impact:** patch
**Depends on:** spec-19 (Biome support — ensures format diffs and JSDoc diffs stay in separate commits)
**Touches:** `scripts/format-hook.mjs`, `scripts/sync-version.mjs`, `scripts/bump.mjs`, `scripts/tag.mjs`, `scripts/verify-changelog.mjs`, `scripts/lib/types.mjs` (new), `tests/format-hook.test.mjs`, `tests/sync-version.test.mjs`, `package.json`, `pnpm-workspace.yaml`, `README.md`, `CLAUDE.md`

## Context

The codebase is plain JavaScript (ESM). There is no build step and no TypeScript transpilation. Adding `// @ts-check` at the top of each source file and JSDoc type annotations on public functions gives editor-level type safety (VS Code underlines type errors in real time) and catches an entire class of bugs — wrong argument types, missing properties, `undefined` values used as strings — without introducing a TypeScript build step. The `tsc --checkJs` flag extends this to local dev: type errors are visible immediately via `pnpm typecheck`. This is the lightest possible path to type safety in a no-build ESM project.

This pattern is already established in the sibling `unic-claude-code-confluence` plugin (spec 14, landed 2026-04-24) and is ported here for parity. The motivation in this repo is the same: catch latent type holes in `format-hook.mjs` — e.g. `JSON.parse(buf)` produces `any`, `event?.tool_input?.file_path` is `string | undefined`, catch-clause `err` is `unknown` under `--strict`. All are safe at runtime but undetectable by the IDE today.

The choice to NOT convert to `.ts` files is deliberate — it keeps the plugin source dependency-free at runtime and copy-paste-friendly.

`typescript` and `@types/node` are **dev-only**. They have zero impact on the hook's runtime behaviour and do not touch the consumer-facing contract. This spec does not conflict with the scope guard.

## Current behaviour

- No `// @ts-check` directive in any `.mjs` file.
- No JSDoc annotations on any function in `scripts/` or `tests/`.
- No `typescript` or `@types/node` in `devDependencies`. `pnpm-workspace.yaml` catalog has only `@ralph-orchestrator/ralph-cli`.
- No `pnpm typecheck` script.
- No `tsconfig.json`.
- Latent type holes in `scripts/format-hook.mjs`:
  - `JSON.parse(readFileSync(configPath))` and `JSON.parse(buf)` return `any` — type errors silently propagate.
  - `event?.tool_input?.file_path` is `string | undefined`; the truthy check on line 180 guards runtime but does not narrow the type.
  - `catch (err)` blocks reference `err.message` — under `--strict`, `err` is `unknown`, so this is a type error.
  - `spawnSync` return `.stderr` is `Buffer | null`; the `?.toString()` access is fine but `.status` is `number | null`.

## Target behaviour

After this spec:

1. Every `.mjs` file in `scripts/` (including the new `scripts/lib/` subdirectory) and `tests/` starts with `// @ts-check` on the second line (after the SPDX comment or file header).
2. `scripts/lib/types.mjs` defines shared type shapes as JSDoc `@typedef` blocks — no runtime exports.
3. Public functions in all scripts are annotated with `@param` and `@returns` JSDoc tags.
4. `pnpm typecheck` runs `tsc --noEmit --allowJs --checkJs --strict --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/*.mjs scripts/lib/*.mjs tests/*.mjs` and exits 0.
5. VS Code (with the TypeScript language server) shows 0 errors in the Problems panel for all annotated `.mjs` files.
6. No `.ts` files are created. No transpilation step is introduced.

## Implementation steps

### Step 1 — Add `typescript` and `@types/node` to catalog and devDependencies

Edit `pnpm-workspace.yaml`:

```yaml
# BEFORE:
catalog:
  "@ralph-orchestrator/ralph-cli": 2.9.2

# AFTER:
catalog:
  "@ralph-orchestrator/ralph-cli": 2.9.2
  "@types/node": "24.12.2"   # Ralph: replace with latest stable @types/node@24.x
  typescript: "5.8.3"        # Ralph: replace with latest stable TypeScript 5.x
```

Edit `package.json` `devDependencies`:

```json
"devDependencies": {
  "@ralph-orchestrator/ralph-cli": "catalog:",
  "@types/node": "catalog:",
  "typescript": "catalog:"
}
```

Run `pnpm install`.

### Step 2 — Add `pnpm typecheck` script to `package.json`

Add to the `"scripts"` block:

```json
"typecheck": "tsc --noEmit --allowJs --checkJs --strict --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/*.mjs scripts/lib/*.mjs tests/*.mjs"
```

Do NOT create a `tsconfig.json`. The inline flags are sufficient for this repo's file count. A `tsconfig.json` is only warranted if the command line grows past ~120 chars or a second target (e.g. different settings for tests) is needed — document that in the follow-ups section.

### Step 3 — Create `scripts/lib/types.mjs`

Create the directory `scripts/lib/` and the new file `scripts/lib/types.mjs`. This file has NO runtime code — it exists only to define JSDoc types accessible via `@import` directives in other files.

```js
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/**
 * Shared JSDoc type definitions for format-hook.mjs and its helpers.
 * No runtime exports — import types only via JSDoc @import directives.
 */

/**
 * The hook event JSON received on stdin from Claude Code's PostToolUse hook.
 *
 * @typedef {{
 *   tool_input?: {
 *     file_path?: string,
 *     notebook_path?: string
 *   }
 * }} HookEvent
 */

/**
 * Formatter selection — the set of values accepted by the `formatter` config key.
 *
 * @typedef {'auto' | 'prettier' | 'biome'} FormatterName
 */

/**
 * Resolved project configuration (output of loadProjectConfig).
 *
 * @typedef {{
 *   skipPrefixes: string[],
 *   prettierExtensions: string[],
 *   eslintExtensions: string[],
 *   formatTimeoutMs: number,
 *   formatter: FormatterName
 * }} ProjectConfig
 */

export {}
```

The `export {}` makes this a valid ESM module under `--moduleResolution NodeNext`. The `@typedef` blocks are visible to any file that imports via JSDoc `/** @import { ... } from './lib/types.mjs' */`.

### Step 4 — Add `// @ts-check` and JSDoc to `scripts/format-hook.mjs`

Add to the top of the file (after the `#!/usr/bin/env node` line and the existing block comment):

```js
// @ts-check
/** @import { HookEvent, ProjectConfig, FormatterName } from './lib/types.mjs' */
```

Annotate `loadProjectConfig`:

```js
/**
 * Reads .claude/unic-format.json from the consumer project root and merges
 * it with DEFAULTS. Returns DEFAULTS on missing file or parse error.
 *
 * @returns {ProjectConfig}
 */
function loadProjectConfig() {
```

Note: the `cfg` local from `JSON.parse` is `any` — cast it to `Record<string, unknown>` to avoid propagating `any`:

```js
const cfg = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(configPath, 'utf8')))
```

For the `formatter` field, `VALID_FORMATTERS.has(cfg.formatter)` narrows nothing by itself — use a type assertion on the result:

```js
formatter: /** @type {FormatterName} */ (VALID_FORMATTERS.has(cfg.formatter) ? cfg.formatter : DEFAULTS.formatter),
```

Annotate the catch block to fix `err.message` under `--strict` (`err` is `unknown`):

```js
} catch (err) {
  process.stderr.write(`unic-format: ignoring malformed .claude/unic-format.json: ${/** @type {Error} */ (err).message}\n`)
  return DEFAULTS
}
```

Annotate `toPosix`:

```js
/**
 * Converts a native path to forward-slash separators (no-op on POSIX).
 *
 * @param {string} p
 * @returns {string}
 */
function toPosix(p) {
```

Annotate `shouldSkip`:

```js
/**
 * Returns true if the relative posix path should be skipped by the formatter.
 *
 * @param {string} rel - Posix-style path relative to PROJECT_DIR.
 * @returns {boolean}
 */
function shouldSkip(rel) {
```

Annotate `runPrettier`, `runEslint`, `runBiome`:

```js
/**
 * Runs `prettier --write` on filePath using the consumer's local Prettier binary.
 * No-ops if Prettier is not installed. Always returns undefined.
 *
 * @param {string} filePath - Absolute path to the file to format.
 * @returns {void}
 */
function runPrettier(filePath) {
```

```js
/**
 * Runs `eslint --fix` on filePath using the consumer's local ESLint binary.
 * No-ops if ESLint is not installed. Exit status 1 (unfixed lint violations) is tolerated.
 *
 * @param {string} filePath - Absolute path to the file to lint.
 * @returns {void}
 */
function runEslint(filePath) {
```

```js
/**
 * Runs `biome check --write` on filePath using the consumer's local Biome binary.
 * No-ops (with stderr warning) if Biome binary is missing.
 *
 * @param {string} filePath - Absolute path to the file to format.
 * @returns {void}
 */
function runBiome(filePath) {
```

Annotate `main`:

```js
/**
 * Entry point — reads the Claude Code hook event from stdin, resolves the
 * target file path, guards against skip conditions, and dispatches to the
 * appropriate formatter runner.
 *
 * @returns {Promise<void>}
 */
async function main() {
```

Cast the `JSON.parse(buf)` result and fix the catch clause:

```js
let event
try {
  event = /** @type {HookEvent} */ (JSON.parse(buf))
} catch {
  process.stderr.write('unic-format: could not parse hook input as JSON\n')
  return
}
```

### Step 5 — Add `// @ts-check` and JSDoc to `scripts/sync-version.mjs`

Add `// @ts-check` after the leading comment. Cast all `JSON.parse` calls to `Record<string, unknown>` and narrow results before writes. Annotate exported or top-level functions with `@param` / `@returns`.

### Step 6 — Add `// @ts-check` and JSDoc to `scripts/bump.mjs`, `scripts/tag.mjs`, `scripts/verify-changelog.mjs`

Add `// @ts-check` after the leading comment in each file. Cast `JSON.parse` results. Annotate all top-level functions. Fix any `err.message` catch references using the `/** @type {Error} */ (err).message` pattern.

### Step 7 — Add `// @ts-check` to `tests/format-hook.test.mjs` and `tests/sync-version.test.mjs`

Add `// @ts-check` after the leading comment. Annotate the `makeConsumer`, `run`, and `cleanup` helpers. Cast `JSON.parse` calls on stdout from the hook script. Fix any catch-clause `err.message` references.

### Step 8 — Run `pnpm typecheck` and fix all reported errors

Address each error using these canonical patterns:

**`JSON.parse` returns `any`:**
```js
const cfg = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(path, 'utf8')))
```

**catch clause `err` is `unknown`:**
```js
} catch (err) {
  // cast to Error — we control what we throw, so this is safe
  process.stderr.write(`...: ${/** @type {Error} */ (err).message}\n`)
}
```

**string-union narrowing for formatter:**
```js
formatter: /** @type {FormatterName} */ (VALID_FORMATTERS.has(cfg.formatter) ? cfg.formatter : DEFAULTS.formatter),
```

Do NOT add `@ts-ignore`. Only `@ts-expect-error` with an explanatory comment is acceptable where tsc is provably wrong.

### Step 9 — Update `README.md` and `CLAUDE.md`

In `README.md`, add `pnpm typecheck` to the developer commands table or contributing section.

In `CLAUDE.md` under `## Commands`, add:

```sh
pnpm typecheck       # Type-check plugin source (tsc --checkJs, dev-only)
```

### Step 10 — Commit

```sh
git add scripts tests package.json pnpm-workspace.yaml README.md CLAUDE.md docs/plans/22-jsdoc-types-ts-check.md docs/plans/README.md
git commit -m "feat(spec-22): add // @ts-check + JSDoc types and pnpm typecheck"
```

## Test cases

### TC-01: `pnpm typecheck` exits 0 on clean codebase

```sh
pnpm typecheck
# Expected: exit 0, no output
```

### TC-02: Introducing a type error causes exit 1

Temporarily add to `format-hook.mjs`:

```js
const e = /** @type {HookEvent} */ ({})
const bad = e.tool_input.bogusField  // Property 'bogusField' does not exist
```

```sh
pnpm typecheck
# Expected: exit 1, output mentions 'bogusField' and 'HookEvent'
```

Remove the line afterward.

### TC-03: `JSON.parse` casts suppress `any` propagation

After adding `/** @type {HookEvent} */` cast to `event`, hover over `event.tool_input?.file_path` in VS Code — it should be typed as `string | undefined` (not `any`).

### TC-04: No `.ts` files created

```sh
find scripts tests -name "*.ts" | wc -l
# Expected: 0
```

### TC-05: `pnpm test` still passes

```sh
pnpm test
# Expected: exit 0 — JSDoc annotations must not break any existing tests
```

### TC-06: No `@ts-ignore` directives

```sh
grep -rn "@ts-ignore" scripts/ tests/
# Expected: 0 results
```

## Acceptance criteria

- `// @ts-check` appears in every `.mjs` file in `scripts/` (including `scripts/lib/types.mjs`) and `tests/`.
- `scripts/lib/types.mjs` exists with `HookEvent`, `FormatterName`, and `ProjectConfig` typedefs.
- `loadProjectConfig`, `toPosix`, `shouldSkip`, `runPrettier`, `runEslint`, `runBiome`, and `main` all have `@param` and/or `@returns` JSDoc annotations.
- `pnpm typecheck` exits 0 with zero errors.
- No `@ts-ignore` directives in any file (only `@ts-expect-error` with comment if truly necessary).
- No `.ts` files created. No `tsconfig.json` created.
- `pnpm test` still passes.

## Verification

```sh
# Confirm @ts-check in all .mjs source files
grep -rL "@ts-check" scripts/ tests/
# Expected: empty output (all files have it)

# Confirm types.mjs exists
ls scripts/lib/types.mjs

# Run type check
pnpm typecheck

# Confirm no .ts files
find scripts tests -name "*.ts"
# Expected: empty

# Confirm no @ts-ignore
grep -rn "@ts-ignore" scripts/ tests/
# Expected: 0 results

# Run tests
pnpm test
```

## Out of scope

- Do not convert any `.mjs` file to `.ts`.
- Do not create a `tsconfig.json` (inline flags are sufficient for this repo size).
- Do not add `strict: false` to work around errors — fix the underlying issues.
- Do not add `@ts-ignore` directives.
- Do not add a runtime dependency or change the hook's runtime behaviour.
- Do not type-check consumer files from the hook — that would require bundling `tsc` or requiring consumers to install TypeScript, which conflicts with the scope guard.

## Follow-ups

- Add `pnpm typecheck` to CI (`.github/workflows/ci.yml`) as a step alongside `pnpm test` — deferred to keep annotation churn and CI changes in separate commits.
- Create a `tsconfig.json` if the inline `tsc` flags line grows past ~120 chars or if tests need different settings.
- Consider `--noUncheckedIndexedAccess` after the codebase is stable under `--strict`.

_Ralph: append findings here._
