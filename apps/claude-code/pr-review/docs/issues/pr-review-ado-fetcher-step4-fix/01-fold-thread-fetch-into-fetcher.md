# 01. Fold thread fetch + mode detection into ADO Fetcher

**Status:** ready-for-agent
**Category:** bug
**Plugin:** `apps/claude-code/pr-review`
**Type:** AFK

## Parent

`apps/claude-code/pr-review/docs/issues/pr-review-ado-fetcher-step4-fix/PRD.md`

## What to build

Move thread fetching and mode detection from the orchestrator's Step 4 into the ADO Fetcher, per [ADR 0016](../../adr/0016-fold-thread-fetch-into-ado-fetcher.md) (already merged). The bug is currently live: every ADO PR review fails at Step 4's invalid `az repos pr thread list` invocation; the LLM-as-orchestrator improvises around it, masking the failure.

Implementation cuts through every layer:

- **Orchestrator (`commands/review-pr.md`)** — replace Step 4's `az repos pr thread list` block with a single `az repos pr show --id "$PR_ID" --org "$ORG_URL" --output json` call. Parse `repository.id`, `repository.project.name`, `sourceRefName`, `targetRefName`, `title`, `description` into `REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION` (stripping `refs/heads/`). Pass these into the Fetcher's prompt. Step 5 parses `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`, `RAW_THREADS_JSON` from the Fetcher's result block. The orchestrator must contain **no `az devops invoke` calls** after this slice — only `az --version`, `az extension list`, `az repos pr show`.

- **ADO Fetcher (`agents/ado-fetcher.md`)** — accept the new inputs (`REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION`) as literal-string inputs in the prompt. Remove the existing Step 1 (`az repos pr show`) since metadata is now passed in. Insert a new step between iterations and changed-files: fetch threads via `az devops invoke --area git --resource pullRequestThreads --route-parameters "project=$PROJECT" "repositoryId=$REPO_ID" "pullRequestId=$PR_ID" --org "$ORG_URL" --api-version "7.1" --output json`. Apply ADR 0015's HTTP-tier mapping via `scripts/ado/classify-http-error.mjs`: `401/403` → ABORTED with `az devops login` hint; `404` → OK, treat `RAW_THREADS_JSON` as `{"value":[]}`; `5xx / network` → DEGRADED Notice with `kind: thread-fetch`, treat as empty threads. Run `detectMode` from `scripts/mode-detection.mjs` against `.value`. Extend the `ADO_FETCHER_RESULT_START/END` block with `RAW_THREADS_JSON`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`.

- **`scripts/mode-detection.mjs`** — export a `SIGNATURE_PREFIX` constant: `export const SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'`. Update the Fetcher to import it directly. Remove the stale `az repos pr thread list` reference in the module's comment (line 27).

- **`scripts/ado/notices.mjs`** — add `thread-fetch` to the `NoticeKind` union.

- **Re-review Coordinator (`agents/re-review-coordinator.md`)** — update the `RAW_THREADS_JSON` description (line 27) and the "No re-fetch of threads" note (line 471) to reflect that the data now flows from the Fetcher's output block via the orchestrator, not from the (broken) orchestrator-level `az repos pr thread list`.

- **ADR 0013 status line** — already not yet amended; update to `Accepted (2026-05), amended by 0016`.

- **CHANGELOG** — `[Unreleased]` `### Fixed` entry: _Step 4 mode detection was calling a non-existent `az repos pr thread list` subcommand and failing fatally on every ADO PR review. Thread fetching now lives in the ADO Fetcher and uses `az devops invoke --resource pullRequestThreads`._

End-to-end demoable: `/pr-review:review-pr <fresh PR URL>` runs cleanly with `MODE: first-review` in the Fetcher output. `/pr-review:review-pr <PR with prior bot signature>` runs cleanly with `MODE: re-review`, `IS_REREVIEW: true`, and a non-empty `PRIOR_ITERATION_ID`. No `az repos pr thread list` anywhere in the source tree outside `docs/conversations/`.

## Acceptance criteria

- [ ] `grep -rn "az repos pr thread list" agents/ commands/ scripts/ tests/` returns no matches.
- [ ] `commands/review-pr.md` contains no `az devops invoke` lines.
- [ ] `commands/review-pr.md` Step 4 captures `REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION` from `az repos pr show` and passes them into the Fetcher prompt.
- [ ] `commands/review-pr.md` is ≤ 200 lines (orchestrator-thin invariant from ADR 0013).
- [ ] `agents/ado-fetcher.md` contains a step that calls `az devops invoke --area git --resource pullRequestThreads` and invokes `detectMode`.
- [ ] `agents/ado-fetcher.md` no longer calls `az repos pr show`.
- [ ] The Fetcher's result block emits `RAW_THREADS_JSON`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`.
- [ ] On 5xx/network on the threads endpoint, the Fetcher emits a `warning`-severity Notice with `kind: thread-fetch` and proceeds with `MODE: first-review`.
- [ ] On 401/403 on the threads endpoint, the Fetcher aborts with an `az devops login` hint.
- [ ] On 404 on the threads endpoint, the Fetcher proceeds with `RAW_THREADS_JSON={"value":[]}` and `MODE: first-review`.
- [ ] `scripts/mode-detection.mjs` exports `SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'`.
- [ ] `tests/mode-detection.test.mjs` includes a case asserting `SIGNATURE_PREFIX === '🤖 *Reviewed by Claude Code*'`.
- [ ] `agents/re-review-coordinator.md` no longer references `az repos pr thread list` as the source of `RAW_THREADS_JSON`.
- [ ] `apps/claude-code/pr-review/docs/adr/0013-orchestrator-split-for-review-pr.md` status line ends with `, amended by 0016`.
- [ ] `CHANGELOG.md` under `[Unreleased]` has a `### Fixed` entry describing the Step 4 bug fix and the fold-into-Fetcher refactor.
- [ ] `pnpm format`, `pnpm check`, `pnpm --filter pr-review test`, `pnpm --filter pr-review typecheck`, `pnpm --filter pr-review verify:changelog` all pass.

## Blocked by

None — can start immediately.
