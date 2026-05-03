# 30. Update `format-hook.mjs` to use `lib/config.mjs`
**Status: done — 2026-05-04**

**Priority:** P2
**Effort:** XS
**Version impact:** patch
**Depends on:** spec-29
**Touches:** `scripts/format-hook.mjs`

## Context

`lib/config.mjs` exists after spec-29 and exports `DEFAULTS` and `loadConfig`. This spec removes
the now-duplicated code from `format-hook.mjs` and wires in the new module. External behaviour
is unchanged.

## Current behaviour

`format-hook.mjs` defines `DEFAULTS` (lines 25–57) and `loadProjectConfig()` (lines 65–93).
`const CONFIG = loadProjectConfig()` calls the inline function.

## Target behaviour

`format-hook.mjs` imports `loadConfig` from `./lib/config.mjs`. The `DEFAULTS` constant and
`loadProjectConfig` function are deleted. `const CONFIG = loadConfig(PROJECT_DIR)`.

`tests/format-hook.test.mjs` passes without modification.

## Affected files

| File | Change |
|---|---|
| `scripts/format-hook.mjs` | Remove `DEFAULTS` + `loadProjectConfig`; add import; update call site |

## Implementation steps

### Step 1 — Add import

At the top of `format-hook.mjs`, after the existing Node.js imports, add:

```js
import { loadConfig } from './lib/config.mjs'
```

Also add the type-import tag alongside existing `@import` tags:

```js
/** @import { ProjectConfig, FormatterName } from './lib/types.mjs' */
```

can be trimmed — `ProjectConfig` and `FormatterName` are no longer used directly in the file after
this spec. Keep only `HookEvent`:

```js
/** @import { HookEvent } from './lib/types.mjs' */
```

### Step 2 — Delete `DEFAULTS` constant

Remove lines 24–57 (the `/** @type {ProjectConfig} */` JSDoc and the `const DEFAULTS = { ... }`
block including its closing `}`).

### Step 3 — Delete `loadProjectConfig` function

Remove lines 60–93 (the JSDoc comment, the `function loadProjectConfig() { ... }` block including
its closing `}`).

### Step 4 — Update the call site

Change:

```js
const CONFIG = loadProjectConfig()
```

to:

```js
const CONFIG = loadConfig(PROJECT_DIR)
```

### Step 5 — Verify and commit

```sh
# No old code remains
grep -n "const DEFAULTS\|function loadProjectConfig" scripts/format-hook.mjs

# Full suite passes
pnpm test

# Type-check passes
pnpm typecheck

git add scripts/format-hook.mjs
git commit -m "refactor(spec-30): use lib/config.mjs in format-hook.mjs"
```

## Verification

```sh
grep -n "const DEFAULTS\|function loadProjectConfig" scripts/format-hook.mjs
grep -n "loadConfig" scripts/format-hook.mjs
pnpm test
pnpm typecheck
```

## Acceptance criteria

- [ ] `grep -n "const DEFAULTS\|function loadProjectConfig" scripts/format-hook.mjs` → 0 matches
- [ ] `grep -n "loadConfig" scripts/format-hook.mjs` → match on import line and call site
- [ ] `pnpm test` passes without any changes to `tests/format-hook.test.mjs`
- [ ] `pnpm typecheck` passes

## Out of scope

- Changes to any file other than `scripts/format-hook.mjs`
- Changing skip logic, extension sets, or any other hook behaviour

_Ralph: append findings here._
