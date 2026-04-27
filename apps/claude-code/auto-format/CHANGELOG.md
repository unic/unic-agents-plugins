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

## [0.3.1] - 2026-04-27

### Breaking
- (none)

### Added
- (none)

### Fixed
- Hoist `PRETTIER_EXTS` and `ESLINT_EXTS` Sets to module scope to avoid per-invocation allocation

## [0.3.0] - 2026-04-27

### Breaking
- (none)

### Added
- Add `pnpm tag` script (`scripts/tag.mjs`) to create a `vX.Y.Z` lightweight git tag from `plugin.json#version`, with idempotent `sync-version` safety step.

### Fixed
- (none)

## [0.2.1] - 2026-04-27

### Breaking
- (none)

### Added
- (none)

### Fixed
- Refactor `bump.mjs` to use `plugin.json` as single source of truth; add `sync-version.mjs` to propagate version to `marketplace.json` and `package.json`

## [0.2.0] - 2026-04-27

### Breaking
- (none)

### Added
- Add diff-based gate to `verify:changelog`: when guarded paths change, enforces that `plugin.json` version was bumped and CHANGELOG has a real entry for the new version.

### Fixed
- (none)

## [0.1.5] - 2026-04-27

### Breaking
- (none)

### Added
- (none)

### Fixed
- Add `CLAUDE.md` with project overview, commands, tech stack, conventions, and scope guard.

## [0.1.4] - 2026-04-27

### Breaking
- (none)

### Added
- (none)

### Fixed
- Add smoke tests for format hook routing logic (`tests/format-hook.test.mjs`).
- Add GitHub Actions CI workflow (`.github/workflows/ci.yml`).

## [0.1.3] - 2026-04-27

### Breaking
- (none)

### Added
- `pnpm verify:changelog` script for CI enforcement of CHANGELOG structure.

### Fixed
- (none)

## [0.1.2] - 2026-04-27

### Breaking
- (none)

### Added
- (none)

### Fixed
- bump.mjs: move CHANGELOG validation before version file writes to prevent partial state on empty [Unreleased]

## [0.1.1] - 2026-04-27

### Breaking
- (none)

### Added
- `pnpm bump <patch|minor|major>` script for atomic version bumping across `package.json`, `plugin.json`, `marketplace.json`, and `CHANGELOG.md`.

### Fixed
- (none)

## [0.1.0] - 2026-04-27

### Added
- PostToolUse hook for `Write|Edit|MultiEdit|NotebookEdit` Claude Code events.
- Prettier (`--write --ignore-unknown`) applied to all supported extensions after each edit.
- ESLint (`--fix`) applied to `.js/.mjs/.cjs/.ts/.mts/.cts/.tsx/.json/.jsonc/.md` after each edit.
- Defensive `SKIP_PREFIXES` list (incl. `_bmad/`, BMad skills, generated dirs).
- Path-traversal guard: paths resolving outside consumer project root are skipped.
- Pre-flight binary existence checks: hook is a no-op if Prettier/ESLint is not installed.
- Per-project config: `.claude/unic-format.json` in consumer root overrides `skipPrefixes`, `prettierExtensions`, `eslintExtensions`.
- Plugin manifest: `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
