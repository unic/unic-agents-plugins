# 05. Migrate pr-review Plugin
**Status: done — 2026-04-29**

**Priority:** P0
**Effort:** M
**Version impact:** patch (plugin: pr-review)
**Depends on:** 03
**Touches:** `apps/claude-code/pr-review/`

## Context

`unic-pr-review` is a standalone repo. This spec imports its git history into the monorepo under `apps/claude-code/pr-review/`, renames the plugin from `unic-pr-review` to `pr-review`, and adds the workspace integration files (`package.json`, `CHANGELOG.md`) that did not exist in the original repo.

## Current behaviour

- `apps/claude-code/pr-review/` does not exist
- Source repo: `~/Sites/UNIC/unic-pr-review/` (main branch)
- Plugin name in `plugin.json`: `"unic-pr-review"`, version `"0.1.0"`

## Target behaviour

- `apps/claude-code/pr-review/` exists with full git history
- `plugin.json` name: `"pr-review"`, version `"0.1.1"`
- `marketplace.json` name: `"pr-review"`
- New `package.json` wires into workspace and release-tools
- New `CHANGELOG.md` with initial `[Unreleased]` and a `[0.1.1]` section
- `LICENSE` is present in the plugin dir (maintainer adds it manually — Ralph must not touch it)
- `pnpm install` succeeds with the new workspace member

## Affected files

| File | Change |
|---|---|
| `apps/claude-code/pr-review/` (whole tree) | Create (via filter-repo + merge) |
| `apps/claude-code/pr-review/.claude-plugin/plugin.json` | Modify — rename + bump |
| `apps/claude-code/pr-review/.claude-plugin/marketplace.json` | Modify — rename |
| `apps/claude-code/pr-review/package.json` | Create |
| `apps/claude-code/pr-review/CHANGELOG.md` | Create |
| `apps/claude-code/pr-review/LICENSE` | Keep — maintained manually; do not delete |

## Implementation steps

1. Verify `git filter-repo` is installed:

   ```sh
   git filter-repo --version
   ```

   If not found: `brew install git-filter-repo` (macOS) or `pip install git-filter-repo` (cross-platform).

2. Create a fresh clone of the source repo (leave the original untouched):

   ```sh
   git clone --no-local /Users/oriol.torrent/Sites/UNIC/unic-pr-review /tmp/pr-review-rewrite
   ```

3. Drop runtime artifacts from history (no-op if they were never committed):

   ```sh
   cd /tmp/pr-review-rewrite
   git filter-repo --invert-paths --path .ralph --path .history --force
   ```

4. Move the whole tree into the monorepo subdirectory:

   ```sh
   git filter-repo --to-subdirectory-filter apps/claude-code/pr-review/ --force
   ```

5. Back in the monorepo root, import the rewritten history:

   ```sh
   cd /Users/oriol.torrent/Sites/UNIC/unic-agents-plugins
   git remote add pr-review-import /tmp/pr-review-rewrite
   git fetch pr-review-import
   git merge --allow-unrelated-histories pr-review-import/main \
     -m "feat(spec-05): import pr-review plugin history"
   git remote remove pr-review-import
   ```

6. Clean up the temp clone:

   ```sh
   rm -rf /tmp/pr-review-rewrite
   ```

7. Update `apps/claude-code/pr-review/.claude-plugin/plugin.json`:
   - Change `"name"` from `"unic-pr-review"` to `"pr-review"`
   - Leave version as `"0.1.0"` for now — the bump step below will advance it

8. Update `apps/claude-code/pr-review/.claude-plugin/marketplace.json`:
   - Change `"name"` to `"pr-review"`
   - Update `"homepage"` to `"https://github.com/unic/unic-agents-plugins"` (placeholder until repo is public)

9. ⚠️ **Maintainer action required:** After the merge, verify that `apps/claude-code/pr-review/LICENSE` exists. If the import did not bring it over, copy the root `LICENSE` file there manually. Ralph/Claude must **not** create or delete LICENSE files.

10. Create `apps/claude-code/pr-review/CHANGELOG.md`:

    ```markdown
    # Changelog

    ## [Unreleased]

    ### Added

    - (none)

    ## [0.1.0] — (see archived repo)

    _History migrated from [unic/unic-pr-review](https://github.com/unic/unic-pr-review)._
    ```

11. Create `apps/claude-code/pr-review/package.json`:

    ```json
    {
      "name": "pr-review",
      "version": "0.1.0",
      "private": true,
      "license": "LGPL-3.0-or-later",
      "type": "module",
      "packageManager": "pnpm@10.33.0",
      "engines": {
        "node": ">=24",
        "pnpm": ">=10"
      },
      "scripts": {
        "bump": "unic-bump",
        "sync-version": "unic-sync-version",
        "tag": "unic-tag",
        "verify:changelog": "unic-verify-changelog",
        "ralph": "ralph run -c ralph.yml -H builtin:code-assist"
      },
      "devDependencies": {
        "@ralph-orchestrator/ralph-cli": "catalog:",
        "@unic/release-tools": "workspace:*"
      }
    }
    ```

12. Run `pnpm install` to register the new workspace member.

13. Add a CHANGELOG entry for the rename and run the version bump:

    In `apps/claude-code/pr-review/CHANGELOG.md`, under `## [Unreleased] → ### Added`:
    ```
    - Migrated to unic-agents-plugins monorepo; plugin renamed from `unic-pr-review` to `pr-review`
    ```

    Then:
    ```sh
    pnpm --filter pr-review bump patch
    pnpm --filter pr-review verify:changelog
    ```

14. Stage remaining changes and commit:

    ```sh
    git add -A
    git commit -m "feat(spec-05): finalize pr-review migration (v0.1.1)"
    ```

## Verification

```sh
pnpm install                             # exits 0
pnpm --filter pr-review verify:changelog # exits 0
cat apps/claude-code/pr-review/.claude-plugin/plugin.json | grep '"name"'
# → "name": "pr-review"
git log --oneline apps/claude-code/pr-review/ | tail -5
# shows commits from original unic-pr-review repo
```

## Acceptance criteria

- [ ] `apps/claude-code/pr-review/` exists
- [ ] `plugin.json` has `"name": "pr-review"` and version `"0.1.1"`
- [ ] `marketplace.json` has `"name": "pr-review"`
- [ ] `package.json` exists with `bump`, `sync-version`, `tag`, `verify:changelog` scripts
- [ ] `CHANGELOG.md` exists with a `[0.1.1]` dated section
- [ ] `LICENSE` exists in the plugin dir (add manually if missing — Ralph does not manage this file)
- [ ] `git log apps/claude-code/pr-review/` shows the original repo's commit history
- [ ] `pnpm install` succeeds
- [ ] `pnpm --filter pr-review verify:changelog` passes

## Out of scope

- Updating `apps/claude-code/pr-review/CLAUDE.md` for monorepo context — can be done in a future plugin spec
- Adding tests (pr-review has no test suite currently)
- Migrating the plugin's own `docs/plans/` specs — they migrate as part of the history
