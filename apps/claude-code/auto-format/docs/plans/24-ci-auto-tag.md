# 24. CI auto-tag on version bump

**Status: done — 2026-04-28**

**Priority:** P2
**Effort:** S
**Version impact:** patch
**Depends on:** spec-10, spec-14
**Touches:** `.github/workflows/release.yml` (new), `docs/plans/README.md`

## Context

Spec 14 landed `pnpm tag`, but tagging is currently a manual step requiring the
developer to run `pnpm tag && git push --follow-tags` after every bump commit.
It's easy to forget, leaving the repo with an untagged release until someone
notices.

A dedicated `release.yml` GitHub Actions workflow fires on every push to `main`,
checks whether `.claude-plugin/plugin.json#version` changed relative to the
previous commit, and if so creates and pushes the `v{version}` tag automatically.
Because GitHub prevents workflow-triggered pushes from re-triggering the same
workflow, there is no loop risk.

The workflow is kept separate from `ci.yml` (spec-10) to preserve the
single-responsibility principle: `ci.yml` validates, `release.yml` publishes.

## Current behaviour

After spec-10: `ci.yml` runs tests and changelog verification on every push/PR.
No automated tagging exists.

## Target behaviour

- `.github/workflows/release.yml` exists.
- Triggers on `push` to `main` only.
- Has `permissions: contents: write` (required to push tags via `GITHUB_TOKEN`).
- Detects a version bump by comparing `plugin.json#version` at HEAD vs HEAD~1.
- If bumped:
  1. Configures git identity as `github-actions[bot]`.
  2. Runs `git tag v${VERSION} ${GITHUB_SHA}` to create the lightweight tag.
  3. Runs `git push origin refs/tags/v${VERSION}` to publish the tag.
  4. Logs: `Tagged and pushed v{version}`.
- If **not** bumped: logs `No version bump detected — skipping tag` and exits 0.
- If the tag already exists (re-run on the same commit): `git tag` exits 1 →
  workflow step exits 1 → job fails visibly so the operator knows something is off.

## Implementation steps

### Step 1 — Create `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    branches:
      - main

permissions:
  contents: write

jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # HEAD and HEAD~1 needed for version comparison

      - name: Read Node version
        id: node-ver
        run: |
          VERSION=$(grep '^useNodeVersion:' pnpm-workspace.yaml | awk '{print $2}')
          if [ -z "$VERSION" ]; then
            echo "::error::useNodeVersion not found in pnpm-workspace.yaml" >&2
            exit 1
          fi
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

      - uses: pnpm/action-setup@v4
        # reads packageManager from package.json — do not add version: here

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ steps.node-ver.outputs.version }}
          cache: "pnpm"

      - name: Detect version bump
        id: bump
        run: |
          CURRENT=$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync('.claude-plugin/plugin.json','utf8')).version)")
          PREVIOUS=$(git show HEAD~1:.claude-plugin/plugin.json 2>/dev/null \
            | node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync('/dev/stdin','utf8')).version)" \
            2>/dev/null || echo "")
          if [ "$CURRENT" != "$PREVIOUS" ] && [ -n "$CURRENT" ]; then
            echo "bumped=true"  >> "$GITHUB_OUTPUT"
            echo "version=$CURRENT" >> "$GITHUB_OUTPUT"
          else
            echo "bumped=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Skip (no bump)
        if: steps.bump.outputs.bumped == 'false'
        run: echo "No version bump detected — skipping tag"

      - name: Install dependencies
        if: steps.bump.outputs.bumped == 'true'
        run: pnpm install --frozen-lockfile

      - name: Create and push tag
        if: steps.bump.outputs.bumped == 'true'
        env:
          VERSION: ${{ steps.bump.outputs.version }}
        run: |
          set -euo pipefail
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag "v${VERSION}" "${GITHUB_SHA}"
          git push origin "refs/tags/v${VERSION}"
          echo "Tagged and pushed v${VERSION}"
```

### Step 2 — Update `docs/plans/README.md` execution table

Add row:

```
| 24 | [CI auto-tag on version bump](./24-ci-auto-tag.md) | P2 | S | todo |
```

Add dependency note to cross-cutting dependencies:

> **`24` → `10` + `14`**: release.yml extends the CI setup from spec `10` and uses
> the same tag convention as `tag.mjs` from spec `14`.

### Step 3 — Commit

```sh
git add .github/workflows/release.yml docs/plans/README.md
git commit -m "ci(spec-24): add release workflow to auto-tag version bump commits on main"
```

## Test cases

| Scenario | Expected |
|---|---|
| Push to `main` with version bump in `plugin.json` | `git tag v${VERSION}` runs; tag pushed; step logs `Tagged and pushed v${VERSION}` |
| Push to `main` without version bump | `bumped=false`; step logs `No version bump detected`; job exits 0 |
| Push to a non-`main` branch | Workflow does not trigger |
| Tag already exists for current version | `git tag` exits 1; job fails visibly |
| `plugin.json` absent in HEAD~1 (first ever commit on main) | `PREVIOUS` falls back to `""`; treated as a bump; tag created |

## Acceptance criteria

- `.github/workflows/release.yml` is valid YAML.
- Workflow triggers only on `push` to `main`.
- `permissions.contents` is `write`.
- `actions/checkout` uses `fetch-depth: 2`.
- `pnpm/action-setup` has no `version:` input.
- Version comparison uses `HEAD~1` diff, not commit message matching.
- Tag is pushed via `git push origin refs/tags/vX.Y.Z` (not `--follow-tags`, which only pushes annotated tags).
- Non-bump pushes exit 0 without creating a tag.

## Verification

```sh
# 1. Valid YAML
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "OK"

# 2. Confirm fetch-depth: 2 is present
grep "fetch-depth" .github/workflows/release.yml
# expect: fetch-depth: 2

# 3. Confirm no version: in pnpm/action-setup block
grep -A5 "pnpm/action-setup" .github/workflows/release.yml | grep "version:" \
  && echo "FAIL: version: present" || echo "OK: no version:"

# 4. Integration test: bump patch, commit, push to main, observe Actions run
pnpm bump patch
git add -A && git commit -m "chore: bump for release workflow test"
git push
# expect: release.yml job creates and pushes vX.Y.Z tag
```

## Out of scope

- Release notes or GitHub Releases creation (plugin is distributed via git URL,
  not the Releases page).
- Annotated tags.
- Matrix of branches (only `main` is the release branch).
- Rollback on failed tag push.

_Ralph: append findings here._
