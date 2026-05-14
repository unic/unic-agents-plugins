# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Changed
- (none)

### Fixed
- (none)

## [1.2.7] — 2026-05-14

### Breaking
- (none)

### Added
- (none)

### Changed
- `matchFinding` now throws a `TypeError` when `priorThreads` is not an array or when `finding` is missing required typed fields (`filePath: string`, `startLine: number`, `endLine: number`). Previously, malformed input could produce an uncaught exception that was silently swallowed as a no-match.
- Re-review Coordinator Step 6a wraps the `match-finding` call in a try/catch. On throw, a DEGRADED Notice (`kind: thread-match`) is pushed to the Coordinator's `NOTICES` array and the finding falls through to the unclassified (no-match) path. The Coordinator result block now includes a `NOTICES: [...]` field.
- Orchestrator Step 7 extracts `NOTICES` from the Coordinator result block; Step 8 includes them in the combined `mergeNotices` call alongside Fetcher and Writer notices.

### Fixed
- Match-finding parse errors were previously silently swallowed by `2>/dev/null || echo ""` guards in the Coordinator, causing the affected finding to be treated as no-match and re-posted as a duplicate inline thread with no visible signal. The throw contract and DEGRADED Notice surface the cause to the reviewer.

## [1.2.6] — 2026-05-14

### Breaking
- (none)

### Added
- (none)

### Changed
- `addressed` threads are now silently resolved — the Re-review Coordinator PATCHes the thread status to fixed (status 2) without posting a Reply comment. Previously a "Resolved — thanks!" reply was posted, generating an ADO notification for every thread participant.
- `classifyThread` now accepts a `diffRange: 'full' | 'incremental'` parameter (default `'incremental'`). When `'full'`, outputs `addressed` and `obsolete` are remapped to `pending` (γ-downgrade per ADR-0004) since diff-position evidence is unreliable on a widened range. `disputed` is unaffected.
- Re-review Coordinator (Step 5) parses `DIFF_RANGE` from `ADO_FETCHER_RESULT` and threads it into every `classify-thread` invocation.

### Fixed
- Re-reviews that fell back to a full diff (prior commit unreachable) no longer produce false-confidence `addressed` or `obsolete` classifications; all such threads are conservatively downgraded to `pending`.

## [1.2.4] — 2026-05-14

### Breaking
- (none)

### Added
- (none)

### Changed
- `parseAdoWriterResult` now returns a discriminated union `{ ok: true, summaryThreadId, findingsPosted, notices } | { ok: false, reason: 'missing-block' | 'malformed' }` instead of a partial object with null fields. Callers must branch on `result.ok` before accessing result fields.

### Fixed
- Writer crash no longer silently reported as success: the orchestrator now emits a clear stderr error and an aborted Trailer when the Writer's result block is missing or malformed.

## [1.2.3] — 2026-05-14

### Breaking
- (none)

### Added
- `scripts/ado/parse-write-response.mjs` — pure function `parseWriteResponse({ httpExit, responseText, errStream })` returning `{ ok: true, id } | { ok: false, tier, kind, message }`. Composes `classifyHttpError` with response-id parsing; 404/409 map to `{ ok: true, id: null }` (canonical OK with no resource created); 200 without a numeric id maps to `{ ok: false, tier: 'degraded', kind: 'malformed-response' }`. Covered by `tests/parse-write-response.test.mjs` (13 unit cases spanning all branches).

### Changed
- ADO Writer prompt routes every `az devops invoke` POST/PATCH call site through `parseWriteResponse`. On `tier: 'aborted'` (401/403), the Writer streams the `.err` file to stderr and exits non-zero. On `tier: 'degraded'` (5xx/network/other-4xx), the Writer pushes a typed DEGRADED Notice to its internal `NOTICES` array and continues to the next call site. `ADO_WRITER_RESULT_START/END` block gains a `NOTICES: [...]` field.
- Orchestrator Step 8 now parses Writer `NOTICES` from the result block and merges them into `NOTICES_JSON` via `mergeNotices` before printing the Trailer, so all Notice counts reflect both Fetcher and Writer sources.
- `parseAdoWriterResult` return type extended to `{ summaryThreadId, findingsPosted, notices: Notice[] }`. Legacy blocks without a `NOTICES` field return `notices: []`.

### Fixed
- ADO Writer inline-POST auth failures (HTTP 401/403) now abort the Writer immediately with a clear stderr message. Previously they were silently logged and the run continued, leaving subsequent writes potentially authenticated against stale credentials.

## [1.2.2] — 2026-05-13

### Breaking
- (none)

### Added
- (none)

### Changed
- ADO Fetcher result block (`ADO_FETCHER_RESULT_START/END`) now includes a `DIFF_RANGE: full | incremental` field reflecting which diff strategy was used. Orchestrator parses the field; the Coordinator γ-downgrade that consumes it is deferred to PRD B issue B3.

### Fixed
- Diff-range fallback in the ADO Fetcher no longer fires silently. When the prior iteration's commit is unreachable and the Fetcher falls back to `origin/${TARGET_BRANCH}...HEAD`, a `warning` Notice (`kind: diff-range`) is now emitted in the Fetcher's `NOTICES` array so the reviewer sees the degraded state in the Summary.

## [1.2.1] — 2026-05-13

### Breaking
- (none)

### Added
- `scripts/ado/fetch-iterations.mjs` — pure function `fetchIterations({ responseText, exitCode })` returning `{ ok: true, latestIterationId, latestCommitSha } | { ok: false, reason, message }`. Subsumes `parseIterations`; uses `classifyHttpError` for HTTP failures; distinguishes empty-iterations ABORTED from auth/transient/malformed. Covered by `tests/fetch-iterations.test.mjs` (8 unit cases spanning all reason branches).

### Changed
- ADO Fetcher prompt Step 2 (iterations fetch) now delegates to `fetchIterations` via `await import`. On `{ ok: false }`, the Fetcher exits non-zero with a clear stderr message and the orchestrator emits a Trailer aborted line.

### Fixed
- `parseIterations` and its silent `iterationId=1` fallback for empty-iterations are removed; an empty iterations endpoint response now aborts the run instead of silently signing comments with `Iteration 1`.

## [1.2.0] — 2026-05-13

### Breaking
- (none)

### Added
- `scripts/ado/classify-http-error.mjs` — pure function `classifyHttpError({ status, body, exitCode })` implementing the canonical HTTP-tier mapping (200/201/404/409 → OK; 401/403 → ABORTED; 5xx/other-4xx → DEGRADED; network/exit-code → DEGRADED). Covered by `tests/classify-http-error.test.mjs` (16 unit cases spanning every mapping row, malformed-body paths, and network-exit-code paths).
- `scripts/ado/fetch-work-items.mjs` — pure function `fetchWorkItems({ responseText, exitCode })` returning `{ ok: true, ids } | { ok: false, reason, message }`. Subsumes `parseWorkItemIds`; distinguishes EMPTY-BY-DESIGN (`{ ok: true, ids: [] }`) from fetch failure (`{ ok: false }`). Covered by `tests/fetch-work-items.test.mjs` (9 unit cases).
- ADR 0015 (`docs/adr/0015-canonical-http-tier-mapping.md`) recording the HTTP-tier mapping table, the 401/403 abort rule, and the no-retries-in-v1 stance.

### Changed
- ADO Fetcher prompt Step 5 (`work-item fetch`) now delegates to `fetchWorkItems` via `await import`. On `{ ok: false }`, emits a DEGRADED Notice (`kind: work-items`) into the `NOTICES` array. On `{ ok: true, ids: [] }`, still emits the existing EMPTY-BY-DESIGN `info` Notice (`kind: doc-context`).

### Fixed
- `parseWorkItemIds` is removed; callers that received an empty array on auth failure can no longer conflate a fetch failure with a legitimately empty work-item list.

## [1.1.0] — 2026-05-13

### Breaking
- (none)

### Added
- `scripts/ado/notices.mjs` — pure helpers (`createNotice`, `mergeNotices`, `formatNoticesAsSummaryBlock`, `formatNoticesAsPrePrPreamble`, `formatTrailer`) implementing the four-tier Notice doctrine (OK / EMPTY-BY-DESIGN / DEGRADED / ABORTED). Covered by `tests/notices.test.mjs` (14 unit cases).
- ADR 0014 (`docs/adr/0014-notice-tier-doctrine-and-failure-classification-helpers.md`) recording the four-tier doctrine, the no-fifth-ASK-tier rule, the Notice shape (`{ severity, kind, message }`), the canonical `kind` enum, the mandatory end-of-run Trailer convention, and the helper-layer refinement to ADR 0013.
- ADO Fetcher `ADO_FETCHER_RESULT_START`/`_END` block now carries a `NOTICES` JSON array. When `WORK_ITEM_IDS=[]`, the Fetcher emits an `info` Notice (`kind: doc-context`, message: "Reviewed without business context — no work items linked to this PR.").

### Changed
- Orchestrator (`commands/review-pr.md`) parses `NOTICES` from the Fetcher result block, sets `NOTICES_JSON` via `mergeNotices`, and threads it into the ADO Writer prompt. New `Step 8 — End-of-run Trailer` prints one mandatory `formatTrailer` line in the Claude interface for every run (success, abort). Pre-PR mode's completion line is now also a `formatTrailer` call (`mode: 'pre-pr'`) so AFK invokers see the same trailer shape across modes.
- ADO Writer (`.agents/ado-writer.md`) accepts a new `NOTICES_JSON` input and renders a `## Notices` block above severity-grouped findings in the Review Summary content (heading bare; `ℹ️` / `⚠` prefixes per item). Empty `NOTICES_JSON` produces no `## Notices` heading.
- Orchestrator `## Constants` section removed; the `SIGNATURE_PREFIX` invariant is now expressed inline at every call site that needed it (the constant value was already inlined; the section was documentation only).

### Fixed
- (none)

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
- Re-review Coordinator inline cross-references in Steps 2 and 3 pointed to a non-existent `Step 7 — Return result` section (the actual return-result heading is Step 8, after `Step 7 — Clean up`). Anchors now resolve and use the same numbering as the headings.
- Re-review Coordinator Inputs section now states explicitly that `PRIOR_ITERATION_ID` is recomputed internally by `detect-prior-review` from `RAW_THREADS_JSON`; the orchestrator's own `PRIOR_ITERATION_ID` is not threaded in, preventing redundant input plumbing.
- Re-review Coordinator no-prior-threads and partial-run branches no longer claim to "fall back to first-review mode" — the coordinator does not switch modes, it returns a result block with zero counts and `freshFindings = FINDINGS`, and the orchestrator does not change agent dispatch based on this. Prose corrected in Step 2, Step 3, and the two associated `echo` log lines.
- Re-review Coordinator Step 6a now states up front that `{finding.filePath}` / `{finding.startLine}` / `{finding.endLine}` are prompt-template placeholders to be substituted by the agent for the current `FINDINGS` element, not bash variables.
- ADO Writer Step 2's `MODE=re-review, zero new findings` branch now notes that Step 3 still posts the completion marker on every successful run, resolving the apparent contradiction with the "Do not post anything" line.
- ADO Fetcher output documentation now flags `LATEST_COMMIT_SHA` as reserved for future diff-range debugging and unused by any current downstream agent (the diff-range logic that needed it is self-contained in Step 4) — prevents future contributors from threading it through new agents under the assumption it is consumed.
- Orchestrator Step 6 prose no longer claims the review-aspect-agent prompts receive `PR_TITLE` and `PR_DESCRIPTION`. The Fetcher captures them for downstream use, but the orchestrator does not parse them, so the prose now reads "full diff and changed file contents" only — removing the contradiction with Step 5's parse list.
- Pre-PR mode default-branch detection no longer silently leaves `DEFAULT_BRANCH` empty when `git remote show origin` produces no `HEAD branch:` line. The pipeline now filters empty awk output through `grep .` so the `|| echo "main"` fallback fires for real, instead of being short-circuited by a still-zero-exit awk.
- `shouldSkipFile` now uses the lower-cased path for the `/generated/` directory check too, so capitalised `.NET`-style paths like `/Source/Generated/ApiClient.cs` are skipped consistently with the other rules.
- `parseChangedFilesFromDiff` now splits the diff text on `/\r?\n/` (matching the sibling `parseDiffHunks` helper), so CRLF-formatted diffs from Windows Git no longer produce paths with a trailing `\r`.

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
