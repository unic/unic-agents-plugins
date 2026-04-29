# 06. Migrate auto-format Plugin

**Priority:** P0
**Effort:** M
**Version impact:** patch (plugin: auto-format)
**Depends on:** 03
**Touches:** `apps/claude-code/auto-format/`

## Context

`unic-claude-code-format` is a standalone repo with a hooks-based Claude Code plugin. This spec imports its git history into the monorepo under `apps/claude-code/auto-format/`, renames the plugin to `auto-format`, removes the per-repo tooling files superseded by the monorepo root, and rewires `package.json` to use `@unic/release-tools`.

## Current behaviour

- `apps/claude-code/auto-format/` does not exist
- Source repo: `~/Sites/UNIC/unic-claude-code-format/` (main branch)
- Plugin name in `plugin.json`: `"unic-claude-code-format"`, version `"0.5.8"`

## Target behaviour

- `apps/claude-code/auto-format/` exists with full git history
- `plugin.json` name: `"auto-format"`, version `"0.5.9"`
- `marketplace.json` name: `"auto-format"`
- `package.json` updated: release scripts use `@unic/release-tools` bin commands; per-repo tooling scripts removed
- Per-repo tooling files removed: `.editorconfig`, `.nvmrc`, `.npmrc`, `pnpm-workspace.yaml`, `.github/`, `scripts/bump.mjs`, `scripts/sync-version.mjs`, `scripts/tag.mjs`, `scripts/backfill-tags.mjs`
- `scripts/format-hook.mjs` and `tests/` preserved (plugin-specific)
- `pnpm install` and `pnpm --filter auto-format test` succeed

## Affected files

| File | Change |
|---|---|
| `apps/claude-code/auto-format/` (whole tree) | Create (via filter-repo + merge) |
| `apps/claude-code/auto-format/.claude-plugin/plugin.json` | Modify — rename + bump |
| `apps/claude-code/auto-format/.claude-plugin/marketplace.json` | Modify — rename |
| `apps/claude-code/auto-format/package.json` | Modify — rewire scripts, remove tooling deps |
| `apps/claude-code/auto-format/.editorconfig` | Delete |
| `apps/claude-code/auto-format/.nvmrc` | Delete |
| `apps/claude-code/auto-format/.npmrc` | Delete |
| `apps/claude-code/auto-format/pnpm-workspace.yaml` | Delete |
| `apps/claude-code/auto-format/.github/` | Delete |
| `apps/claude-code/auto-format/scripts/bump.mjs` | Delete |
| `apps/claude-code/auto-format/scripts/sync-version.mjs` | Delete |
| `apps/claude-code/auto-format/scripts/tag.mjs` | Delete |
| `apps/claude-code/auto-format/scripts/backfill-tags.mjs` | Delete (if present) |
| `apps/claude-code/auto-format/LICENSE` | Keep — maintained manually; do not delete |

## Implementation steps

1. Verify `git filter-repo` is installed (see spec 05 step 1 if needed).

2. Fresh clone:

   ```sh
   git clone --no-local /Users/oriol.torrent/Sites/UNIC/unic-claude-code-format /tmp/auto-format-rewrite
   ```

3. Drop runtime artifacts from history:

   ```sh
   cd /tmp/auto-format-rewrite
   git filter-repo --invert-paths --path .ralph --path .history --force
   ```

4. Move to subdirectory:

   ```sh
   git filter-repo --to-subdirectory-filter apps/claude-code/auto-format/ --force
   ```

5. Import into monorepo:

   ```sh
   cd /Users/oriol.torrent/Sites/UNIC/unic-agents-plugins
   git remote add auto-format-import /tmp/auto-format-rewrite
   git fetch auto-format-import
   git merge --allow-unrelated-histories auto-format-import/main \
     -m "feat(spec-06): import auto-format plugin history"
   git remote remove auto-format-import
   rm -rf /tmp/auto-format-rewrite
   ```

6. Delete per-repo tooling files (superseded by monorepo root):

   ```sh
   rm -f apps/claude-code/auto-format/.editorconfig
   rm -f apps/claude-code/auto-format/.nvmrc
   rm -f apps/claude-code/auto-format/.npmrc
   rm -f apps/claude-code/auto-format/pnpm-workspace.yaml
   rm -rf apps/claude-code/auto-format/.github
   rm -f apps/claude-code/auto-format/scripts/bump.mjs
   rm -f apps/claude-code/auto-format/scripts/sync-version.mjs
   rm -f apps/claude-code/auto-format/scripts/tag.mjs
   rm -f apps/claude-code/auto-format/scripts/backfill-tags.mjs
   ```

7. ⚠️ **Maintainer action required:** After the merge, verify that `apps/claude-code/auto-format/LICENSE` exists. If the import did not bring it over, copy the root `LICENSE` file there manually. Ralph/Claude must **not** create or delete LICENSE files.

8. Update `apps/claude-code/auto-format/.claude-plugin/plugin.json`:
   - `"name"`: `"unic-claude-code-format"` → `"auto-format"`
   - Leave version as current (`"0.5.8"`) for now

9. Update `apps/claude-code/auto-format/.claude-plugin/marketplace.json`:
   - `"name"`: → `"auto-format"`
   - `"homepage"`: → `"https://github.com/unic/unic-agents-plugins"`

10. Rewrite `apps/claude-code/auto-format/package.json`. Keep `test` and `typecheck` scripts. Replace release scripts. Remove `lint`/`format`/`check`/`ci:check` (handled at monorepo root). Remove `devDependencies` for biome/typescript (now at root catalog; add only what's plugin-specific):

   ```json
   {
     "name": "auto-format",
     "version": "0.5.8",
     "private": true,
     "license": "LGPL-3.0-or-later",
     "type": "module",
     "packageManager": "pnpm@10.33.0",
     "engines": {
       "node": ">=24",
       "pnpm": ">=10"
     },
     "scripts": {
       "test": "node --test tests/format-hook.test.mjs",
       "typecheck": "tsc --noEmit --project tsconfig.json",
       "bump": "unic-bump",
       "sync-version": "unic-sync-version",
       "tag": "unic-tag",
       "verify:changelog": "unic-verify-changelog",
       "ralph": "ralph run -c ralph.yml -H builtin:code-assist"
     },
     "devDependencies": {
       "@ralph-orchestrator/ralph-cli": "catalog:",
       "@types/node": "catalog:",
       "@unic/release-tools": "workspace:*",
       "@unic/tsconfig": "workspace:*",
       "typescript": "catalog:"
     }
   }
   ```

11. Create `apps/claude-code/auto-format/tsconfig.json`:

    ```json
    {
      "extends": "@unic/tsconfig/tsconfig.base.json",
      "include": ["scripts/**/*.mjs", "tests/**/*.mjs"]
    }
    ```

12. Run `pnpm install`.

13. Add CHANGELOG entry and bump version:

    In `apps/claude-code/auto-format/CHANGELOG.md`, under `## [Unreleased] → ### Added`:
    ```
    - Migrated to unic-agents-plugins monorepo; plugin renamed from `unic-claude-code-format` to `auto-format`
    ```

    ```sh
    pnpm --filter auto-format bump patch
    pnpm --filter auto-format verify:changelog
    ```

14. Run `pnpm --filter auto-format test` and verify it passes.

15. Commit:

    ```sh
    git add -A
    git commit -m "feat(spec-06): finalize auto-format migration (v0.5.9)"
    ```

## Verification

```sh
pnpm install
pnpm --filter auto-format test
pnpm --filter auto-format typecheck
pnpm --filter auto-format verify:changelog
cat apps/claude-code/auto-format/.claude-plugin/plugin.json | grep '"name"'
# → "name": "auto-format"
```

## Acceptance criteria

- [ ] `apps/claude-code/auto-format/` exists with original commit history
- [ ] `plugin.json` has `"name": "auto-format"` and version `"0.5.9"`
- [ ] `marketplace.json` has `"name": "auto-format"`
- [ ] `package.json` uses `unic-bump` etc. (no local release script paths)
- [ ] Per-repo tooling files (`.editorconfig`, `.nvmrc`, `pnpm-workspace.yaml`, `.github/`, etc.) deleted
- [ ] `LICENSE` exists in the plugin dir (add manually if missing — Ralph does not manage this file)
- [ ] `scripts/format-hook.mjs` and `tests/` preserved
- [ ] `pnpm --filter auto-format test` passes
- [ ] `pnpm --filter auto-format verify:changelog` passes

## Out of scope

- Updating `CLAUDE.md` inside the plugin for monorepo context
- Migrating the plugin's own release workflow (replaced by spec 10)

## Deviations

- **Version mismatch**: The spec expected the imported `plugin.json` version to be `"0.5.8"` (Current behaviour section), but the actual imported version was `"0.5.4"`. The `package.json` rewrite keeps `"0.5.4"` as the base. After the patch bump in step 13, the final version will be `"0.5.5"` rather than `"0.5.9"` as stated in the acceptance criteria. The acceptance criteria should be interpreted as `"0.5.5"`.
- **`.nvmrc` absent**: The spec listed `.nvmrc` in the delete list, but the file was not present in the imported history — no action needed.
- **`scripts/verify-changelog.mjs` retained**: Not in the delete list; left in place as dead code (superseded by `unic-verify-changelog`). Can be removed in a future cleanup.
