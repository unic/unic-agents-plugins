# 07. Migrate confluence-publish Plugin
**Status: done — 2026-04-29**

**Priority:** P0
**Effort:** M
**Version impact:** patch (plugin: confluence-publish)
**Depends on:** 03
**Touches:** `apps/claude-code/confluence-publish/`

## Context

`unic-claude-code-confluence` is a standalone repo. This spec imports its git history into the monorepo under `apps/claude-code/confluence-publish/`, renames the plugin from `unic-confluence` to `confluence-publish`, removes per-repo tooling files superseded by the monorepo root, and rewires `package.json` to use `@unic/release-tools`. The substantial `scripts/push-to-confluence.mjs` and `scripts/lib/` are preserved as-is.

## Current behaviour

- `apps/claude-code/confluence-publish/` does not exist
- Source repo: `~/Sites/UNIC/unic-claude-code-confluence/` (main branch)
- Plugin name in `plugin.json`: `"unic-confluence"`, version `"2.4.1"`

## Target behaviour

- `apps/claude-code/confluence-publish/` exists with full git history
- `plugin.json` name: `"confluence-publish"`, version `"2.4.2"`
- `marketplace.json` name: `"confluence-publish"`
- `package.json` updated: release scripts use `@unic/release-tools`; per-repo tooling stripped
- Per-repo tooling removed: `.editorconfig`, `.nvmrc`, `.npmrc`, `pnpm-workspace.yaml`, `biome.json`, `.github/`, `.githooks/`, `scripts/bump-version.mjs`, `scripts/sync-version.mjs`, `scripts/tag.mjs`, `scripts/backfill-tags.mjs` (if present), `scripts/verify-changelog.mjs`, `scripts/verify-changelog.test.mjs`
- `scripts/push-to-confluence.mjs`, `scripts/lib/`, and all plugin tests preserved
- `pnpm install` and `pnpm --filter confluence-publish test` succeed

## Affected files

| File | Change |
|---|---|
| `apps/claude-code/confluence-publish/` (whole tree) | Create (via filter-repo + merge) |
| `apps/claude-code/confluence-publish/.claude-plugin/plugin.json` | Modify — rename + bump |
| `apps/claude-code/confluence-publish/.claude-plugin/marketplace.json` | Modify — rename |
| `apps/claude-code/confluence-publish/package.json` | Modify — rewire |
| `apps/claude-code/confluence-publish/.editorconfig` | Delete |
| `apps/claude-code/confluence-publish/.nvmrc` | Delete |
| `apps/claude-code/confluence-publish/.npmrc` | Delete |
| `apps/claude-code/confluence-publish/pnpm-workspace.yaml` | Delete |
| `apps/claude-code/confluence-publish/biome.json` | Delete |
| `apps/claude-code/confluence-publish/.github/` | Delete |
| `apps/claude-code/confluence-publish/.githooks/` | Delete |
| `apps/claude-code/confluence-publish/scripts/bump-version.mjs` | Delete |
| `apps/claude-code/confluence-publish/scripts/sync-version.mjs` | Delete |
| `apps/claude-code/confluence-publish/scripts/tag.mjs` | Delete |
| `apps/claude-code/confluence-publish/scripts/verify-changelog.mjs` | Delete |
| `apps/claude-code/confluence-publish/scripts/verify-changelog.test.mjs` | Delete |
| `apps/claude-code/confluence-publish/LICENSE` | Keep — maintained manually; do not delete |

## Implementation steps

1. Verify `git filter-repo` is installed (see spec 05 step 1 if needed).

2. Fresh clone:

   ```sh
   git clone --no-local /Users/oriol.torrent/Sites/UNIC/unic-claude-code-confluence /tmp/confluence-publish-rewrite
   ```

3. Drop runtime artifacts:

   ```sh
   cd /tmp/confluence-publish-rewrite
   git filter-repo --invert-paths --path .ralph --path .history --force
   ```

4. Move to subdirectory:

   ```sh
   git filter-repo --to-subdirectory-filter apps/claude-code/confluence-publish/ --force
   ```

5. Import into monorepo:

   ```sh
   cd /Users/oriol.torrent/Sites/UNIC/unic-agents-plugins
   git remote add confluence-import /tmp/confluence-publish-rewrite
   git fetch confluence-import
   git merge --allow-unrelated-histories confluence-import/main \
     -m "feat(spec-07): import confluence-publish plugin history"
   git remote remove confluence-import
   rm -rf /tmp/confluence-publish-rewrite
   ```

6. Delete per-repo tooling (superseded by monorepo root):

   ```sh
   rm -f  apps/claude-code/confluence-publish/.editorconfig
   rm -f  apps/claude-code/confluence-publish/.nvmrc
   rm -f  apps/claude-code/confluence-publish/.npmrc
   rm -f  apps/claude-code/confluence-publish/pnpm-workspace.yaml
   rm -f  apps/claude-code/confluence-publish/biome.json
   rm -rf apps/claude-code/confluence-publish/.github
   rm -rf apps/claude-code/confluence-publish/.githooks
   rm -f  apps/claude-code/confluence-publish/scripts/bump-version.mjs
   rm -f  apps/claude-code/confluence-publish/scripts/sync-version.mjs
   rm -f  apps/claude-code/confluence-publish/scripts/tag.mjs
   rm -f  apps/claude-code/confluence-publish/scripts/verify-changelog.mjs
   rm -f  apps/claude-code/confluence-publish/scripts/verify-changelog.test.mjs
   ```

7. ⚠️ **Maintainer action required:** After the merge, verify that `apps/claude-code/confluence-publish/LICENSE` exists. If the import did not bring it over, copy the root `LICENSE` file there manually. Ralph/Claude must **not** create or delete LICENSE files.

8. Update `apps/claude-code/confluence-publish/.claude-plugin/plugin.json`:
   - `"name"`: `"unic-confluence"` → `"confluence-publish"`
   - Leave version as `"2.4.1"` for now

9. Update `apps/claude-code/confluence-publish/.claude-plugin/marketplace.json`:
   - `"name"`: → `"confluence-publish"`
   - `"homepage"`: → `"https://github.com/unic/unic-agents-plugins"`

10. Rewrite `apps/claude-code/confluence-publish/package.json`. Preserve `confluence`, `test`, `typecheck` scripts. Replace release scripts. Remove tooling scripts now at root:

   ```json
   {
     "name": "confluence-publish",
     "version": "2.4.1",
     "private": true,
     "license": "LGPL-3.0-or-later",
     "type": "module",
     "packageManager": "pnpm@10.33.0",
     "engines": {
       "node": ">=24",
       "pnpm": ">=10"
     },
     "scripts": {
       "confluence": "node scripts/push-to-confluence.mjs",
       "test": "node --test scripts/lib/frontmatter.test.mjs scripts/lib/inject.test.mjs scripts/lib/resolve.test.mjs scripts/lib/slug.test.mjs scripts/lib/pages-file.test.mjs scripts/lib/postprocess.test.mjs scripts/lib/sanitise.test.mjs scripts/lib/url.test.mjs",
       "typecheck": "tsc --noEmit --project tsconfig.json",
       "bump": "unic-bump",
       "sync-version": "unic-sync-version",
       "tag": "unic-tag",
       "verify:changelog": "unic-verify-changelog",
       "ralph": "ralph run -c ralph.yml -H builtin:code-assist"
     },
     "dependencies": {
       "marked": "17.0.5"
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

   > Note: the test script removes `verify-changelog.test.mjs` since that's now in release-tools.

11. Create `apps/claude-code/confluence-publish/tsconfig.json`:

    ```json
    {
      "extends": "@unic/tsconfig/tsconfig.base.json",
      "include": ["scripts/**/*.mjs"]
    }
    ```

12. Run `pnpm install`.

13. Update the command file name to match the new plugin name. In `apps/claude-code/confluence-publish/commands/`, rename `unic-confluence.md` → `confluence-publish.md` and update the command title/description inside the file to reference `confluence-publish`.

14. Update `apps/claude-code/confluence-publish/.claude-plugin/plugin.json` `commands` array to reference `./commands/confluence-publish.md`.

15. Add CHANGELOG entry and bump:

    In `apps/claude-code/confluence-publish/CHANGELOG.md`, under `## [Unreleased] → ### Added`:
    ```
    - Migrated to unic-agents-plugins monorepo; plugin renamed from `unic-confluence` to `confluence-publish`
    ```

    ```sh
    pnpm --filter confluence-publish bump patch
    pnpm --filter confluence-publish verify:changelog
    ```

16. Run `pnpm --filter confluence-publish test`.

17. Commit:

    ```sh
    git add -A
    git commit -m "feat(spec-07): finalize confluence-publish migration (v2.4.2)"
    ```

## Verification

```sh
pnpm install
pnpm --filter confluence-publish test
pnpm --filter confluence-publish typecheck
pnpm --filter confluence-publish verify:changelog
cat apps/claude-code/confluence-publish/.claude-plugin/plugin.json | grep '"name"'
# → "name": "confluence-publish"
```

## Acceptance criteria

- [ ] `apps/claude-code/confluence-publish/` exists with original commit history
- [ ] `plugin.json` has `"name": "confluence-publish"` and version `"2.1.6"` (see Deviations)
- [ ] `marketplace.json` has `"name": "confluence-publish"`
- [ ] `package.json` uses `unic-bump` etc.
- [ ] Per-repo tooling files deleted
- [ ] `LICENSE` exists in the plugin dir (add manually if missing — Ralph does not manage this file)
- [ ] `scripts/push-to-confluence.mjs` and `scripts/lib/` preserved
- [ ] `commands/confluence-publish.md` exists (renamed from `unic-confluence.md`)
- [ ] `pnpm --filter confluence-publish test` passes
- [ ] `pnpm --filter confluence-publish verify:changelog` passes

## Out of scope

- Updating `CLAUDE.md` inside the plugin for monorepo context
- Changing any push-to-confluence business logic

## Deviations

- **Version mismatch**: The spec expected the imported `plugin.json` version to be `"2.4.1"` (Current behaviour section), but the actual imported version was `"2.1.5"`. The `package.json` rewrite keeps `"2.1.5"` as the base. After the patch bump in step 15, the final version is `"2.1.6"` rather than `"2.4.2"` as stated in the acceptance criteria. The acceptance criteria should be interpreted as `"2.1.6"`.
- **Test script preserved from import**: The spec's step 10 test script includes `postprocess.test.mjs`, `sanitise.test.mjs`, and `url.test.mjs` which do not exist in the imported history. The existing test script (covering the 5 test files that do exist) was preserved instead.
- **`scripts/verify-changelog.test.mjs` absent**: Listed in step 6 delete list but not present in the imported history — no action needed.
