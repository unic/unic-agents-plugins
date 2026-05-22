# 0016. Fold thread fetch into ADO Fetcher

**Status:** Accepted (2026-05)
**Context:** Amends ADR 0013 (orchestrator split for review-pr)
**Date:** 2026-05-14

## Context

ADR 0013 split `review-pr.md` into a thin orchestrator and focused agents. As part of that split, ADR 0013 carved out **one allowed inline ADO call**: the mode-detection `az repos pr thread list` in the orchestrator's Step 4. The justification was that mode detection had to happen _before_ the ADO Fetcher could be launched, so the orchestrator needed to fetch and inspect threads itself.

Two facts surfaced after shipping the split:

1. **The carved-out command is invalid syntax.** `az repos pr thread list` does not exist in the `azure-devops` extension — valid `az repos pr` subcommands are `create / list / show / update / work-item / set-vote / reviewer / policy / checkout`. There is no `thread` group. The correct call is `az devops invoke --area git --resource pullRequestThreads --route-parameters …`. Every ADO PR review since the orchestrator-split shipped has been failing at Step 4. The first observed-in-the-wild failure is the 2026-05-14 dry-run captured in `docs/conversations/pr-review-dry-run-01.txt`.

2. **The "fetch threads → derive mode" pair is naturally adjacent to the rest of the Fetcher's work.** The Fetcher already calls `az devops invoke` for `pullRequestIterations`, `pullRequestIterationChanges`, `pullRequestWorkItems`. Adding `pullRequestThreads` to that family keeps ADO read knowledge in one place — the agent that exists exactly to own it.

The carve-out can go away if the Fetcher returns `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`, and `RAW_THREADS_JSON` in its structured result block. The orchestrator branches on those fields in Step 5 onwards — the same pattern it already uses for `WORK_ITEM_IDS`, `DIFF_RANGE`, etc.

## Decision

**Move thread fetching and mode detection from the orchestrator into the ADO Fetcher.** The Fetcher gains a new step (Step 2.5) between iterations fetch and changed-files fetch:

1. Call `az devops invoke --area git --resource pullRequestThreads --route-parameters "project=$PROJECT" "repositoryId=$REPO_ID" "pullRequestId=$PR_ID"`.
2. Apply ADR 0015's HTTP-tier mapping: 401/403 → ABORTED; 404 → OK (treat as empty threads; equivalent to first-review); 5xx / network → DEGRADED with `kind: thread-fetch`, treat as empty threads so mode detection still produces `first-review`.
3. Run `detectMode` (from `scripts/mode-detection.mjs`, unchanged) on the response's `.value` array. The function returns `{ mode, isRereview, priorIterationId, summaryThreadId }`.
4. Append `RAW_THREADS_JSON`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID` to the Fetcher's result block.

The orchestrator's Step 4 simplifies to a single `az repos pr show` call that captures PR metadata (`REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION`) and passes them into the Fetcher as inputs. The Fetcher no longer makes its own `az repos pr show` call — the data is already in its prompt.

After this change, the orchestrator contains **no `az devops invoke` calls**. The only remaining inline `az` is `az --version`, `az extension list` (Step 3 preflight), and `az repos pr show` (Step 4 metadata).

ADR 0013's carve-out (_"The one allowed inline ADO call is the mode-detection `az repos pr thread list` in the mode detection block"_) is **removed**. ADR 0013's core decision — thin orchestrator + focused agents — stands; only that one-sentence exception is superseded by this ADR.

## Alternatives considered

**Fix the inline command in Step 4 and leave it in the orchestrator.** Smallest change. Rejected because it preserves the architectural reason for the carve-out (mode detection must precede Fetcher launch) which doesn't actually exist — the orchestrator can equally well branch on Fetcher output. Keeping ADO knowledge in two places means future API changes require edits in two files.

**Introduce a separate `mode-detector` agent that fetches threads.** Cleaner separation of concerns. Rejected because mode detection and the rest of the Fetcher's work share the same ADO call shape (`az devops invoke --area git --resource …`); a new agent would duplicate the auth/retry/error-classification setup the Fetcher already has.

**Replace `az` with direct REST calls.** Long-discussed in ADR 0008's neighbourhood. Out of scope for this ADR; revisit if `az` proves a recurring failure source after spec 14's smoke test catches near-term drift.

## Consequences

- The plugin's mode-detection path actually works (Step 4 was previously broken on every run).
- ADO read knowledge is centralised in `ado-fetcher.md`.
- Adding new mode-affecting ADO data (e.g. a `mergeAttempt` field) requires editing one agent prompt.
- The Fetcher's result block grows by five lines — downstream prompts (Coordinator, Writer) parse them via existing string-extraction patterns, no helper change.
- ADR 0013's status line is updated to `Accepted (2026-05), amended by 0016`.

## See also

- ADR 0013 — Orchestrator split for review-pr (amended)
- ADR 0014 — Notice Tier doctrine (governs the new `kind: thread-fetch` DEGRADED path)
- ADR 0015 — Canonical HTTP-tier mapping (governs the 401/403/5xx behaviour for thread fetch)
- Spec 12 — Implementation of this ADR
