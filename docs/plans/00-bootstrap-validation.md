# 00. Bootstrap Validation

**Priority:** P0
**Effort:** XS
**Version impact:** none
**Depends on:** —
**Touches:** `CHANGELOG.md`, `docs/plans/README.md`

## Context

The monorepo seed was created by hand. Before any substantive work begins, verify that `pnpm install` resolves the workspace cleanly, Biome and Prettier can run without errors, and tsc accepts the base config. This spec produces the first commit confirming the seed is valid.

## Current behaviour

- `apps/claude-code/` contains only `.gitkeep`
- `packages/biome-config/`, `packages/tsconfig/`, `packages/release-tools/` each contain only `package.json` stubs
- `CHANGELOG.md` exists with a single `- Initial monorepo seed` bullet under `[Unreleased]`
- No git history yet (seed was never committed)

## Target behaviour

- `pnpm install` completes without errors
- `pnpm check` passes (Biome + Prettier — no JS/TS files to lint yet, so Biome is effectively a no-op; Prettier checks all `.md` files)
- `pnpm typecheck` exits cleanly (no `.mjs` files to check yet)
- The seed is committed as `chore(spec-00): validate monorepo seed`

## Affected files

| File | Change |
|---|---|
| `CHANGELOG.md` | Modify — add dated entry under a new `## [YYYY-MM-DD]` section |
| `docs/plans/README.md` | No change required |

## Implementation steps

1. Run `pnpm install`. Confirm it exits 0. If it fails due to a catalog resolution error, inspect `pnpm-workspace.yaml` and fix the offending entry.

2. Run `pnpm check`. Confirm it exits 0. Fix any Prettier formatting issues in the seed `.md` files if it reports them (run `pnpm format` to auto-fix).

3. Run `pnpm typecheck`. Confirm it exits 0 (no packages have `.mjs` files yet, so this is a no-op).

4. In `CHANGELOG.md`, move the `- Initial monorepo seed` bullet from `## [Unreleased]` into a new dated section:

   ```markdown
   ## [2025-XX-XX]

   ### Added

   - Initial monorepo seed: workspace tooling, package stubs, and spec roadmap
   ```

   Replace `2025-XX-XX` with today's date. Leave `## [Unreleased]` above it with `### Added\n\n- (none)`.

5. Stage all files and commit:

   ```sh
   git add -A
   git commit -m "chore(spec-00): validate monorepo seed"
   ```

## Verification

```sh
pnpm install    # exits 0, no errors
pnpm check      # exits 0
pnpm typecheck  # exits 0
git log --oneline -1  # shows the chore(spec-00) commit
```

## Acceptance criteria

- [ ] `pnpm install` succeeds
- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes
- [ ] `CHANGELOG.md` has a dated section for today
- [ ] One commit exists: `chore(spec-00): validate monorepo seed`

## Out of scope

- Installing any npm packages beyond what the seed already declares
- Creating any new source files
- Touching any spec file other than this one
