# 15. Release Tools Test Coverage
**Status: open**

**Priority:** P1
**Effort:** S
**Version impact:** none
**Depends on:** 03
**Touches:** `packages/release-tools/scripts/`

## Context

`verify-changelog.mjs` already has a test file (`verify-changelog.test.mjs`). The other two scripts with non-trivial logic — `bump-version.mjs` and `sync-version.mjs` — have no tests. This spec adds coverage for both, following the same subprocess-based pattern already established by `verify-changelog.test.mjs`.

`tag.mjs` is excluded: its core logic (read name+version, run sync, call `git tag`) is tested indirectly through integration; the git interaction makes unit testing add little value without a real repo context.

## Current behaviour

- `packages/release-tools/scripts/verify-changelog.test.mjs` exists — 9 test cases
- `packages/release-tools/scripts/bump-version.test.mjs` — does not exist
- `packages/release-tools/scripts/sync-version.test.mjs` — does not exist
- `package.json` test script only references `verify-changelog.test.mjs`

## Target behaviour

- `bump-version.test.mjs` covers: invalid type, dirty tree, missing files, malformed version, no real changelog entries, missing [Unreleased] section, patch/minor/major version arithmetic, CHANGELOG promotion
- `sync-version.test.mjs` covers: version sync to marketplace + package.json, no-op when up to date, error on missing files, malformed version, field mirroring (license, homepage, keywords)
- `package.json` test script runs all three test files

## Affected files

| File | Change |
|---|---|
| `packages/release-tools/scripts/bump-version.test.mjs` | Create |
| `packages/release-tools/scripts/sync-version.test.mjs` | Create |
| `packages/release-tools/package.json` | Modify — extend test script |

## Implementation steps

1. Create `packages/release-tools/scripts/bump-version.test.mjs` with test cases listed in Acceptance criteria. Use the same subprocess-based pattern as `verify-changelog.test.mjs`: create a temp dir via `mkdtempSync`, write fixture files, run the script via `spawnSync` with `cwd: tmpDir` (since `bump-version.mjs` resolves paths from `process.cwd()`). For tests that need a clean or dirty git state, inject cross-platform fake `git` stubs into the temp dir: a POSIX shell script (`git`) for macOS/Linux and a CMD batch file (`git.cmd`) for Windows. Prepend the temp dir to PATH using `path.delimiter` (not a hard-coded `:`), matching the approach in `verify-changelog.test.mjs` but extended to cover Windows. Happy-path bump tests also require a `.claude-plugin/marketplace.json` fixture in the temp dir (consumed by `sync-version.mjs`).

2. Create `packages/release-tools/scripts/sync-version.test.mjs` with test cases listed in Acceptance criteria.

3. Update `packages/release-tools/package.json` test script to include all three test files:
   ```json
   "test": "node --test scripts/verify-changelog.test.mjs scripts/bump-version.test.mjs scripts/sync-version.test.mjs"
   ```

4. Run `pnpm --filter @unic/release-tools test` and verify all tests pass.

5. Commit: `test(release-tools): add bump-version and sync-version tests (spec-15)`

## Verification

```sh
pnpm --filter @unic/release-tools test
# All test cases pass; CI validates macOS, Windows, and Linux
```

## Acceptance criteria

### bump-version.test.mjs
- [ ] `exits 1 with usage message when bump type is invalid`
- [ ] `exits 1 when working tree is dirty`
- [ ] `exits 1 when plugin.json is missing`
- [ ] `exits 1 when version in plugin.json is malformed (e.g. "not-semver")`
- [ ] `exits 1 when CHANGELOG.md is missing`
- [ ] `exits 1 when CHANGELOG.md has no [Unreleased] section`
- [ ] `exits 1 when [Unreleased] has no real entries (only "(none)")`
- [ ] `patch bump: increments patch, resets nothing`
- [ ] `minor bump: increments minor, resets patch to 0`
- [ ] `major bump: increments major, resets minor and patch to 0`
- [ ] `bump promotes [Unreleased] section and leaves a fresh empty [Unreleased] — released section date matches YYYY-MM-DD`

### sync-version.test.mjs
- [ ] `exits 1 when plugin.json is missing`
- [ ] `exits 1 when .version is missing or not a string in plugin.json`
- [ ] `exits 1 when marketplace.json has no plugins[] array`
- [ ] `syncs version from plugin.json to marketplace.json`
- [ ] `syncs version to package.json when it exists`
- [ ] `reports no change when versions already match`
- [ ] `mirrors license, homepage, and keywords fields from plugin.json into marketplace entry`

### package.json
- [ ] test script references all three test files

## Out of scope

- Tests for `tag.mjs` (git-heavy, integration-only)
- Extracting a shared reusable fake-binary helper across test files — each test file can inline its own stubs
