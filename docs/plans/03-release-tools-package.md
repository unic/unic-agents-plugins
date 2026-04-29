# 03. release-tools Workspace Package
**Status: done — 2026-04-29**

**Priority:** P0
**Effort:** L
**Version impact:** none
**Depends on:** 02
**Touches:** `packages/release-tools/`, `package.json` (root)

## Context

Each existing plugin repo has its own copy of `bump-version.mjs`, `sync-version.mjs`, `tag.mjs`, `verify-changelog.mjs`, `lib/platform.mjs`, and `lib/types.mjs`. The confluence versions are the most mature. This spec lifts them into `@unic/release-tools`, parameterises them to work from any plugin's cwd, and exposes them as bin commands so plugin `package.json` scripts can call them without relative paths.

## Current behaviour

`packages/release-tools/package.json` is a stub. The source scripts live at:

- `~/Sites/UNIC/unic-claude-code-confluence/scripts/bump-version.mjs`
- `~/Sites/UNIC/unic-claude-code-confluence/scripts/sync-version.mjs`
- `~/Sites/UNIC/unic-claude-code-confluence/scripts/tag.mjs`
- `~/Sites/UNIC/unic-claude-code-confluence/scripts/verify-changelog.mjs`
- `~/Sites/UNIC/unic-claude-code-confluence/scripts/verify-changelog.test.mjs`
- `~/Sites/UNIC/unic-claude-code-confluence/scripts/lib/platform.mjs`
- `~/Sites/UNIC/unic-claude-code-confluence/scripts/lib/types.mjs`

## Target behaviour

`packages/release-tools/` contains:

```
scripts/
  bump-version.mjs
  sync-version.mjs
  tag.mjs
  verify-changelog.mjs
  verify-changelog.test.mjs
  lib/
    platform.mjs
    types.mjs
package.json  ← updated with bin, scripts, devDeps
```

The scripts operate on the **calling package's directory** via `process.cwd()` — no `--package` flag needed. When run with `pnpm --filter pr-review bump patch`, pnpm sets cwd to `apps/claude-code/pr-review/` automatically.

Bin commands exposed:

| Bin | Script |
|---|---|
| `unic-bump` | `scripts/bump-version.mjs` |
| `unic-sync-version` | `scripts/sync-version.mjs` |
| `unic-tag` | `scripts/tag.mjs` |
| `unic-verify-changelog` | `scripts/verify-changelog.mjs` |

## Affected files

| File | Change |
|---|---|
| `packages/release-tools/scripts/bump-version.mjs` | Create (lifted + adapted) |
| `packages/release-tools/scripts/sync-version.mjs` | Create (lifted + adapted) |
| `packages/release-tools/scripts/tag.mjs` | Create (lifted + adapted) |
| `packages/release-tools/scripts/verify-changelog.mjs` | Create (lifted + adapted) |
| `packages/release-tools/scripts/verify-changelog.test.mjs` | Create (lifted + adapted) |
| `packages/release-tools/scripts/lib/platform.mjs` | Create (lifted as-is) |
| `packages/release-tools/scripts/lib/types.mjs` | Create (lifted as-is) |
| `packages/release-tools/package.json` | Modify — add `bin`, `scripts`, `devDependencies` |
| `package.json` (root) | Modify — add `@unic/release-tools: workspace:*` devDep |

## Implementation steps

1. Read each source script from `~/Sites/UNIC/unic-claude-code-confluence/scripts/` to understand its current implementation.

2. Copy `lib/platform.mjs` and `lib/types.mjs` verbatim into `packages/release-tools/scripts/lib/`. Update any import paths that reference sibling scripts.

3. Copy and adapt each main script into `packages/release-tools/scripts/`:
   - Replace any hardcoded relative paths (e.g. `'./lib/platform.mjs'`) with paths relative to the script's new location.
   - Ensure each script resolves the plugin root via `process.cwd()` (not `import.meta.dirname`). The plugin root is wherever the script is run from.
   - `bump-version.mjs`: reads `.claude-plugin/plugin.json` from `process.cwd()`; updates version in `plugin.json`, `marketplace.json`, `package.json` (all relative to cwd); promotes `[Unreleased]` in `CHANGELOG.md`.
   - `sync-version.mjs`: mirrors version from `plugin.json` → `marketplace.json` + `package.json`.
   - `tag.mjs`: reads version from `plugin.json`; creates git tag `<plugin-name>@<version>` (tag scheme: `name@version`, not `vX.Y.Z`). Update this from confluence's `v` prefix.
   - `verify-changelog.mjs`: checks that `CHANGELOG.md` has an `[Unreleased]` section with at least one non-`(none)` bullet; no version bump needed.

4. Copy and adapt `verify-changelog.test.mjs`. Update import paths to point to the script's new location. Ensure tests still pass with `node --test`.

5. Update `packages/release-tools/package.json`:

   ```json
   {
     "name": "@unic/release-tools",
     "version": "0.0.0",
     "private": true,
     "license": "LGPL-3.0-or-later",
     "type": "module",
     "bin": {
       "unic-bump": "./scripts/bump-version.mjs",
       "unic-sync-version": "./scripts/sync-version.mjs",
       "unic-tag": "./scripts/tag.mjs",
       "unic-verify-changelog": "./scripts/verify-changelog.mjs"
     },
     "scripts": {
       "test": "node --test scripts/verify-changelog.test.mjs"
     },
     "devDependencies": {
       "@types/node": "catalog:",
       "typescript": "catalog:"
     }
   }
   ```

6. Add `"@unic/release-tools": "workspace:*"` to `devDependencies` in root `package.json`.

7. Run `pnpm install`.

8. Run `pnpm --filter @unic/release-tools test` to confirm the tests pass.

## Verification

```sh
pnpm install
pnpm --filter @unic/release-tools test    # all tests pass
which unic-bump 2>/dev/null || node_modules/.bin/unic-bump --help  # prints usage or exits cleanly
```

## Acceptance criteria

- [ ] All 4 scripts exist in `packages/release-tools/scripts/`
- [ ] `lib/platform.mjs` and `lib/types.mjs` exist
- [ ] `packages/release-tools/package.json` has `bin` with 4 entries
- [ ] `pnpm --filter @unic/release-tools test` passes
- [ ] `pnpm install` succeeds
- [ ] Each script reads the plugin root from `process.cwd()`
- [ ] `tag.mjs` uses `<name>@<version>` tag scheme (not `v<version>`)

## Out of scope

- Wiring plugin packages to use these commands — happens in specs 05–07
- Adding tests for bump/sync/tag scripts (verify-changelog test is sufficient for now)
- Changing the Biome auto-formatting step in `bump-version.mjs` — keep as-is if it exists
