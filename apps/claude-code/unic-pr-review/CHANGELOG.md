# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking

- (none)

### Added

- Interactive Approval Loop (issue #149, ADR-0003): `scripts/approval-loop.mjs` reads `findings.json`, walks each Finding interactively (`a`ccept / `e`dit / `s`kip), and writes `approved.json`; state persists to `<cwd>/.unic-pr-review/<key>/state.json` after every decision so the loop is resumable across Ctrl-C, and is deleted on success (best-effort — a cleanup failure is a non-fatal warning). `--yes` bulk-accepts (still writes state); `--reset` forces fresh state (also rescuing a malformed state file); a non-TTY context without `--yes` exits 2 before reading state. `approved.json` and `state.json` are both written atomically via tmp + rename
- `scripts/lib/cache-paths.mjs`: `sha16()` key derivation and `getApprovalStateDir(key)` returning `<cwd>/.unic-pr-review/<key>/`, writing a self-ignoring `<cwd>/.unic-pr-review/.gitignore` (`*`) on first use so the state tree is never tracked
- `scripts/lib/args.mjs`: `parseArgs` gains an `options.booleanFlags` set for presence-only flags (`--yes`, `--reset`) recorded as `''`; existing callers are unaffected
- `scripts/lib/severity-bucketer.mjs` exports `SEVERITY_ORDER` so the Approval Loop's stable Finding ordering reuses the canonical severity vocabulary instead of duplicating it
- `tests/approval-loop.test.mjs` + `tests/args.test.mjs`: cover state-file shape, accept/edit/skip transitions, resume from partial state, all head-SHA-mismatch branches (fresh/continue/`--reset`/`--yes`), non-TTY abort, `--yes` bulk-accept, malformed-findings and malformed-state guards, early stream close (Ctrl-D), atomic-write and best-effort-cleanup behaviour, gitignore creation, and `parseArgs` boolean-flag handling
- ADO Writer agent (issue #150): `agents/ado-writer.md` ("Scribe", orange) consumes `approved.json` from the Approval Loop and posts one inline Review Thread per approved Finding (Active status, attached to the right file and line range) plus one General Comment Thread for the Review Summary, all via `az devops invoke --area git --resource threads --http-method POST`; the Bot Signature footer on every comment is rendered exclusively by `scripts/render-inline-comment.mjs` and `scripts/render-summary.mjs` (never inlined by the agent); `suggestion` blocks appear only when the upstream Finding included a non-empty `suggestion` field
- `scripts/render-inline-comment.mjs`: CLI bridge that renders a single Finding's Inline Comment (severity emoji, title, prose body, optional suggestion block, Bot Signature footer) from `INLINE_COMMENT_JSON` env var; cross-platform, no shell quoting issues
- `scripts/lib/parse-write-response.mjs`: normalises the `az devops invoke` POST result into `{ success, threadId, error }` covering both create-thread and future patch-thread paths; tested in `tests/parse-write-response.test.mjs`
- `providers/azure_devops/fixtures/ado-cli-inventory.json` gains an `invokeCommandsWriter` section listing the `git/threads POST` path used by the ADO Writer
- `tests/ado-cli-smoke.test.mjs` expanded: new bidirectional test verifies every `az devops invoke` path in `ado-writer.md` is present in `invokeCommandsWriter` and vice versa
- `commands/review-pr.md` gains `--post` / `--yes` write path (ADO mode only): serialises Findings, runs the Approval Loop, spawns the ADO Writer agent, and deletes the state directory after writer success
- Re-review detection + delta diff + per-prior verdicts (issue #151, ADR-0006 / ADR-0007). `scripts/lib/signature.mjs` `parseSignature` is now a real parser: it takes bot-filtered PR Thread payloads and returns `{ priorRevisionId, priorAuthorUserId, priorIteration }` for the newest Bot Signature (highest iteration), or `null` when none is found; detection and rendering share the single `SIGNATURE_PREFIX` literal, and `\r\n` is normalised before matching
- `scripts/parse-prior-signature.mjs`: a thin executable wrapper that reads bot-filtered threads from stdin, calls `parseSignature`, and writes the result as JSON, so the ADO Fetcher invokes the canonical parser via `node` instead of duplicating the regex
- `agents/ado-fetcher.md` Step 4a filters Threads by the cached identity ID before parsing (so human comments are never read as prior reviews), detects `MODE` (`first-review` / `re-review` / `first-review-fallback`), and in `re-review` mode computes a `git diff` delta between the prior reviewed Revision's commit and the current commit and extracts `priorFindings` from inline bot Threads; output schema gains `mode`, `priorRevisionId`, `priorIteration`, `deltaRawDiff`, and `priorFindings` (the agent gains `Bash(git *)`; no new `az devops invoke` paths)
- `scripts/lib/finding-validator.mjs`: the Finding schema gains an optional `priorVerdict` (`fixed` / `partial` / `ignored`); `parseFinding` passes valid verdicts through and silently drops unrecognised values for forward compatibility
- All six Review Aspect agents accept an optional `priorFindings` preamble and, in Re-review mode, emit a per-prior-Finding `priorFindingVerdicts` array plus an optional `priorVerdict` on matching Findings
- `scripts/lib/notices.mjs`: a `priorVerdictSummary` notice renders the qualitative re-review tally (`N of M prior findings addressed`) in the terminal preview, after the diff-unavailable notice
- `tests/signature.test.mjs`, `tests/finding-validator.test.mjs`, `tests/notices.test.mjs`: cover empty / no-match / single / highest-wins / force-push / CRLF / round-trip parsing, `priorVerdict` pass-through and silent-drop, and `priorVerdictSummary` rendering and ordering

### Fixed

- `commands/review-pr.md` Step 1.13: the state-directory cleanup keyed off `CLAUDE_PLUGIN_ROOT`, but the Approval Loop persists state under `process.cwd()`; the success-branch `rmSync` therefore targeted a non-existent path and never removed the real state directory. Cleanup now uses `process.cwd()` to match where the state was written
- `commands/review-pr.md`: partial-failure retry advice told users to re-run with `--post --yes`, which would re-post already-succeeded threads as duplicate ADO comments; corrected to `--post` (resume from saved state, re-posting only the failed threads)
- `scripts/render-inline-comment.mjs`: required fields were validated for presence only; `title`/`body` are now required to be non-empty strings and `iteration` a finite number, so malformed input fails fast instead of rendering garbage into the load-bearing Bot Signature
- `scripts/lib/parse-write-response.mjs`: an `az devops invoke` exit-0 error envelope (`{ message, typeKey, errorCode }`, no numeric `id`) was reported as a generic "missing numeric id" error; the ADO `message` is now surfaced verbatim as `ADO error: <message>`
- `agents/ado-writer.md` Step 1: added an explicit guard for an unreadable or non-array approved-Findings file so the writer reports `success: false` instead of a false success that would trigger state cleanup and silently drop approved Findings

## [2.0.2] — 2026-06-03

### Breaking

- (none)

### Added

- (none)

### Fixed

- `agents/intent-checker.md` Step 0: an unreachable or auth-erroring ADO Work Item linked natively in the PR now hard-stops instead of silently dropping its acceptance criteria, consistent with ADR-0004 promised-intent doctrine; `not-found` remains a soft note. Org-URL extraction now surfaces the offending URL on failure instead of silently passing a wrong `--org` to `az boards work-item show` (issue #177)
- `commands/review-pr.md` Step 1.6: handles the new `{ "hardStop": true, "workItem": "…", "reason": "work-item-unreachable" }` shape emitted by the Intent Checker when a linked ADO Work Item is unreachable, printing a clear message that references the Work Item id and URL (issue #177)
- ADR-0004 amended to state that provider-discovered Work Items are promised intent and follow the same reachability doctrine as pasted URLs (issue #177)

## [2.0.1] — 2026-06-03

### Breaking

- (none)

### Added

- `/unic-pr-review:review-pr` slash command (`commands/review-pr.md`) + `agents/code-reviewer.md` aspect agent: Pre-PR mode that diffs the local branch against its upstream base and prints the Review Summary
- `/unic-pr-review:setup-confluence` slash command (`commands/setup-confluence.md`) + `scripts/setup-confluence.mjs` writes `~/.unic-confluence.json` with chmod 600 on POSIX
- `/unic-pr-review:setup-jira` slash command (`commands/setup-jira.md`) + `scripts/setup-jira.mjs` adds/updates the `jiraUrl` field in the Confluence credential file, idempotent on re-run
- `/unic-pr-review:setup-azure` slash command (`commands/setup-azure.md`) + `scripts/setup-azure.mjs` writes `~/.unic-azure.json` with chmod 600 on POSIX
- Tests for all three wizards: happy path, idempotent re-run, Windows chmod-warning branch, env-var detection helper
- `scripts/lib/exec.mjs`: shared `Exec` / `ExecResult` types and `realExec` (removes the duplication between `doctor.mjs` and `base-branch-resolver.mjs`)
- `scripts/lib/finding-validator.mjs`: `parseFinding` boundary validator for raw agent output (drops findings below the confidence floor, throws on malformed shapes)
- `scripts/render-summary.mjs`: standalone CLI that reads `FINDINGS_JSON` and writes the Review Summary markdown — replaces the cross-platform-fragile inline `node -e` snippet in `commands/review-pr.md`
- `doctor.mjs` exports `mapPingError`, `PING_TIMEOUT_MS`, `AZ` for unit testing
- `commands/review-pr.md` Step 3 includes a large-diff (`git diff --shortstat`) sanity check before fanning out to the agent
- `commands/review-pr.md` Steps 4 and 5 now require the orchestrator to relay `render-summary` stderr verbatim and to stop on non-zero exit (so silently-dropped or malformed findings cannot be hidden from the user)
- `commands/review-pr.md` Pre-PR flow gains Step 3.5 (prompt for optional Work Item / Confluence URLs, Enter to skip) and Step 3.6 (spawn the Intent Checker, hard-stop on unreachable promised intent); Step 4 broadcasts the Intent Brief verbatim to every spawned aspect agent; Step 5 forwards `intentCheck` via `INTENT_CHECK_JSON`
- `scripts/render-summary.mjs` reads optional `INTENT_CHECK_JSON`, validates/drops malformed items, and forwards the survivors so the renderer surfaces the Intent Check block
- `agents/intent-assessor.md` (**Themis**): dedicated agent that assesses each Acceptance Criterion for diff **coverage** (not quality) and returns the `intentCheck` skeleton with live `addressed` / `partially addressed` / `unaddressed` verdicts; preserves item/AC structure exactly and passes note-bearing/unfetchable items through verbatim. Not a Review Aspect — spawned by intent presence, never added to `SPAWN_TABLE` (ADR-0011)
- `tests/render-summary.test.mjs`: 8 integration tests covering missing env var, malformed JSON, non-object root, sub-threshold drop, malformed-finding drop with stderr, and well-formed rendering
- `tests/doctor.test.mjs`: 199 / 299 / 300 HTTP boundary tests pinning `isPingOk`
- Intent gathering for Pre-PR mode (issue #147): `scripts/atlassian-fetch.mjs` routes pasted URLs by path (`/browse/` → Jira, `/wiki/` → Confluence), fetches Work Items and Confluence pages via the Atlassian REST APIs with built-in `fetch`, parses Story ACs and Bug repro/expected/actual from ADF, and extracts linked Confluence URLs — credentials via `lib/credentials.mjs`
- `agents/intent-checker.md` (**Ariadne**): fetches the pasted URLs, synthesises an Intent Brief, emits per-AC verdicts, and signals a hard-stop when a promised Confluence page is unreachable (ADR-0004)
- `tests/atlassian-fetch.test.mjs`: covers URL routing, key/page-id extraction, credential resolution (env vs file), Story/Bug ADF parsing, Confluence excerpt + link extraction, fetch-error classification, and the `collectIntent` / `main` output shape with `fetch` stubbed
- `tests/render-summary.test.mjs`: Intent Check rendering above the Severity sections, omission on empty/absent intent, and malformed `INTENT_CHECK_JSON` handling
- `commands/review-pr.md` orchestrator wires the live-verdict path end-to-end (renumbered to integer Steps 1–8): Step 6b spawns the Intent Assessor in the parallel fan-out batch when an Intent Brief is defined and the skeleton is non-empty; Step 7 runs the overlay merger, raises a Reviewer-facing Notice when zero verdicts applied, writes a maintainer-facing stderr diagnostic naming the drift class on any drop, and forwards the merged `items` to the renderer
- `scripts/lib/intent-check-merger.mjs` gains a CLI entry (`SKELETON_JSON` / `ASSESSED_JSON` → `{ items, diagnostics }` on stdout) so the orchestrator can shell out cross-platform; the merge logic is unchanged
- `scripts/lib/notices.mjs` gains the `unassessedIntentCheck` `NoticesContext` field and render block (Reviewer Notice when the Intent Check block degraded to all-`unaddressed`), with unit tests in `tests/notices.test.mjs`
- `scripts/render-summary.mjs` reads optional `NOTICES_JSON`, renders it via `renderNotices`, and forwards the block to the renderer
- ADO first-review preview (issue #148): `providers/` Source Platform Provider abstraction (ADR-0010) — `providers/index.mjs` exposes `detectProvider(url)`; the `providers/azure_devops/` folder bundle ships `provider.mjs` (`prUrlPattern`, `parsePrUrl`, `discoverWorkItems` reading the PR's native `workItemRefs`, registered `agents.{fetcher,writer}`), `manifest.json`, `README.md`, co-located fixtures, and unit tests
- `agents/ado-fetcher.md` (**Hermes**): reads PR data from Azure DevOps via `az devops invoke` (PR metadata, Revisions, Threads, changed-file list) and caches reviewer identity once per run; read-only, never writes to ADO. Line-level diff is deferred in this preview — `rawDiff` is returned empty with a warning, and the orchestrator skips the diff-driven aspect fan-out when it is empty
- `agents/intent-checker.md` (Ariadne) accepts a `workItems` input alongside `pastedUrls` and fetches ADO Work Items via `az boards work-item show`, extracting linked Confluence pages — work-item discovery stays a Provider contract (ADR-0001 amendment)
- `commands/review-pr.md` Step 1 replaces the "ADO mode not yet supported" stub with the full ADO first-review flow (provider detection → URL parse → ADO Fetcher → Work Item discovery → Intent Checker → aspect fan-out → terminal preview); no writes
- `tests/ado-cli-smoke.test.mjs`: asserts `az devops invoke` calls and `fixtures/ado-cli-inventory.json` agree in both directions, so the inventory cannot advertise an invoke call the fetcher never makes
- `providers/azure_devops/provider.mjs`: `discoverWorkItems` throws on non-object input (instead of silently yielding zero Work Items) and the `discover-work-items` CLI rejects a missing stdin pipe rather than hanging
- ADR-0010 (Provider folder bundle) accepted and ADR-0001 amended (provider-owned work-item discovery)
- `agents/ado-fetcher.md` Step 6/7: emits `diffUnavailable: true` in the result envelope whenever line-level diff is deferred, making the "not a clean review" signal machine-checkable
- `scripts/lib/notices.mjs` gains the `diffUnavailable` `NoticesContext` field and render block (Reviewer Notice when line-level diff was unavailable and diff-driven agents did not run), with unit tests in `tests/notices.test.mjs`
- `commands/review-pr.md` Step 1.8 guard keys off `FETCHER_OUTPUT.diffUnavailable` (structural flag) instead of prose-testing `rawDiff` emptiness; Step 1.9 always forwards `NOTICES_JSON` when `diffUnavailable` is `true` so the renderer structurally guarantees the notice

### Changed

- `PingResult` is now a discriminated union (`{ kind: 'http' } | { kind: 'transport-error' }`) so callers cannot conflate transport failures with HTTP responses
- `ModeContext` is a discriminated union mirroring the four-row decision table — nonsense input combinations are unrepresentable
- `ReviewSummaryContext` collapses `criticalFindings` / `importantFindings` / `minorFindings` into a single `findings: SummaryFinding[]` with a `severity` field; the renderer buckets internally
- `IntentCheckItem.verdicts` value type is now `'addressed' | 'unaddressed' | 'partially addressed'` — the third value matches the user-facing phrasing the renderer surfaces verbatim (PRD § Schema: Review Summary), replacing the earlier `'partial'`
- `realPing` maps `TimeoutError` to a friendly `Request timed out after 10s` so doctor output is consistent across Node versions
- `bucketBySeverity` throws on non-finite or out-of-range confidence inputs instead of silently returning `null`
- `analyseChangedFiles` and `resolveBaseBranch` validate their inputs at the boundary and throw on misuse
- `renderInlineComment` treats a whitespace-only `suggestion` as absent
- `agents/code-reviewer.md` JSON schema drops the unused `endLine` field
- `agents/code-reviewer.md` no longer assesses Acceptance Criteria — Step 3 (AC verdict logic) removed to prevent double-counting now that the Intent Assessor (Themis) owns verdicts
- `scripts/lib/intent-check-merger.mjs`: pure, context-free `mergeIntentCheck(skeleton, assessed)` overlays the Intent Assessor's verdicts onto the Intent Checker skeleton (the structural source of truth), validating each verdict via the renderer's `isAcVerdict` (ADR-0011, US 13). Returns `{ items, diagnostics }` where `diagnostics` carries mechanical counts (`assessedReceived`, `applied`, `droppedElements`, `rejectedVerdicts`, `unmatchedItems`) so the orchestrator can warn the Reviewer with a Notice when zero verdicts were applied and log a maintainer-facing stderr diagnostic on any drop — verdict provenance is surfaced rather than silently lost (ADR-0011 §Consequences, PR #168 review)
- `commands/review-pr.md` Steps 6a/6b promoted to top-level Steps 6 and 7;
  prior Steps 7 and 8 renumbered to 8 and 9 respectively

### Fixed

- `commands/review-pr.md` large-diff guidance no longer suggests a non-existent `--base` flag; it now advises splitting the branch and notes the base branch is auto-resolved (ADR-0009) with no per-run override
- Test runner now executes credentials.test.mjs in addition to doctor.test.mjs
- doctor stays fully silent about Jira when jiraUrl is not configured (US-35)
- realPing degrades gracefully when given a malformed URL instead of crashing the doctor
- credentials loader distinguishes file-read errors from JSON-parse errors
- review-pr command frontmatter allows the `Agent` tool so the code-reviewer sub-agent can be spawned
- JSDoc and prose comments across `signature.mjs`, `notices.mjs`, `base-branch-resolver.mjs`, `changed-file-analyser.mjs`, and `review-summary-renderer.mjs` reworded to match runtime behaviour
- `tests/doctor.test.mjs` covers the `mapPingError` timeout path and asserts the `AZ` binary selector matches `process.platform`
- `writeConfluenceCreds` preserves all existing fields on token rotation (not just `jiraUrl`) and only swallows JSON syntax errors — EACCES and other read errors now propagate instead of silently dropping data
- Setup scripts and doctor guard their main-module check against `process.argv[1]` being unset, so they can be imported without crashing in `pathToFileURL(undefined)`
- `parseArgs` now throws on a flag with no value (last arg, or followed by another flag) instead of silently dropping it; setup scripts catch the throw and emit a clear `setup-<name>: --<key> requires a value` error
- Setup scripts write credential files atomically (write-to-tmp, chmod, rename) so an interrupted write cannot leave a truncated file in place of the user's credentials
- Setup scripts now: include an `icacls` example in the Windows chmod-skipped warning; surface a clear error when `os.homedir()` is empty instead of writing to the current directory; and print only `err.message` (not `err.stack`) for unexpected errors, avoiding the risk of leaking argv values into stderr stack frames
- `changed-file-analyser`: `.d.ts` declaration files no longer count as runtime source files (they no longer spawn `silent-failure-hunter` or count toward the `code-simplifier` threshold) — they remain type files that spawn `type-design-analyzer`
- `changed-file-analyser` CLI: stdin parsing is CRLF-safe (`/\r?\n/` split + per-line trim) so trailing carriage returns on Windows no longer break extension/path matching
- README quick-start and commands table now match the actual review-pr contract — Pre-PR mode (no URL) is documented as the working path; ADO PR URL support marked coming soon
- ADR-0008 Decision narrative reconciled with the implemented spawn predicate — silent-failure-hunter spawns on any non-test source file (path/extension heuristic), matching the Spawn Table
- All six aspect agent prompts now describe their output as a JSON object (matching the Output format section) instead of a JSON array, reducing non-parseable-output risk
- `changed-file-analyser` CLI: the stdin end-handler now wraps `Buffer.concat` + `parseStdin` in the `try`/`catch`, so any synchronous failure surfaces as the tagged `changed-file-analyser:` error + exit 1 instead of an uncaught stack trace
- ADR-0008 spawn table now notes the `.d.ts` exclusion for source-file rows; review-pr command body tool name aligned with the `Agent` frontmatter
- `render-summary` no longer crashes on an `IntentCheckItem` whose `verdicts` is `null` (or an array, or whose `id`/`title` is not a string): validation now requires a non-null plain object so malformed items are dropped with a stderr note instead of throwing in `Object.entries` (PR #159 review)
- `atlassian-fetch` reports an unrecognised pasted URL (e.g. an ADO Boards link, not yet supported on this path) as a soft `unsupported` error instead of only warning to stderr, so the Intent Checker can surface it to the reviewer rather than producing silent empty intent (PR #159 review)
- Intent-gathering hard-stop message in `commands/review-pr.md` no longer claims the URL "is unreachable" when the cause may be rejected credentials — it now reads "could not be fetched (unreachable, or its credentials were rejected)" since the hard-stop covers both `unreachable` and `auth-error` (PR #159 review)
- `collectIntent` no longer breaks its documented "never throws" contract when the credential file exists but is unreadable or malformed: the loader call is now guarded and a corrupt config surfaces as a global `auth-error` entry (exit 1) instead of an uncaught exception (PR #159 review, Step 4)
- `render-summary` now drops an `IntentCheckItem` whose `verdicts` contains an off-spec value (object, number, typo) with a stderr note instead of rendering garbage like `AC 1: [object Object]` into the PR summary; verdict values are validated against the single `AC_VERDICTS` source of truth exported from `review-summary-renderer.mjs` (PR #159 review, Step 4)
- `review-summary-renderer.mjs` now renders the optional `IntentCheckItem.note` (e.g. "Item could not be fetched.") that the Intent Checker emits for unreachable/parse-error items — previously the note was silently dropped (PR #159 review, Step 4)
- Stale `collectIntent` JSDoc ("Unrecognised URLs are warned and skipped") corrected to describe the soft `unsupported` error it now records; dropped-`IntentCheckItem` stderr warnings now name the offending `id` (PR #159 review, Step 4)
- `mergeIntentCheck` no longer throws when a non-empty `assessed` array contains `null`, `undefined`, non-object, or `id`-less elements: the id→item map is now built defensively (only non-null objects with a string `id`), so malformed Assessor output degrades gracefully to the skeleton's `unaddressed` verdicts instead of crashing. Dropped elements, rejected verdicts, and unmatched ids are now **counted** in the returned `diagnostics` rather than silently swallowed, so the degradation is observable (PR #168 review)

## [2.0.0] — 2026-05-28

### Added

- Plugin scaffold: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `tsconfig.json`
- Domain vocabulary in `CONTEXT.md` (Plugin, Review, Finding, Confidence, Severity, Intent Brief, Intent Check, Bot Signature, Iteration, Approval Loop, Mode, Provider, Work Item, Notice)
- `/unic-pr-review:doctor` slash command (`commands/doctor.md`)
- `scripts/doctor.mjs`: six preflight checks — `az` CLI, `azure-devops` extension, `az devops` login, `az devops user show --user me` identity (for ADR-0006 caching), Confluence reachability, Jira reachability (silent when `jiraUrl` is unset per US 35)
- `scripts/lib/credentials.mjs`: shared loader for `~/.unic-confluence.json` and `~/.unic-azure.json` with env-var overrides
- `tests/doctor.test.mjs`: unit tests for all six predicates with stubbed executors and fetchers
