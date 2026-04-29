# 10. Release Workflow
**Status: done — 2026-04-29**

**Priority:** P0
**Effort:** M
**Version impact:** none
**Depends on:** 09
**Touches:** `.github/workflows/release.yml`

## Context

The old `unic-claude-code-format` repo had a `release.yml` that auto-created a git tag whenever it detected a version bump in `plugin.json` on push to `main`. This spec brings that pattern to the monorepo, extended to detect which plugin's `plugin.json` changed and to emit `<name>@<version>` tags.

## Current behaviour

`.github/workflows/release.yml` does not exist.

## Target behaviour

On every push to `main`, the workflow checks if any plugin's `.claude-plugin/plugin.json` version differs from the previous commit. For each one that does, it creates and pushes a git tag `<plugin-name>@<version>` (e.g. `auto-format@0.5.9`). Supports optional GPG signing via the `UNIC_SIGN_TAGS` repository secret.

## Affected files

| File | Change |
|---|---|
| `.github/workflows/release.yml` | Create |

## Implementation steps

1. Read `~/Sites/UNIC/unic-claude-code-format/.github/workflows/release.yml` to understand the current version-diff detection logic. Adapt it for three plugins.

2. Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  tag:
    name: Tag released plugins
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # need HEAD and HEAD~1 to diff

      - name: Detect version changes and tag
        env:
          SIGN_TAGS: ${{ secrets.UNIC_SIGN_TAGS }}
        run: |
          tag_if_changed() {
            local plugin_dir="$1"
            local json_path="$plugin_dir/.claude-plugin/plugin.json"

            if [ ! -f "$json_path" ]; then return; fi

            current=$(node -p "JSON.parse(require('fs').readFileSync('$json_path','utf8')).version")
            previous=$(git show HEAD~1:"$json_path" 2>/dev/null \
              | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).version" \
              || echo "")

            if [ "$current" = "$previous" ]; then return; fi

            name=$(node -p "JSON.parse(require('fs').readFileSync('$json_path','utf8')).name")
            tag="${name}@${current}"

            echo "Tagging $tag"
            if [ "$SIGN_TAGS" = "true" ]; then
              git tag -s "$tag" -m "Release $tag"
            else
              git tag "$tag"
            fi
            git push origin "$tag"
          }

          tag_if_changed "apps/claude-code/pr-review"
          tag_if_changed "apps/claude-code/auto-format"
          tag_if_changed "apps/claude-code/confluence-publish"
```

   > Note: uses Node.js (already available) to parse JSON instead of `jq` to stay cross-platform in principle, though this job only runs on ubuntu-latest.

## Verification

Full verification requires a GitHub remote (spec 11). Locally, confirm the workflow file is valid YAML and that the Node.js JSON parsing commands work:

```sh
node -p "JSON.parse(require('fs').readFileSync('apps/claude-code/auto-format/.claude-plugin/plugin.json','utf8')).version"
# prints current version of auto-format
```

## Acceptance criteria

- [ ] `.github/workflows/release.yml` exists and is valid YAML
- [ ] Workflow triggers only on push to `main`
- [ ] Tags use `<name>@<version>` scheme
- [ ] Supports `UNIC_SIGN_TAGS` secret for GPG signing
- [ ] All three plugins are checked

## Out of scope

- Testing the actual tag creation (requires GitHub remote — spec 11)
- Adding new plugins to the tag list (handled when new plugins are added)
