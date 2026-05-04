# 27. Replace runner functions with descriptors in `format-hook.mjs`
**Status: done — 2026-05-04**

**Priority:** P2
**Effort:** S
**Version impact:** patch
**Depends on:** spec-26
**Touches:** `scripts/format-hook.mjs`

## Context

`lib/runners.mjs` and `FormatterDescriptor` exist after spec-26. This spec wires them into
`format-hook.mjs` by replacing the three inline runner functions with three descriptor constants
and a single call-through to `runFormatter`. External behaviour is identical.

## Current behaviour

`format-hook.mjs` defines `runPrettier`, `runEslint`, `runBiome` — three functions that duplicate
the same `spawnSync` contract. `main()` calls them directly.

## Target behaviour

`format-hook.mjs` defines `PRETTIER_DESCRIPTOR`, `ESLINT_DESCRIPTOR`, `BIOME_DESCRIPTOR` constants.
`main()` calls `runFormatter(descriptor, filePath, PROJECT_DIR, CONFIG.formatTimeoutMs)`.
The three runner functions are deleted.

`tests/format-hook.test.mjs` passes without modification.

## Affected files

| File | Change |
|---|---|
| `scripts/format-hook.mjs` | Remove three runner functions; add descriptors; update imports and dispatch |

## Implementation steps

### Step 1 — Add imports at the top of `format-hook.mjs`

After the existing `import` block, add:

```js
import { runFormatter } from './lib/runners.mjs'
```

Add a type-import tag alongside the existing ones:

```js
/** @import { FormatterDescriptor } from './lib/types.mjs' */
```

### Step 2 — Add descriptor constants

After the `BIOME_AVAILABLE` constant and before `toPosix`, add:

```js
/** @type {FormatterDescriptor} */
const PRETTIER_DESCRIPTOR = {
	name: 'prettier',
	bin: PRETTIER_BIN,
	args: (f) => ['--write', '--ignore-unknown', '--log-level', 'warn', f],
}

/** @type {FormatterDescriptor} */
const ESLINT_DESCRIPTOR = {
	name: 'eslint',
	bin: ESLINT_BIN,
	args: (f) => ['--fix', '--no-error-on-unmatched-pattern', f],
	toleratedStatuses: [1],
}

/** @type {FormatterDescriptor} */
const BIOME_DESCRIPTOR = {
	name: 'biome',
	bin: BIOME_BIN,
	args: (f) => ['check', '--write', '--no-errors-on-unmatched-pattern', f],
	warnIfMissing: true,
}
```

### Step 3 — Update `main()` dispatch

Replace the current formatter dispatch in `main()`:

```js
if (usesBiome) {
	runBiome(filePath)
} else {
	runPrettier(filePath)
	if (ESLINT_EXTS.has(ext)) runEslint(filePath)
}
```

with:

```js
const run = (/** @type {FormatterDescriptor} */ d) => runFormatter(d, filePath, PROJECT_DIR, CONFIG.formatTimeoutMs)
if (usesBiome) {
	run(BIOME_DESCRIPTOR)
} else {
	run(PRETTIER_DESCRIPTOR)
	if (ESLINT_EXTS.has(ext)) run(ESLINT_DESCRIPTOR)
}
```

### Step 4 — Delete the three runner functions

Delete the entire bodies of `runPrettier` (lines ~137–152), `runEslint` (lines ~161–180), and
`runBiome` (lines ~189–209) including their JSDoc comments. Verify no other references remain:

```sh
grep -n "runPrettier\|runEslint\|runBiome" scripts/format-hook.mjs
```

Expected: 0 matches.

### Step 5 — Verify and commit

```sh
pnpm test
pnpm typecheck
git add scripts/format-hook.mjs
git commit -m "refactor(spec-27): replace runner functions with FormatterDescriptor constants"
```

## Verification

```sh
# No old runner functions remain
grep -n "function runPrettier\|function runEslint\|function runBiome" scripts/format-hook.mjs

# Three descriptors present
grep -n "PRETTIER_DESCRIPTOR\|ESLINT_DESCRIPTOR\|BIOME_DESCRIPTOR" scripts/format-hook.mjs

# Full test suite passes (no changes to test file)
pnpm test

# Type-check passes
pnpm typecheck
```

## Acceptance criteria

- [ ] `grep -n "function runPrettier\|function runEslint\|function runBiome" scripts/format-hook.mjs` → 0 matches
- [ ] `grep -n "PRETTIER_DESCRIPTOR\|ESLINT_DESCRIPTOR\|BIOME_DESCRIPTOR" scripts/format-hook.mjs` → 3 matches
- [ ] `grep -n "runFormatter" scripts/format-hook.mjs` → at least 1 match
- [ ] `pnpm test` passes with zero changes to `tests/format-hook.test.mjs`
- [ ] `pnpm typecheck` passes

## Out of scope

- Changing skip logic, extension sets, config loading, or any other behaviour
- Modifying test files

_Ralph: append findings here._
