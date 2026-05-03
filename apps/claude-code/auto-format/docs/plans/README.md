# Plugin Roadmap

This directory contains one Ralph-ready implementation spec per feature. Each file is a self-contained brief: context, affected files, step-by-step implementation, test cases, and acceptance criteria.

## How to use (for Ralph)

1. Pick the next unstarted spec in numerical order.
2. Read the spec top to bottom **before** touching any code.
3. If the "Current behaviour" section doesn't match what you find in the file, STOP and add a `## Deviations` section to the spec file documenting the discrepancy. Do NOT silently adapt.
4. After landing the change, add `**Status: done — <YYYY-MM-DD>**` at the top of the spec.
5. Read the spec's `**Version impact:** patch|minor|major` line and execute `PROMPT.md` Step 4.5 before committing.

## Ground rules

- **Package manager**: `pnpm` (workspace mode, after spec `00` lands). Before `00`: use `npm` only if unavoidable.
- **pnpm version pinning**: `package.json#packageManager` (e.g. `pnpm@10.33.0`) is the single source of truth.
- **Indentation**: tabs. Line endings: LF.
- **Commits**: conventional commits — `feat(scope): description`, `fix(scope): description`, `chore(scope): description`.
- **Dep versioning**: `devDependencies` go through the `catalog:` section in `pnpm-workspace.yaml`, pinned exactly. No `^` or `~` ranges.
- **No runtime deps**: the hook script uses only Node built-ins (`node:child_process`, `node:fs`, `node:path`). Keep it that way — no external npm deps in `dependencies`.
- **Node version**: Node ≥24.15.0 (Active LTS). `useNodeVersion` in `pnpm-workspace.yaml` pins the patch.
- **Plugin versioning**: `.claude-plugin/plugin.json` is the single source of truth for the version number. **Never hand-edit** `.claude-plugin/marketplace.json` — use `pnpm bump` (spec `07`). After spec `13`, `sync-version.mjs` propagates to `marketplace.json` and `package.json` automatically.
- **Release workflow** (after spec `14`): `pnpm bump <type>` → commit → `pnpm tag` → `git push --follow-tags`.
- **Scope guard**: this plugin formats and lints. Do NOT add MCP servers, skills, agents, or any other Claude Code plugin features unless a spec explicitly calls for it.

## Versioning policy

**SemVer, strictly.**

| Change type | Bump |
|---|---|
| Breaking change to hook contract, plugin manifest, or on-disk config schema | MAJOR |
| New feature: new config option, new extension support, new hook matcher | MINOR |
| Bug fix, refactor, docs, internal tooling | PATCH |

## Execution order

| # | Spec | Priority | Effort | Status |
|---|---|---|---|---|
| 00 | [Bootstrap plugin tooling](./00-bootstrap-plugin-tooling.md) | P0 | S | done |
| 01 | [Plugin manifest](./01-plugin-manifest.md) | P0 | S | done |
| 02 | [Hook registration](./02-hook-registration.md) | P0 | S | done |
| 03 | [Format hook script](./03-format-hook-script.md) | P0 | M | done |
| 04 | [Per-project config support](./04-per-project-config.md) | P1 | S | done |
| 05 | [Plugin README](./05-readme.md) | P1 | S | done |
| 06 | [CHANGELOG and versioning docs](./06-changelog-and-versioning.md) | P1 | S | done |
| 07 | [pnpm bump tooling](./07-pnpm-bump-tooling.md) | P1 | M | done |
| 08 | [pnpm verify:changelog](./08-pnpm-verify-changelog.md) | P1 | S | done |
| 09 | [Smoke tests](./09-smoke-tests.md) | P1 | M | done |
| 10 | [CI workflow](./10-ci-workflow.md) | P1 | S | done |
| 11 | [CLAUDE.md](./11-claude-md.md) | P2 | S | done |
| 12 | [Diff-based verify:changelog](./12-diff-based-verify-changelog.md) | P1 | S | done |
| 13 | [Version source of truth + sync-version](./13-version-source-of-truth-and-sync.md) | P1 | M | done |
| 14 | [pnpm tag](./14-pnpm-tag.md) | P2 | S | done |
| 15 | [Hoist extension Sets out of main()](./15-hoist-extension-sets.md) | P1 | S | done |
| 16 | [Windows path-separator normalisation](./16-windows-path-normalisation.md) | P0 | S | done |
| 17 | [spawnSync timeout guard](./17-spawnsync-timeout-guard.md) | P1 | S | done |
| 18 | [notebook_path + skip-prefix test matrix](./18-notebook-and-skip-prefix-tests.md) | P1 | S | done |
| 19 | [Optional Biome support](./19-biome-support.md) | P1 | M | done |
| 20 | [additionalSkipPrefixes config key](./20-additional-skip-prefixes.md) | P2 | S | done |
| 21 | [JSON 2-space indentation](./21-json-indentation.md) | P1 | S | done |
| 22 | [JSDoc types and --checkJs type-checking](./22-jsdoc-types-ts-check.md) | P2 | M | done |
| 23 | [Backfill historical git tags](./23-backfill-tags.md) | P2 | S | done |
| 24 | [CI auto-tag on version bump](./24-ci-auto-tag.md) | P2 | S | done |
| 25 | [Add FormatterDescriptor typedef](./25-formatter-descriptor-type.md) | P2 | XS | todo |
| 26 | [Extract lib/runners.mjs with runFormatter](./26-runner-module.md) | P2 | S | todo |
| 27 | [Replace runner functions with descriptors](./27-replace-runner-functions.md) | P2 | S | todo |
| 28 | [Version bump — runner extraction refactor](./28-version-bump.md) | P2 | XS | todo |
| 29 | [Extract lib/config.mjs with DEFAULTS and loadConfig](./29-config-module.md) | P2 | S | todo |
| 30 | [Update format-hook.mjs to use lib/config.mjs](./30-wire-up-config-module.md) | P2 | XS | todo |
| 31 | [Version bump — config extraction refactor](./31-version-bump.md) | P2 | XS | todo |

## Cross-cutting dependencies

- **`01` → `00`**: Manifest needs `package.json` with `name` and `version` already set.
- **`02` → `01`**: Hook registration references the plugin manifest structure.
- **`03` → `02`**: The hook script is the implementation of what `02` registers.
- **`04` → `03`**: Per-project config is a feature of the hook script; must be layered on top of spec `03`.
- **`05` → `03` + `04`**: README documents the hook behaviour and config format — land those first.
- **`06` → `01`**: CHANGELOG documents plugin version history; needs the versioning source of truth from `01`.
- **`07` → `06`**: `pnpm bump` automates what spec `06` sets up manually.
- **`08` → `07`**: `pnpm verify:changelog` references `pnpm bump` in its error messages.
- **`09` → `03` + `04`**: Smoke tests cover core hook logic from specs `03` and `04`.
- **`10` → `09`**: CI runs tests; land tests first.
- **`11`**: Can land at any time; no code dependencies.
- **`12` → `08` + `10`**: Diff-based gate extends the verify:changelog script from spec `08`; CI from spec `10` must exist to test it end-to-end.
- **`13` → `07`**: sync-version.mjs is called by the refactored bump.mjs.
- **`14` → `13`**: tag.mjs calls sync-version.mjs as a safety step.
- **`15` → `04`**: Hoisting Sets requires `CONFIG` (from spec `04`) to be module-level.
- **`16` → `03`**: Adds `toPosix` helper to `format-hook.mjs`; does not conflict with `15`.
- **`17` → `03`**: Adds timeout to `runPrettier` / `runEslint` in `format-hook.mjs`.
- **`18` → `09`**: Extends `tests/format-hook.test.mjs`; land the original test file first.
- **`19` → `03` + `04` + `09` + `17`**: Biome support adds a new runner to `format-hook.mjs` using the same timeout pattern; tests build on spec `09`'s helpers.
- **`20` → `04` + `09`**: Additive-merge logic is in `loadProjectConfig` (spec `04`); tests build on spec `09`.
- **`21` → `07` + `13`**: Changes indentation in both `bump.mjs` (spec `07`) and `sync-version.mjs` (spec `13`), and reformats their output files.
- **`22` → `19`**: Biome support (spec `19`) should be committed before JSDoc annotations to keep formatting diffs and type-annotation diffs in separate commits.
- **`23` → `14`**: backfill-tags.mjs relies on the same `vX.Y.Z` tag convention as tag.mjs.
- **`24` → `10` + `14`**: release.yml extends the CI setup from spec `10` and uses the same tag convention as tag.mjs from spec `14`.
- **`25` → `22`**: `FormatterDescriptor` typedef lives in `lib/types.mjs`, which spec `22` creates.
- **`26` → `25`**: `runners.mjs` imports `FormatterDescriptor` via JSDoc `@import` from `types.mjs`.
- **`27` → `26`**: replaces the three runner functions in `format-hook.mjs` with descriptors + `runFormatter`.
- **`28` → `27`**: version bump after all three refactor specs land.
- **`29` → `22`**: `lib/config.mjs` uses `ProjectConfig` and `FormatterName` from `lib/types.mjs` (spec `22`).
- **`30` → `29`**: wires `format-hook.mjs` to the new config module.
- **`31` → `30`**: version bump after config extraction specs land.
