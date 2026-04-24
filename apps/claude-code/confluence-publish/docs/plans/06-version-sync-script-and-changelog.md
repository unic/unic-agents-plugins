# 06. Version Sync Script and Changelog
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** spec 00 (pnpm migration — `pnpm release` command assumes pnpm is the runner)
**Touches:** `scripts/sync-version.mjs` (new), `package.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md` (new), `README.md`

## Context

Two files carry the plugin version number: `.claude-plugin/plugin.json` (the authoritative source, read by Claude Code at install time) and `.claude-plugin/marketplace.json` (consumed by the marketplace registry, nested at `plugins[0].version`). Commit `ce6e2ad` ("feat: update version numbers and correct plugin metadata") already shows these drifting — someone bumped one file without the other. Because both files are JSON and both live in the same repo, the only reliable fix is automation: make `plugin.json` the single source of truth and provide a script that reads it and writes the derived version into `marketplace.json`. This spec also introduces a `CHANGELOG.md` in Keep-a-Changelog format and documents the release process in `README.md` so that the version bump workflow is self-contained and does not depend on tribal knowledge.

## Current behaviour

**`.claude-plugin/plugin.json`** (relevant excerpt):

```json
{
  "name": "unic-confluence",
  "version": "1.0.2",
  ...
}
```

**`.claude-plugin/marketplace.json`** (relevant excerpt):

```json
{
  "plugins": [
    {
      "name": "unic-confluence",
      "version": "1.0.2",
      ...
    }
  ]
}
```

**`package.json`** `scripts` field: does not exist. The file has no `"scripts"` key at all — there are only `"name"`, `"private"`, `"license"`, `"type"`, and `"dependencies"` fields.

There is no `CHANGELOG.md`. Version history is reconstructed from git log only.

The `README.md` has no "Releasing" section.

There is no automated check to prevent the two version fields from diverging.

## Target behaviour

After this spec lands:

1. `scripts/sync-version.mjs` reads `.claude-plugin/plugin.json`, extracts `.version`, and writes it back into `.claude-plugin/marketplace.json` at `plugins[0].version`. The file is written with 2-space indent and a trailing newline. The script exits 0 on success and 1 with a descriptive message if either file is missing or malformed.
2. `package.json` gains a `"scripts"` block with at minimum `"sync-version"` and `"release"` entries.
3. `CHANGELOG.md` exists at the repo root in Keep-a-Changelog / SemVer format and documents all versions from 1.0.0 through the current 1.0.2.
4. `README.md` gains a short "Releasing" section (3–5 lines) explaining the manual steps.

A developer releasing version 1.1.0 does the following — and nothing else:

```sh
# 1. Bump the version in the single source of truth:
#    edit .claude-plugin/plugin.json  →  "version": "1.1.0"

# 2. Update the changelog:
#    move [Unreleased] items to ## [1.1.0] — YYYY-MM-DD

# 3. Sync and commit:
pnpm release
```

## Implementation steps

### Step 1 — Create `scripts/sync-version.mjs`

Create the file at `scripts/sync-version.mjs` with the following content:

```js
#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Read the single source of truth
const pluginPath = path.join(root, ".claude-plugin/plugin.json");
let pluginJson;
try {
	pluginJson = JSON.parse(readFileSync(pluginPath, "utf8"));
} catch (err) {
	console.error(`sync-version: cannot read ${pluginPath}: ${err.message}`);
	process.exit(1);
}

const version = pluginJson.version;
if (!version || typeof version !== "string") {
	console.error(`sync-version: .version is missing or not a string in ${pluginPath}`);
	process.exit(1);
}

// Write derived version into marketplace.json
const marketplacePath = path.join(root, ".claude-plugin/marketplace.json");
let marketplace;
try {
	marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
} catch (err) {
	console.error(`sync-version: cannot read ${marketplacePath}: ${err.message}`);
	process.exit(1);
}

if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
	console.error(`sync-version: marketplace.json has no plugins[] array`);
	process.exit(1);
}

const prev = marketplace.plugins[0].version;
marketplace.plugins[0].version = version;
writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n", "utf8");

if (prev === version) {
	console.log(`sync-version: marketplace.json already at version ${version} (no change)`);
} else {
	console.log(`sync-version: marketplace.json updated ${prev} → ${version}`);
}
```

Key design decisions:
- Uses `fileURLToPath` + `path.dirname` to locate the repo root relative to the script — works regardless of the cwd when the script is invoked.
- Writes a trailing newline after the JSON to satisfy POSIX text-file conventions and avoid noisy git diffs.
- Logs whether an actual change was made — useful in CI to detect accidental double-runs.
- All error paths exit 1 with a human-readable message.

### Step 2 — Add `scripts` to `package.json`

The current `package.json` has no `"scripts"` field. Add it. The full updated `package.json`:

**Before (full file):**

```json
{
  "name": "unic-confluence",
  "private": true,
  "license": "LGPL-3.0-or-later",
  "type": "module",
  "dependencies": {
    "marked": "17.0.5"
  }
}
```

**After:**

```json
{
  "name": "unic-confluence",
  "private": true,
  "license": "LGPL-3.0-or-later",
  "type": "module",
  "scripts": {
    "confluence": "node scripts/push-to-confluence.mjs",
    "sync-version": "node scripts/sync-version.mjs",
    "release": "node scripts/sync-version.mjs && git add .claude-plugin/marketplace.json CHANGELOG.md && git commit -m \"chore: release v$(node -e \"import('./.claude-plugin/plugin.json',{assert:{type:'json'}}).then(m=>process.stdout.write(m.default.version))\")\""
  },
  "dependencies": {
    "marked": "17.0.5"
  }
}
```

**Note for Ralph on the `release` script**: The inline `node -e` uses dynamic `import()` with a JSON assertion to read the version — this works in Node 18+ ESM context without requiring `createRequire`. However, the `assert:` JSON import assertion syntax was deprecated in Node 22 in favour of `with:`. Test the exact `node -e` invocation against the Node version in use:

```sh
# Node 18-21:
node -e "import('./.claude-plugin/plugin.json', {assert:{type:'json'}}).then(m=>process.stdout.write(m.default.version))"

# Node 22+:
node -e "import('./.claude-plugin/plugin.json', {with:{type:'json'}}).then(m=>process.stdout.write(m.default.version))"
```

If neither works cleanly in a pnpm script context (shell escaping of nested quotes is fragile), use this simpler alternative that avoids import assertions entirely:

```sh
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('.claude-plugin/plugin.json','utf8'));process.stdout.write(p.version)"
```

This uses CommonJS `require` which is available in `node -e` even when `package.json` has `"type":"module"` (the `-e` flag does not use the package type). Confirm which form works before committing.

The `confluence` script entry is added here so that `pnpm confluence -- pageId file.md` works — this is the primary user-facing command and was previously undocumented in `package.json`.

### Step 3 — Create `CHANGELOG.md`

Create `CHANGELOG.md` at the repo root:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)

## [1.0.2] — 2026-04-23

### Fixed
- Add `package-lock.json` for dependency management
- Correct plugin metadata in `marketplace.json`
- Add pnpm commands to README

## [1.0.1] — 2026-04-22

### Fixed
- Correct install instructions in README

## [1.0.0] — 2026-04-22

### Added
- Initial release: `/unic-confluence` slash command for publishing Markdown to Confluence via v2 API
- Interactive `--setup` flow for credential configuration (`~/.unic-confluence.json`)
- `--verify` subcommand to health-check all pages in `confluence-pages.json`
- Plain-text marker injection strategy (`[AUTO_INSERT_START: label]` / `[AUTO_INSERT_END: label]`)
- Anchor-macro fallback injection strategy (`md-start` / `md-end` Confluence anchors)
- Append-to-page fallback when no markers are present
- YAML frontmatter stripping
- 5 MB file size guard
- LGPL-3.0-or-later licence
```

**Note for Ralph**: The `[1.0.1]` entry is inferred from commit `53cddac` ("fix: add marketplace.json and correct install instructions"). If the git log shows no 1.0.1 tag and 1.0.0 went straight to 1.0.2, collapse the two Fixed entries into the `[1.0.2]` section and remove the `[1.0.1]` entry. Check with `git tag -l` before writing the changelog.

### Step 4 — Add "Releasing" section to `README.md`

Open `README.md` and add the following section. Insert it after the existing "Installation" / "Usage" sections, before "Contributing" or "Licence" if those exist, or at the end of the file if they do not.

```markdown
## Releasing

1. Edit `"version"` in `.claude-plugin/plugin.json` — this is the single source of truth.
2. Update `CHANGELOG.md`: move items from `## [Unreleased]` to a new `## [X.Y.Z] — YYYY-MM-DD` section.
3. Run `pnpm release` — this syncs `marketplace.json`, stages both files, and commits with a `chore: release vX.Y.Z` message.
4. Push and create a GitHub release tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
```

## Test cases

### TC-01: Sync with matching versions (no-op)

```sh
# Ensure both files are at the same version, then run:
node scripts/sync-version.mjs
# Expected stdout: "sync-version: marketplace.json already at version 1.0.2 (no change)"
# Expected exit code: 0
# marketplace.json: unchanged
```

### TC-02: Sync after bumping plugin.json

```sh
# Manually set plugin.json version to "1.1.0", leave marketplace.json at "1.0.2"
node scripts/sync-version.mjs
# Expected stdout: "sync-version: marketplace.json updated 1.0.2 → 1.1.0"
# Expected exit code: 0
# marketplace.json plugins[0].version: "1.1.0"
# Restore plugin.json to "1.0.2" after the test.
```

### TC-03: Missing plugin.json

```sh
mv .claude-plugin/plugin.json /tmp/plugin.json.bak
node scripts/sync-version.mjs
# Expected: exits 1, message contains "cannot read" and the file path
mv /tmp/plugin.json.bak .claude-plugin/plugin.json
```

### TC-04: Malformed marketplace.json

```sh
echo '{"plugins":[]}' > /tmp/mktplace_test.json
# Temporarily point the script at a marketplace with empty plugins array
# (modify the script path in a test copy, or test the guard condition by inspection)
# Expected: exits 1, message "marketplace.json has no plugins[] array"
```

### TC-05: Release script produces correct commit message

```sh
pnpm release
# Expected: git log --oneline -1 shows "chore: release v1.0.2" (or current version)
# Expected: staged files include .claude-plugin/marketplace.json and CHANGELOG.md
```

## Acceptance criteria

- `node scripts/sync-version.mjs` exits 0 and writes the correct version to `marketplace.json` when `plugin.json` has a valid version.
- `pnpm sync-version` is equivalent to the above.
- The script exits 1 with a non-empty error message for all error conditions (missing file, malformed JSON, missing `plugins[]`).
- `marketplace.json` always has a trailing newline after the script runs (no git diff noise).
- `CHANGELOG.md` exists and is parseable as Keep-a-Changelog Markdown.
- The `[Unreleased]` section has the three subsections: Breaking, Added, Fixed.
- `README.md` contains a "Releasing" section with `pnpm release` in the instructions.
- The `release` script produces a commit with message `chore: release vX.Y.Z`.

## Verification

```sh
# Sync script runs cleanly:
node scripts/sync-version.mjs

# pnpm script alias works:
pnpm sync-version

# Confirm marketplace.json trailing newline (xxd last 3 bytes should be 0a):
xxd .claude-plugin/marketplace.json | tail -1

# Confirm CHANGELOG.md has [Unreleased] section:
grep '## \[Unreleased\]' CHANGELOG.md

# Confirm README.md has Releasing section:
grep '## Releasing' README.md
```

## Out of scope

- Do not actually bump the version as part of this spec — the current version (1.0.2) stays as-is.
- Do not add Changesets, release-please, or semantic-release automation.
- Do not add a git tag step to the `release` script — the tag is a manual `git tag vX.Y.Z && git push origin vX.Y.Z` documented in the README.
- Do not add CI enforcement (e.g., a GitHub Actions job that fails if the versions are out of sync) — that is a follow-up.
- Do not modify `.claude-plugin/plugin.json` structure or add new fields to it.

## Follow-ups

- **CI version drift check**: Add a GitHub Actions step that runs `node scripts/sync-version.mjs` in `--dry-run` mode (or a simple `diff` check) and fails the build if the versions are out of sync.
- **Git tag automation**: Extend `pnpm release` to also run `git tag v$(version) && git push origin v$(version)` — deferred because tag + push should be an explicit, reviewed action.
- **Version in README badge**: A `[![version](…)](…)` badge sourced from `marketplace.json` or a GitHub release would surface the current version without having to open the JSON files.
