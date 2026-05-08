# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)

## [0.9.1] — 2026-05-08

### Breaking
- (none)

### Added
- (none)

### Fixed
- Doc Context phase was silently skipped on every run: three defects combined — step 4a
  lacked an explicit `Agent()` spawn (orchestrator intent was satisfied inline and skipped),
  `confluence-client.mjs` was resolved relative to the reviewed project root instead of the
  plugin directory, and `DOC_CONTEXT` was never initialised so failures were invisible.
  Fixed by extracting the entire gathering phase to a dedicated Doc Context Orchestrator
  agent (isolates token consumption in a fresh context window), resolving all script paths
  from `${CLAUDE_PLUGIN_ROOT}`, and initialising `DOC_CONTEXT=''` at the top of step 4a.

## [0.9.0] — 2026-05-06

### Breaking
- (none)

### Added
- Doc Context enrichment: before review agents run, fetch linked ADO work items and
  any Confluence pages referenced in their descriptions; inject structured,
  diff-aware summaries as business context into every review agent's prompt.
  Requires Confluence credentials (`CONFLUENCE_URL`, `CONFLUENCE_USER`,
  `CONFLUENCE_TOKEN` or `~/.unic-confluence.json`) for Confluence page fetching;
  degrades gracefully when absent or unreachable.

### Fixed
- (none)

## [0.8.0] — 2026-05-06

### Breaking
- (none)

### Added
- Re-review: detect prior Claude Code threads in Step 3.5; set `IS_REREVIEW`, `PRIOR_THREADS_FILE`, `SUMMARY_THREAD_ID`, and `PRIOR_ITERATION_ID`; normalize signature format to `🤖 *Reviewed by Claude Code* — Iteration N` for detection and iteration targeting (specs 01–02)
- Re-review: resolve `LATEST_ITERATION_ID` and `LATEST_COMMIT_ID` from PR iterations API; compute `PRIOR_COMMIT_ID` from prior review signature; replace hardcoded `iterationId=1` (spec 03)
- Re-review: incremental diff between `PRIOR_COMMIT_ID` and `LATEST_COMMIT_ID` in Step 5; early exit with pending thread list when no new commits detected (spec 04)
- Re-review: classify each prior bot thread as `addressed`, `disputed`, `pending`, or `obsolete` in Step 5.5; detect deleted-file threads as `obsolete` (spec 05)
- Re-review: reply to existing bot threads instead of posting new duplicates in Step 10; apply per-classification actions and post run-completion marker on every successful run (spec 06)
- Re-review: skip full summary when no new or addressed findings; post delta reply (counts + new finding bullets) to existing summary thread; fall back to full summary if prior summary thread was deleted (spec 07)

### Fixed
- (none)

## [0.7.0] — 2026-05-06

### Breaking
- (none)

### Added
- On re-review, skip full summary when nothing changed; post delta reply (counts + new finding bullet list) to existing summary thread when findings exist; fall back to full summary if prior summary thread was deleted (spec 07)

### Fixed
- (none)

## [0.6.0] — 2026-05-06

### Breaking
- (none)

### Added
- Reply to existing bot threads instead of duplicating them on re-review: match prior threads by file path and line-range overlap (±3 line drift), branch Step 10 on `IS_REREVIEW`, apply per-classification actions (skip `pending`, reply `disputed`/`addressed`, ignore `obsolete`), post run-completion marker on every successful run (spec 06)

### Fixed
- (none)

## [0.5.0] — 2026-05-06

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
