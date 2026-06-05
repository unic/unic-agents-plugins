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
- Reject non-http(s) URLs in arg parsing, link classification, and validate `pageTitle`/`pageUrl` in the report-renderer CLI entry, so ftp/file/mailto inputs no longer slip through and missing report fields no longer render as literal `undefined`.
- Make `/review-spec` orchestration portable: write the scratch report JSON into the gitignored `.spec-review/` directory instead of the POSIX-only `/tmp` path (broke on Windows CI), and surface the structured `errors[].kind`/`errors[].message` from the fetch script so the real failure cause is shown.

### Documentation
- Correct stale cross-plugin references in code comments (drop the `render-summary.mjs`, `doctor.mjs`, and inaccurate `ADR-0001` citations), reword the `CONTEXT.md` status line so it no longer promises an unused `(S1)` per-term marking convention, and replace em dashes with hyphens in authored comments and messages per the org typography rule.

## [0.1.1] — 2026-06-05

### Breaking

- (none)

### Added

- Vendor `atlassian-fetch.mjs` and `credentials.mjs` from `unic-pr-review` (ADR-0001 self-containment); only the Confluence page-read path is used in this slice.
- Add `link-classifier` module: routes a pasted URL to `confluence` / `figma-page` / `figma-frame` / `live` / `unknown` and extracts the Confluence page id.
- Add `args` module: parses `/review-spec` arguments (URL list + `--post` flag recognition).
- Add `report-renderer` module: renders a timestamped markdown report and writes it to `.spec-review/` (gitignored).
- Add `gaps-agent` (Gaps/Completeness dimension agent): inspects a Confluence page for missing states, undefined behaviour, and absent acceptance criteria.
- Implement `/review-spec` S1 skeleton: classify URL, fetch one Confluence page, run Gaps agent, print findings, write report.
- Restore test harness: `pnpm test` and `pnpm typecheck` scripts, `tsconfig.json`, `scripts/` and `tests/` directories.

### Fixed

- (none)

## [0.1.0] — 2026-06-05

### Added

- Scaffold the unic-spec-review plugin: `/review-spec`, `/spec-doctor`, and `/setup-confluence` command stubs; PRD (#200); ADRs 0001 to 0004; `CONTEXT.md` domain vocabulary; `app:unic-spec-review` area label; CI and release-workflow registration. Command and agent logic pending implementation.
