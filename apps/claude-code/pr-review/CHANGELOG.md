# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- New `scripts/re-review/parse-diff-hunks.mjs` helper module (with 7 unit tests) that parses raw `git diff` text into per-hunk `{ filePath, startLine, endLine }` entries — pure function, no I/O, slash-prefixed file paths.
- New `scripts/mode-detection.mjs` helper that consolidates `Step 4` re-review detection and exports both `detectMode()` and `formatModeEnv()` used by the orchestrator.

### Changed
- Trim `commands/review-pr.md` from 297 lines to ≤ 200 lines to meet the PRD acceptance criterion: extracted mode-detection to a helper, factored the duplicated `MODE`/`SUMMARY_THREAD_ID` write-back into a single ADO Writer prompt, consolidated the compact finding schema into one shared block referenced by Step 6 and Pre-PR Step D, and tightened instructional prose. Realigned the compact-output guidance tests to assert against the shared schema block + each section's reference, removing fragile section-slice substring assertions.

### Fixed
- Convert static imports of helper modules to `await import(...)` in agent prompts — static `import` does not accept dynamic specifiers.
- Port the re-review diff-hunk parser from a `python3` heredoc to a Node helper (`parse-diff-hunks.mjs`) in `re-review-coordinator.md` Step 1 — Windows-native CI and developer machines have no `python3`, breaking the cross-platform rule.
- Replace bare `/tmp/` literals with `${TMPDIR:-/tmp}/` across `re-review-coordinator.md` (reply/patch/error files in Steps 6 and 7) and `ado-writer.md` (thread, fallback, summary, delta, completion files in Steps 1–4) so temp files honour the OS-configured temp directory.
- Drop the `.json` suffix from `mktemp ".../re_review_hunks_XXXXXX"` / `re_review_prior_threads_XXXXXX` patterns — BSD `mktemp` on macOS rejects suffixes after the `X` template.
- H1 — ADO Writer Step 1 no longer bumps `FINDINGS_POSTED` unconditionally after the threadContext fallback. The substring `"message"` heuristic is replaced by a structural check (exit code + numeric `id` parsed by Node); on confirmed failure the writer logs the captured stderr from the `*.err` file and continues to the next finding rather than miscounting a missing post as success.
- H2 — ADO Writer Step 2 no longer swallows summary/delta POST failures. The summary POST and the re-review delta-reply POST now capture exit code + parsed numeric `id`; on failure the writer aborts with a non-zero exit and a clear stderr message, because the completion marker and the next re-review's detection both depend on a valid `SUMMARY_THREAD_ID` — silent failure here corrupts re-review state forever.
- H3 — Orchestrator Step 4 no longer coerces `az repos pr thread list` failures to `[]`. The fetch is now captured separately; on non-zero exit the orchestrator emits a clear stderr error ("ERROR: failed to fetch PR threads via Azure CLI. Try `az devops login` to re-authenticate.") and exits `1`, preventing a fetch failure from being mistaken for "no prior threads" and triggering a duplicate-post storm on re-review.
- H4 — Re-review Coordinator Step 3 partial-run check no longer conflates "marker missing" with "check crashed". The Node heredoc now wraps its body in try/catch and exits with distinct codes (`0` = found, `1` = not found, `2` = crash); the bash side branches on those codes and aborts the coordinator with exit `3` on a crash instead of silently downgrading to first-review mode and re-posting every prior thread.
- H5 — ADO Fetcher Step 4 branch-checkout fallback is now an executable `||` chain instead of a literal shell comment. If `az repos pr checkout` fails, the agent now actually runs `git fetch origin "$SOURCE_BRANCH" && git checkout "$SOURCE_BRANCH"`, and aborts with a clear stderr error if both fail — previously the comment-form fallback never ran and the agent silently continued on the wrong branch.

## [1.0.0] — 2026-05-12

### Breaking
- (none)

### Added
- Orchestrator split: `review-pr.md` refactored from a monolithic command to a thin orchestrator (≤ 200 lines per PRD acceptance criterion) that delegates ADO API calls and coordination logic to three focused agents
- ADO Fetcher agent: handles all Azure DevOps REST API fetches (diff, threads, iterations) in a single dedicated context window
- Re-review Coordinator agent: classifies prior bot threads, computes incremental diffs, and decides per-thread reply actions
- ADO Writer agent: posts all inline thread comments and the summary comment back to ADO, keeping write operations isolated from analysis
- Pre-PR mode: invoke `/pr-review:review-pr` without an ADO URL to review a local branch diff before the PR is created; findings are printed to the terminal instead of posted to ADO
- Compact sub-agent output: all review-aspect agent prompts now include an explicit JSON output contract, keeping reasoning inside each agent's context window and returning only structured `{ severity, filePath, startLine, endLine, title, body }[]` arrays to the orchestrator

### Fixed
- (none)

## [0.9.1] — 2026-05-08

### Breaking
- (none)

### Added
- (none)

### Fixed
- Credential check in Step 4 now runs only when at least one Confluence URL was found across
  all Work Item Summarizer outputs; when no URLs are present the check is skipped entirely.
  Stderr from `--check-creds` is now suppressed so only the orchestrator's standardised
  warning is visible to the user rather than duplicate or misleading output from the tool.
- Fixed ambiguous `{CHANGED_FILES}` placeholder in the synthesizer delegation prompt: replaced
  with `{CHANGED_FILES_LIST}` and explicit wording that instructs the orchestrator to forward
  the actual changed-files list it received, preventing the token from being interpreted
  literally and ensuring the synthesizer stays diff-aware.
- Doc Context phase was silently skipped on every run: three defects combined — step 4a
  lacked an explicit `Agent()` spawn (orchestrator intent was satisfied inline and skipped),
  `confluence-client.mjs` was resolved relative to the reviewed project root instead of the
  plugin directory, and `DOC_CONTEXT` was never initialised so failures were invisible.
  Fixed by extracting the entire gathering phase to a dedicated Doc Context Orchestrator
  agent (isolates token consumption in a fresh context window), resolving all script paths
  from `${CLAUDE_PLUGIN_ROOT}`, and initialising `DOC_CONTEXT=''` at the top of step 4a.
- Doc Context Synthesizer agent added to produce a single flat `## Business context for this PR`
  narrative from all work item and Confluence summaries, isolating synthesis in a dedicated
  context window.
- Step 4a bash snippet was non-deterministic: `az devops invoke` output was printed but
  never captured, so failure detection and work item ID extraction were impossible. Fixed
  by capturing output into `WI_JSON`, extracting IDs via `jq` into `WI_IDS`, branching
  on empty array / non-zero exit, and passing `{WI_IDS}` (the computed variable) to the
  `Agent()` call instead of an unresolved placeholder.

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
