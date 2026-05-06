# Changelog

## [Unreleased]

### Breaking

- (none)

### Added

- Added Step 3.5 (Detect prior review): paginated fetch of all PR threads, bot-comment detection via signature prefix, and export of `IS_REREVIEW`, `PRIOR_THREADS_FILE`, `SUMMARY_THREAD_ID`, and `PRIOR_ITERATION_ID` for use by later re-review steps

### Fixed

- (none)

## [0.1.3] — 2026-05-06

### Breaking

- (none)

### Added

- (none)

### Fixed

- Normalized all emitted comment signatures to asterisk italics and added `— Iteration {LATEST_ITERATION_ID}` suffix; documented detection prefix in Notes and Comment signature sections

## [0.1.2] — 2026-04-30

### Breaking

- (none)

### Added

- Added `displayName`, `homepage`, `tags`, and `keywords` to `marketplace.json`; enriched `plugin.json` with `author.url` and `homepage` to satisfy Anthropic marketplace schema
- Updated README install instructions to use the monorepo marketplace URL and `pr-review@unic` identifier; replaced git-URL-based install option with marketplace CLI approach

### Fixed

- Removed duplicate `🟡 Minor / Suggestions` and `✅ What's good` template blocks from the summary comment template in `review-pr.md`

## [0.1.1] — 2026-04-29

### Added

- Migrated to unic-agents-plugins monorepo; plugin renamed from `unic-pr-review` to `pr-review`

## [0.1.0] — 2026-04-27

_History migrated from [unic/unic-pr-review](https://github.com/unic/unic-pr-review)._
