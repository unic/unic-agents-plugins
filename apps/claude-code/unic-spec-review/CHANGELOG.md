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

## [0.1.3] — 2026-06-08

### Breaking
- (none)

### Added
- Extend `atlassian-fetch` with `fetchConfluenceComments`: reads all footer and inline Confluence comments for a page via the v1 REST API with injected fetch; paginated via `_links.next`; read-only, no writes. Inline comments carry the original selection text as `anchor`.
- Add `landscape-detector` module: derives a `LandscapeBrief` (stack, test runner, test frameworks, tooling, reachable-prod flag, adjacent systems) from repo manifests (package.json, pyproject.toml, requirements.txt, Cargo.toml, go.mod, Gemfile, pom.xml, build.gradle) plus the file listing and user-declared out-of-repo adjacent systems; never hardcodes the technology stack. Computed once and exposed for injection into the review agents (consumed fully in S4).
- Unit tests cover `fetchConfluenceComments` (footer, inline with anchor, empty page, pagination, HTML strip, author fallback, 401/404, bad URL) and `detectLandscape` (Node.js/TypeScript/React, jest/vitest/node:test runner selection, Playwright reachableProd, Biome/ESLint tooling, Python/pytest, Rust, Go, Ruby/Rails, Java, adjacentSystems passthrough, malformed JSON, readdir failure) with injected deps; no live services.

### Fixed
- (none)

## [0.1.2] — 2026-06-05

### Breaking
- (none)

### Added
- Cover two previously untested paths flagged in PR #210 review: `loadAtlassianCreds` preferring env vars over a present credentials file, and `fetchConfluencePage` capping the stripped excerpt at 800 characters.
- Add `/setup-confluence` command: interactive credential wizard writing `~/.unic-confluence.json`, vendored by copying from `unic-pr-review` (ADR-0001 self-containment, no cross-import).
- Add `/spec-doctor` command: preflight checks for Confluence credentials and connectivity, Figma Dev Mode MCP, and Playwright MCP; absent MCPs are reported as explicit loud failures with remediation, never a silent skip.
- Add `parseArgs` to the `args` module (CLI parser shared by the setup wizard) alongside the existing `parseReviewSpecArgs`.
- Unit tests for the vendored `setup-confluence` wizard (`writeConfluenceCreds`, `isEnvConfigured`) and the Confluence preflight logic (`checkConfluence`, `runSpecDoctorCredentials`, `mapPingError`, `realPing`) with injected `homedir`/`platform`/`fetch`/`loadCreds`; no live services.
- Cover two more pure-logic branches flagged in PR #211 review: `isEnvConfigured` rejecting an env var that is present but empty, and `checkConfluence` falling back to the raw url string when the configured url is unparseable.

### Fixed
- Reject non-http(s) URLs in arg parsing, link classification, and validate `pageTitle`/`pageUrl` in the report-renderer CLI entry, so ftp/file/mailto inputs no longer slip through and missing report fields no longer render as literal `undefined`.
- Make `/review-spec` orchestration portable: write the scratch report JSON into the gitignored `.spec-review/` directory instead of the POSIX-only `/tmp` path (broke on Windows CI), and surface the structured `errors[].kind`/`errors[].message` from the fetch script so the real failure cause is shown.

### Documentation
- Correct stale cross-plugin references in code comments (drop the `render-summary.mjs`, `doctor.mjs`, and inaccurate `ADR-0001` citations), reword the `CONTEXT.md` status line so it no longer promises an unused `(S1)` per-term marking convention, and replace em dashes with hyphens in authored comments, command docs, user-facing script output, and test descriptions, per this slice's acceptance criterion (no em dash in authored text except the mandated CHANGELOG version header).
- Reword the `writeConfluenceCreds` JSDoc to drop a stale `:setup-jira` reference (a command that exists in `unic-pr-review` but not in this plugin); the `jiraUrl` preservation behavior is unchanged.

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
