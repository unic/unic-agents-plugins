# 01. tsconfig Workspace Package

**Status: done — 2026-04-29**

**Priority:** P1
**Effort:** S
**Version impact:** none
**Depends on:** 00
**Touches:** `packages/tsconfig/`, `tsconfig.base.json` (root)

## Context

Plugin packages will need a shared TypeScript base config for `tsc --checkJs --noEmit`. Rather than each package copying the same options, `@unic/tsconfig` exports a `tsconfig.base.json` that any plugin extends. The root `tsconfig.base.json` is a placeholder seed; this spec moves the content into the package and removes the root file.

## Current behaviour

`packages/tsconfig/package.json` is a stub (no `tsconfig.base.json` inside). Root `tsconfig.base.json` contains:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

## Target behaviour

- `packages/tsconfig/tsconfig.base.json` contains the compiler options above
- `packages/tsconfig/package.json` exports the file correctly
- Root `tsconfig.base.json` is deleted
- `@unic/tsconfig` is added as `workspace:*` devDependency in the root `package.json`
- `pnpm install` succeeds; `pnpm typecheck` still passes

## Affected files

| File                                   | Change                                            |
| -------------------------------------- | ------------------------------------------------- |
| `packages/tsconfig/tsconfig.base.json` | Create                                            |
| `packages/tsconfig/package.json`       | Modify — add `exports`                            |
| `tsconfig.base.json` (root)            | Delete                                            |
| `package.json` (root)                  | Modify — add `@unic/tsconfig: workspace:*` devDep |

## Implementation steps

1. Create `packages/tsconfig/tsconfig.base.json` with the content from the current root `tsconfig.base.json`.

2. Update `packages/tsconfig/package.json`:

   ```json
   {
     "name": "@unic/tsconfig",
     "version": "0.0.0",
     "private": true,
     "license": "LGPL-3.0-or-later",
     "files": ["tsconfig.base.json"],
     "exports": {
       "./tsconfig.base.json": "./tsconfig.base.json"
     }
   }
   ```

3. Delete root `tsconfig.base.json`.

4. Add `"@unic/tsconfig": "workspace:*"` to `devDependencies` in root `package.json`.

5. Run `pnpm install` to link the new workspace package.

## Verification

```sh
pnpm install            # exits 0
pnpm typecheck          # exits 0
node -e "import('@unic/tsconfig/tsconfig.base.json', { with: { type: 'json' } }).then(m => console.log(m.default.compilerOptions.target))"
# prints: ES2022
```

## Acceptance criteria

- [ ] `packages/tsconfig/tsconfig.base.json` exists with `"target": "ES2022"`
- [ ] `packages/tsconfig/package.json` has an `exports` field
- [ ] Root `tsconfig.base.json` is deleted
- [ ] `pnpm install` succeeds
- [ ] `pnpm typecheck` passes

## Out of scope

- Updating individual plugin packages to extend from `@unic/tsconfig` — that happens in specs 05–07
- Adding any linting rules or additional config files

## Deviations

The spec's verification command uses the `assert` import attribute syntax:

```sh
node -e "import('@unic/tsconfig/tsconfig.base.json', { with: { type: 'json' } })..."
```

Node 24 requires `with` instead of `assert` (the `assert` form throws `ERR_IMPORT_ATTRIBUTE_MISSING`). The package works correctly; the verification was run with `{ with: { type: 'json' } }` and printed `ES2022` as expected.
