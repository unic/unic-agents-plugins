# 15. Release Tools Test Coverage
**Status: in progress**

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

- `bump-version.test.mjs` covers: invalid type, dirty tree, missing files, no real changelog entries, patch/minor/major version arithmetic, CHANGELOG promotion
- `sync-version.test.mjs` covers: version sync to marketplace + package.json, no-op when up to date, error on missing files, field mirroring (license, homepage, keywords)
- `package.json` test script runs all three test files

## Affected files

| File | Change |
|---|---|
| `packages/release-tools/scripts/bump-version.test.mjs` | Create |
| `packages/release-tools/scripts/sync-version.test.mjs` | Create |
| `packages/release-tools/package.json` | Modify — extend test script |

## Implementation steps

1. Create `packages/release-tools/scripts/bump-version.test.mjs` with test cases listed in Acceptance criteria.

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
# All test cases pass on macOS
```

## Acceptance criteria

### bump-version.test.mjs
- [ ] `exits 1 with usage message when bump type is invalid`
- [ ] `exits 1 when working tree is dirty`
- [ ] `exits 1 when plugin.json is missing`
- [ ] `exits 1 when CHANGELOG.md is missing`
- [ ] `exits 1 when [Unreleased] has no real entries (only "(none)")`
- [ ] `patch bump: increments patch, resets nothing`
- [ ] `minor bump: increments minor, resets patch to 0`
- [ ] `major bump: increments major, resets minor and patch to 0`
- [ ] `bump promotes [Unreleased] section with today's date and leaves a fresh empty [Unreleased]`

### sync-version.test.mjs
- [ ] `exits 1 when plugin.json is missing`
- [ ] `exits 1 when marketplace.json has no plugins[] array`
- [ ] `syncs version from plugin.json to marketplace.json`
- [ ] `syncs version to package.json when it exists`
- [ ] `reports no change when versions already match`
- [ ] `mirrors license and homepage fields from plugin.json into marketplace entry`

### package.json
- [ ] test script references all three test files

## Out of scope

- Tests for `tag.mjs` (git-heavy, integration-only)
- Cross-platform fake-binary compatibility beyond what the existing pattern covers
