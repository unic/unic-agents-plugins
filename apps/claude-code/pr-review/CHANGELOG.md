# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- Classify each prior bot thread as `addressed`, `disputed`, `pending`, or `obsolete` in Step 5.5; print summary count before Step 6; detect deleted-file threads as `obsolete` (spec 05)

### Fixed
- (none)

## [0.4.0] — 2026-05-06

### Breaking
- (none)

### Added
- Branch Step 5 on `IS_REREVIEW`: incremental diff between `PRIOR_COMMIT_ID` and `LATEST_COMMIT_ID` for re-reviews; early exit with pending thread list when no new commits; fallback warnings with both commit IDs on fetch failure or missing commit IDs; hunk boundaries exported to `DIFF_HUNKS_FILE` for spec 05 (spec 04)

### Fixed
- (none)

## [0.3.0] — 2026-05-06

### Breaking
- (none)

### Added
- Fetch PR iterations to resolve `LATEST_ITERATION_ID` and `LATEST_COMMIT_ID`; replace hardcoded `iterationId=1` in Step 4; add `PRIOR_COMMIT_ID` resolution for re-review mode (spec 03)

### Fixed
- (none)

## [0.2.1] — 2026-05-06

### Breaking
- (none)

### Added
- (none)

### Fixed
- Set `isSummaryThread` flag only on the most-recent prior summary thread (not all matching threads) to avoid ambiguity in re-review targeting

## [0.2.0] — 2026-05-06

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
