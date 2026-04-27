# 15. Hoist extension Sets out of `main()`
**Status: todo**

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-04
**Touches:** `scripts/format-hook.mjs`

## Context

`main()` in `format-hook.mjs` creates two `new Set(...)` objects on every invocation:

```js
if (!new Set(CONFIG.prettierExtensions).has(ext)) return
// ...
if (new Set(CONFIG.eslintExtensions).has(ext)) runEslint(filePath)
```

`CONFIG` is already a module-level constant resolved once at startup. The Sets are therefore stable for the lifetime of the process and can be hoisted alongside `CONFIG`. Keeping them inside `main()` allocates and GC-collects two transient objects on every hook fire, and forces a reader to mentally re-derive that they are always equivalent to `CONFIG.*`.

No behaviour changes — only where the constants are declared.

## Current behaviour

After spec-04: `scripts/format-hook.mjs` creates `new Set(CONFIG.prettierExtensions)` and `new Set(CONFIG.eslintExtensions)` inside `main()`.

## Target behaviour

`PRETTIER_EXTS` and `ESLINT_EXTS` are module-level `Set` constants declared immediately after `CONFIG`, reused by `main()`.

```js
const CONFIG = loadProjectConfig()

const PRETTIER_EXTS = new Set(CONFIG.prettierExtensions)
const ESLINT_EXTS = new Set(CONFIG.eslintExtensions)

// … PRETTIER_BIN, ESLINT_BIN …

async function main() {
	// …
	if (!PRETTIER_EXTS.has(ext)) return
	runPrettier(filePath)
	if (ESLINT_EXTS.has(ext)) runEslint(filePath)
}
```

## Implementation steps

### Step 1 — Hoist the Sets in `scripts/format-hook.mjs`

Replace the two in-function `new Set(...)` references and add module-level constants.

Exact diff (tabs throughout):

1. After line `const CONFIG = loadProjectConfig()` add two lines:
   ```js
   const PRETTIER_EXTS = new Set(CONFIG.prettierExtensions)
   const ESLINT_EXTS = new Set(CONFIG.eslintExtensions)
   ```

2. Inside `main()` replace:
   ```js
   	if (!new Set(CONFIG.prettierExtensions).has(ext)) return
   
   	runPrettier(filePath)
   	if (new Set(CONFIG.eslintExtensions).has(ext)) runEslint(filePath)
   ```
   with:
   ```js
   	if (!PRETTIER_EXTS.has(ext)) return
   
   	runPrettier(filePath)
   	if (ESLINT_EXTS.has(ext)) runEslint(filePath)
   ```

### Step 2 — Commit

```sh
git add scripts/format-hook.mjs
git commit -m "refactor(spec-15): hoist extension Sets to module scope"
```

## Acceptance criteria

- `PRETTIER_EXTS` and `ESLINT_EXTS` are declared at module scope, not inside `main()`.
- No `new Set(CONFIG.*)` expressions remain inside `main()`.
- `pnpm test` still passes (all 8 smoke tests green).
- No external deps added.

## Verification

```sh
# 1. No in-function Set construction remains
grep -n "new Set" scripts/format-hook.mjs
# Expected: two lines, both outside main()

# 2. Tests still pass
pnpm test
```

## Out of scope

- Changing the logic of skip-prefix checks.
- Adding new extensions to either set.
- Merging with per-project config changes (spec-19 handles that).

_Ralph: append findings here._
