# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking

- (none)

### Added

- `scripts/lib/exec.mjs`: shared `Exec` / `ExecResult` types and `realExec` (removes the duplication between `doctor.mjs` and `base-branch-resolver.mjs`)
- `scripts/lib/finding-validator.mjs`: `parseFinding` boundary validator for raw agent output (drops findings below the confidence floor, throws on malformed shapes)
- `scripts/render-summary.mjs`: standalone CLI that reads `FINDINGS_JSON` and writes the Review Summary markdown — replaces the cross-platform-fragile inline `node -e` snippet in `commands/review-pr.md`
- `doctor.mjs` exports `mapPingError`, `PING_TIMEOUT_MS`, `AZ` for unit testing
- `commands/review-pr.md` Step 3 includes a large-diff (`git diff --shortstat`) sanity check before fanning out to the agent
- `commands/review-pr.md` Steps 4 and 5 now require the orchestrator to relay `render-summary` stderr verbatim and to stop on non-zero exit (so silently-dropped or malformed findings cannot be hidden from the user)
- `tests/render-summary.test.mjs`: 8 integration tests covering missing env var, malformed JSON, non-object root, sub-threshold drop, malformed-finding drop with stderr, and well-formed rendering
- `tests/doctor.test.mjs`: 199 / 299 / 300 HTTP boundary tests pinning `isPingOk`

### Changed

- `PingResult` is now a discriminated union (`{ kind: 'http' } | { kind: 'transport-error' }`) so callers cannot conflate transport failures with HTTP responses
- `ModeContext` is a discriminated union mirroring the four-row decision table — nonsense input combinations are unrepresentable
- `ReviewSummaryContext` collapses `criticalFindings` / `importantFindings` / `minorFindings` into a single `findings: SummaryFinding[]` with a `severity` field; the renderer buckets internally
- `IntentCheckItem.verdicts` value type is now `'addressed' | 'unaddressed' | 'partial'` instead of free-form strings
- `realPing` maps `TimeoutError` to a friendly `Request timed out after 10s` so doctor output is consistent across Node versions
- `bucketBySeverity` throws on non-finite or out-of-range confidence inputs instead of silently returning `null`
- `analyseChangedFiles` and `resolveBaseBranch` validate their inputs at the boundary and throw on misuse
- `renderInlineComment` treats a whitespace-only `suggestion` as absent
- `agents/code-reviewer.md` JSON schema drops the unused `endLine` field

### Fixed

- Test runner now executes credentials.test.mjs in addition to doctor.test.mjs
- doctor stays fully silent about Jira when jiraUrl is not configured (US-35)
- realPing degrades gracefully when given a malformed URL instead of crashing the doctor
- credentials loader distinguishes file-read errors from JSON-parse errors
- review-pr command frontmatter allows the `Agent` tool so the code-reviewer sub-agent can be spawned
- JSDoc and prose comments across `signature.mjs`, `notices.mjs`, `base-branch-resolver.mjs`, `changed-file-analyser.mjs`, and `review-summary-renderer.mjs` reworded to match runtime behaviour
- `tests/doctor.test.mjs` covers the `mapPingError` timeout path and asserts the `AZ` binary selector matches `process.platform`

## [2.0.0] — 2026-05-28

### Added

- Plugin scaffold: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `tsconfig.json`
- Domain vocabulary in `CONTEXT.md` (Plugin, Review, Finding, Confidence, Severity, Intent Brief, Intent Check, Bot Signature, Iteration, Approval Loop, Mode, Provider, Work Item, Notice)
- `/unic-pr-review:doctor` slash command (`commands/doctor.md`)
- `scripts/doctor.mjs`: six preflight checks — `az` CLI, `azure-devops` extension, `az devops` login, `az devops user show --user me` identity (for ADR-0006 caching), Confluence reachability, Jira reachability (silent when `jiraUrl` is unset per US 35)
- `scripts/lib/credentials.mjs`: shared loader for `~/.unic-confluence.json` and `~/.unic-azure.json` with env-var overrides
- `tests/doctor.test.mjs`: unit tests for all six predicates with stubbed executors and fetchers
