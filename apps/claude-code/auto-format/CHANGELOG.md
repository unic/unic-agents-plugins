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

## [0.5.7] — 2026-04-30

### Breaking

- (none)

### Added

- (none)

### Fixed

- Fix biome stub path in tests on Windows: backslashes in temp-dir paths were being mangled as JS escape sequences when embedded in the stub script string literal; now normalised to forward slashes before embedding

## [0.5.6] — 2026-04-30

### Breaking

- (none)

### Added

- (none)

### Fixed

- (none)

### Changed

- Removed `scripts/verify-changelog.mjs` (dead code — superseded by the monorepo `unic-verify-changelog` binary)

## [0.5.5] — 2026-04-29

### Breaking

- (none)

### Added

- Migrated to unic-agents-plugins monorepo; plugin renamed from `unic-claude-code-format` to `auto-format`

### Fixed

- (none)

## [0.5.4] — 2026-04-28

### Breaking

- (none)

### Added

- Add `.github/workflows/release.yml` to auto-tag version bump commits on push to `main` via GitHub Actions.

### Fixed

- (none)

## [0.5.3] — 2026-04-28

### Breaking

- (none)

### Added

- Add `scripts/backfill-tags.mjs` and `pnpm backfill-tags` to tag historical version commits idempotently.

### Fixed

- (none)

## [0.5.2] — 2026-04-28

### Breaking

- (none)

### Added

- (none)

### Fixed

- Add `// @ts-check` and JSDoc type annotations to all `.mjs` scripts and tests; introduce `scripts/lib/types.mjs` with shared typedefs; add `pnpm typecheck` (`tsc --checkJs --strict`) as a dev-only type-safety gate.

## [0.5.1] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Switch JSON output in `bump.mjs` and `sync-version.mjs` from tab to 2-space indentation to match `.editorconfig`; reformat four committed JSON files accordingly.

## [0.5.0] — 2026-04-27

### Breaking

- (none)

### Added

- `additionalSkipPrefixes` config key: merges extra path prefixes with the defaults instead of replacing them, avoiding copy-paste of defaults in consumer repos.

### Fixed

- (none)

## [0.4.0] — 2026-04-27

### Breaking

- (none)

### Added

- Auto-detect Biome as an alternative to Prettier + ESLint: if `biome.json`/`biome.jsonc` and `node_modules/.bin/biome` are present, the hook runs `biome check --write` for JS/TS/JSON extensions; Prettier still runs for `.md`, `.yml`, etc. Override detection with `formatter` key in `.claude/unic-format.json` (`"auto"` | `"prettier"` | `"biome"`).

### Fixed

- (none)

## [0.3.4] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Add smoke tests for notebook_path event and skip-prefix matrix (node_modules/, .git/, .claude/worktrees/)

## [0.3.3] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- add `timeout`/`killSignal: 'SIGTERM'` to both `spawnSync` calls in `runPrettier` and `runEslint`; default 30 s, configurable via `.claude/unic-format.json#formatTimeoutMs` (clamped [1 000, 120 000]), so a hung formatter never stalls the hook

## [0.3.2] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Normalise path separators via `toPosix` before skip-prefix checks so Windows backslash paths are handled correctly in `shouldSkip`

## [0.3.1] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Hoist `PRETTIER_EXTS` and `ESLINT_EXTS` Sets to module scope to avoid per-invocation allocation

## [0.3.0] — 2026-04-27

### Breaking

- (none)

### Added

- Add `pnpm tag` script (`scripts/tag.mjs`) to create a `vX.Y.Z` lightweight git tag from `plugin.json#version`, with idempotent `sync-version` safety step.

### Fixed

- (none)

## [0.2.1] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Refactor `bump.mjs` to use `plugin.json` as single source of truth; add `sync-version.mjs` to propagate version to `marketplace.json` and `package.json`

## [0.2.0] — 2026-04-27

### Breaking

- (none)

### Added

- Add diff-based gate to `verify:changelog`: when guarded paths change, enforces that `plugin.json` version was bumped and CHANGELOG has a real entry for the new version.

### Fixed

- (none)

## [0.1.5] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Add `CLAUDE.md` with project overview, commands, tech stack, conventions, and scope guard.

## [0.1.4] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Add smoke tests for format hook routing logic (`tests/format-hook.test.mjs`).
- Add GitHub Actions CI workflow (`.github/workflows/ci.yml`).

## [0.1.3] — 2026-04-27

### Breaking

- (none)

### Added

- `pnpm verify:changelog` script for CI enforcement of CHANGELOG structure.

### Fixed

- (none)

## [0.1.2] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- bump.mjs: move CHANGELOG validation before version file writes to prevent partial state on empty [Unreleased]

## [0.1.1] — 2026-04-27

### Breaking

- (none)

### Added

- `pnpm bump <patch|minor|major>` script for atomic version bumping across `package.json`, `plugin.json`, `marketplace.json`, and `CHANGELOG.md`.

### Fixed

- (none)

## [0.1.0] — 2026-04-27

### Added

- PostToolUse hook for `Write|Edit|MultiEdit|NotebookEdit` Claude Code events.
- Prettier (`--write --ignore-unknown`) applied to all supported extensions after each edit.
- ESLint (`--fix`) applied to `.js/.mjs/.cjs/.ts/.mts/.cts/.tsx/.json/.jsonc/.md` after each edit.
- Defensive `SKIP_PREFIXES` list (incl. `_bmad/`, BMad skills, generated dirs).
- Path-traversal guard: paths resolving outside consumer project root are skipped.
- Pre-flight binary existence checks: hook is a no-op if Prettier/ESLint is not installed.
- Per-project config: `.claude/unic-format.json` in consumer root overrides `skipPrefixes`, `prettierExtensions`, `eslintExtensions`.
- Plugin manifest: `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
