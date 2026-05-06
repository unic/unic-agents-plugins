# Add `FormatterDescriptor` typedef to `lib/types.mjs`

**Status:** resolved
**Category:** refactor

## Parent

`docs/issues/auto-format-runners/PRD.md`

## What to build

Add a `FormatterDescriptor` JSDoc typedef to `scripts/lib/types.mjs`, after the existing
`ProjectConfig` definition:

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

No runtime code changes. No other files touched.

## Acceptance criteria

- [ ] `grep -n "FormatterDescriptor" scripts/lib/types.mjs` → match
- [ ] All five fields present with correct types
- [ ] `pnpm typecheck` passes

## Blocked by

None — can start immediately.
