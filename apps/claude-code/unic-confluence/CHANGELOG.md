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

## [3.0.0] — 2026-04-30

### Breaking

- Plugin renamed from `confluence-publish` to `unic-confluence`; update `enabledPlugins` in `settings.json` from `"confluence-publish@unic": true` to `"unic-confluence@unic": true` and reinstall the plugin
- Command file renamed from `confluence-publish.md` to `unic-confluence.md`; the slash command is now `/unic-confluence:unic-confluence`

### Added

- `argument-hint` in command frontmatter for improved command picker display (`<page-key-or-id> <markdown-file>`)
- Added `displayName`, `owner`, `category`, `homepage`, `keywords`, `tags`, and `source` fields to `marketplace.json` to satisfy Anthropic marketplace schema
- Enriched `plugin.json` with `homepage`, `license`, `keywords`, and `author.url`

### Fixed

- (none)

## [2.1.6] — 2026-04-29

### Breaking

- (none)

### Added

- Migrated to unic-agents-plugins monorepo; plugin renamed from `unic-confluence` to `confluence-publish`

### Fixed

- (none)

## [2.1.5] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- Pin `marked` directly in `package.json#dependencies` instead of `catalog:` so the plugin can be installed via git URL by external pnpm/npm projects (was failing with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER  marked@catalog:` because `catalog:` is a pnpm workspace-internal feature that only `pnpm publish` rewrites, and this plugin is consumed via git URL, not the registry)

## [2.1.4] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- biome lint: remove unused `title` parameter from `handleHttpError`

## [2.1.3] — 2026-04-27

### Breaking

- (none)

### Added

- (none)

### Fixed

- biome.json — updated formatter/linter config
- pnpm-workspace.yaml + package.json — pnpm upgrade, ralph-cli build allowlist
- All scripts/\*.mjs — reformatted (quotes, semicolons, trailing commas) — no logic changes
- CONTRIBUTING.md / CHANGELOG.md — docs fixes

## [2.1.2] — 2026-04-27

- Fixed
  - `pnpm bump` now writes tab-indented JSON so `biome ci` no longer rejects `plugin.json` and `marketplace.json`

## [2.1.1] — 2026-04-27

- Fixed
  - CI: drop redundant `version: 10` from `pnpm/action-setup@v4` so `package.json#packageManager` is the single source of truth (CI was failing with "Multiple versions of pnpm specified")

## [2.1.0] — 2026-04-27

- Added
  - Auto-saves a slugified alias into `confluence-pages.json` after publishing by raw numeric page ID; reports the new alias to the user.
  - `--list` flag prints configured aliases as a sorted two-column table.
  - `--no-save` flag opts out of alias auto-saving.

## [2.0.1] — 2026-04-24

- Fixed
  - Updated `PROMPT.md`, `docs/plans/README.md`, and `CLAUDE.md` with `pnpm bump` / `pnpm verify:changelog` workflow and per-spec versioning instructions

## [2.0.0] — 2026-04-24

- Breaking

  - Publish now fails with exit 1 when no injection markers are found (previously appended silently); use `--replace-all` to opt out

- Added

  - `--replace-all` flag to replace entire page content without requiring markers
  - `--dry-run` flag to preview the Confluence publish without making a PUT request
  - Confluence code macro conversion: fenced code blocks are rendered as `ac:structured-macro` code blocks
  - Migrated from npm to pnpm workspace catalog (`pnpm@10`)

- Fixed
  - `--dry-run --replace-all` on pages without markers no longer errors on missing backup path

## [1.0.2] — 2026-04-23

- Fixed
  - Add `package-lock.json` for dependency management
  - Correct plugin metadata in `marketplace.json`
  - Add pnpm commands and correct install instructions to README
  - Add marketplace.json and correct install instructions

## [1.0.0] — 2026-04-22

- Added
  - Initial release: `/unic-confluence` slash command for publishing Markdown to Confluence via v2 API
  - Interactive `--setup` flow for credential configuration (`~/.unic-confluence.json`)
  - `--verify` subcommand to health-check all pages in `confluence-pages.json`
  - Plain-text marker injection strategy (`[AUTO_INSERT_START: label]` / `[AUTO_INSERT_END: label]`)
  - Anchor-macro fallback injection strategy (`md-start` / `md-end` Confluence anchors)
  - Append-to-page fallback when no markers are present
  - YAML frontmatter stripping
  - 5 MB file size guard
  - LGPL-3.0-or-later licence
