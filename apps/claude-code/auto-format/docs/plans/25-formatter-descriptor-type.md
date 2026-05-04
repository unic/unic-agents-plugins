# 25. Add `FormatterDescriptor` typedef to `lib/types.mjs`

**Priority:** P2
**Effort:** XS
**Version impact:** patch
**Depends on:** spec-22
**Touches:** `scripts/lib/types.mjs`

## Context

The upcoming `lib/runners.mjs` module (spec-26) needs a `FormatterDescriptor` type. Adding it to
`lib/types.mjs` first keeps all type definitions centralised and lets spec-26 reference it via a
JSDoc `@import` tag without any coupling to `format-hook.mjs`.

## Current behaviour

`scripts/lib/types.mjs` defines `HookEvent`, `FormatterName`, and `ProjectConfig`. There is no
`FormatterDescriptor` type.

## Target behaviour

`lib/types.mjs` contains a `FormatterDescriptor` typedef after `ProjectConfig`:

```js
/**
 * Descriptor for a single formatter invocation.
 *
 * @typedef {{
 *   name: string,
 *   bin: string,
 *   args: (filePath: string) => string[],
 *   warnIfMissing?: boolean,
 *   toleratedStatuses?: number[],
 * }} FormatterDescriptor
 */
```

Fields:
- `name` — human-readable label used in stderr messages (e.g. `"prettier"`)
- `bin` — absolute path to the formatter binary
- `args` — function that receives an absolute file path and returns the full argument array
- `warnIfMissing` — when true, emit a stderr warning if `bin` does not exist; defaults false
- `toleratedStatuses` — exit codes not treated as failures; defaults `[]`

## Affected files

| File | Change |
|---|---|
| `scripts/lib/types.mjs` | Add `FormatterDescriptor` typedef after `ProjectConfig` |

## Implementation steps

### Step 1 — Add typedef to `scripts/lib/types.mjs`

Open `scripts/lib/types.mjs`. After the closing `*/` of the `ProjectConfig` typedef, add:

```js
/**
 * Descriptor for a single formatter invocation.
 *
 * @typedef {{
 *   name: string,
 *   bin: string,
 *   args: (filePath: string) => string[],
 *   warnIfMissing?: boolean,
 *   toleratedStatuses?: number[],
 * }} FormatterDescriptor
 */
```

Leave the `export {}` line at the end of the file in place.

### Step 2 — Commit

```sh
git add scripts/lib/types.mjs
git commit -m "chore(spec-25): add FormatterDescriptor typedef to lib/types.mjs"
```

## Verification

```sh
# Typedef present
grep -n "FormatterDescriptor" scripts/lib/types.mjs

# Type-check passes
pnpm typecheck
```

## Acceptance criteria

- [ ] `FormatterDescriptor` typedef exists in `scripts/lib/types.mjs`
- [ ] All five fields present with correct types
- [ ] `pnpm typecheck` passes
- [ ] No other files modified

## Out of scope

- Runtime exports
- Changes to any file other than `scripts/lib/types.mjs`

_Ralph: append findings here._
