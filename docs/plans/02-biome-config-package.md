# 02. biome-config Workspace Package

**Priority:** P1
**Effort:** S
**Version impact:** none
**Depends on:** 01
**Touches:** `packages/biome-config/`, `biome.json` (root), `package.json` (root)

## Context

The root `biome.json` currently contains all Biome rules inline. Extracting them into `@unic/biome-config` lets plugin packages extend the same rules, and makes it easy to update rules in one place.

## Current behaviour

Root `biome.json` (full inline rules, see current file).

`packages/biome-config/package.json` is a stub (no `biome.json` inside).

## Target behaviour

- `packages/biome-config/biome.json` contains all current Biome rules
- Root `biome.json` is simplified to extend from `@unic/biome-config/biome.json` plus workspace-level file overrides
- `@unic/biome-config` is added as `workspace:*` devDependency in the root `package.json`
- `pnpm check` still passes after the change

## Affected files

| File | Change |
|---|---|
| `packages/biome-config/biome.json` | Create |
| `packages/biome-config/package.json` | Modify — add `exports` |
| `biome.json` (root) | Modify — replace inline rules with `extends` |
| `package.json` (root) | Modify — add `@unic/biome-config: workspace:*` devDep |

## Implementation steps

1. Copy the full content of the current root `biome.json` into `packages/biome-config/biome.json`. Remove the `"files"` section from the copy (that section is workspace-specific and belongs in the root).

2. Update `packages/biome-config/package.json`:

   ```json
   {
     "name": "@unic/biome-config",
     "version": "0.0.0",
     "private": true,
     "license": "LGPL-3.0-or-later",
     "files": ["biome.json"],
     "exports": {
       "./biome.json": "./biome.json"
     }
   }
   ```

3. Replace root `biome.json` with a minimal file that extends the package and keeps the workspace-level `"files"` overrides:

   ```json
   {
     "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
     "extends": ["@unic/biome-config/biome.json"],
     "files": {
       "includes": [
         "**",
         "!**/node_modules",
         "!**/.history",
         "!**/pnpm-lock.yaml",
         "!**/.claude",
         "!**/.ralph",
         "!**/*.min.js"
       ]
     }
   }
   ```

4. Add `"@unic/biome-config": "workspace:*"` to `devDependencies` in root `package.json`.

5. Run `pnpm install` to link the new workspace package.

## Verification

```sh
pnpm install   # exits 0
pnpm check     # exits 0 — Biome still finds and checks all files
pnpm ci:check  # exits 0
```

## Acceptance criteria

- [ ] `packages/biome-config/biome.json` exists with `"formatter"`, `"linter"`, `"javascript"`, `"json"` sections
- [ ] `packages/biome-config/package.json` has `exports` field
- [ ] Root `biome.json` has an `"extends"` key pointing to `@unic/biome-config/biome.json`
- [ ] `pnpm install` succeeds
- [ ] `pnpm check` passes

## Out of scope

- Updating individual plugin packages to extend from `@unic/biome-config` — happens in specs 05–07
- Changing any linting rules
