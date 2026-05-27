# 02. `dry-run-rereview` end-to-end

**Status:** ready-for-agent
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`
**Type:** AFK

## Parent

`apps/claude-code/pr-review/docs/issues/pr-review-dry-run-mode/PRD.md` — [#136](https://github.com/unic/unic-agents-plugins/issues/136)

## What to build

Extend Slice 01's dry-run path to the `IS_REREVIEW=true` half of the matrix. After this slice, `/pr-review:review-pr <re-review-eligible-URL> --dry-run` runs Thread Classification and surfaces both the fresh-findings preview and a per-thread planned-actions block, all without writing to Azure DevOps — neither the Writer nor the Coordinator's own `az devops invoke` posting blocks fire.

Slice 01's parser, MODE matrix scaffolding, and `formatTrailer` branching are reused. This slice's additions are scoped to the Re-review Coordinator, the orchestrator's dry-run-rereview rendering path, and the dry-run trailer's earlyExit behaviour.

- **Orchestrator MODE resolution (`commands/review-pr.md`, Step 5).** Extend the `IS_DRY_RUN × IS_REREVIEW` matrix to cover the remaining rows:

  | `IS_DRY_RUN` | `IS_REREVIEW` | `MODE`              |
  | ------------ | ------------- | ------------------- |
  | `false`      | `true`        | `re-review`         |
  | `true`       | `true`        | `dry-run-rereview`  |

  Combined with Slice 01, all four cells are now wired. `pre-pr` continues to short-circuit at Step 2 when no URL is provided.

- **Orchestrator Step 7 — Coordinator invocation in dry-run-rereview.** For `MODE=dry-run-rereview`, invoke the Coordinator with the same prompt shape as `re-review`, plus the new `MODE` input (see below). Do **not** invoke the ADO Writer afterwards. Parse `plannedActions` from the Coordinator's result block alongside `earlyExit`, `freshFindings`, `NOTICES`.

- **Re-review Coordinator (`agents/re-review-coordinator.md`) — `MODE` input.** Accept a new `MODE` input alongside the existing `ADO_FETCHER_RESULT`, `RAW_THREADS_JSON`, `FINDINGS`, `SIGNATURE_PREFIX`, `PLUGIN_ROOT`. The orchestrator passes `MODE: re-review` or `MODE: dry-run-rereview` verbatim.

- **Re-review Coordinator — gate the three posting blocks.** Wrap each of the agent's three `az devops invoke` write blocks (new-evidence reply at the `pending → post new-evidence reply` branch, dispute acknowledgement at the `disputed → post dispute acknowledgement` branch, and PATCH-to-fixed at the `addressed → PATCH thread status to fixed` branch) in a single outer guard: write only when `MODE = re-review`. In `dry-run-rereview`, Thread Classification still runs and `freshFindings` still populates exactly as today; no `az devops invoke` writes fire.

- **Re-review Coordinator — `plannedActions` emission.** The Coordinator's `RE_REVIEW_COORDINATOR_RESULT_START/END` block grows a new field:

  ```
  plannedActions: [{ threadId: number, action: 'patch-to-fixed' | 'reply-new-evidence' | 'reply-dispute-ack' | 'skip', reason: string }]
  ```

  The agent emits the same per-thread classifications it already computes internally. The field is populated in **both** `re-review` and `dry-run-rereview` modes (no-op cost in `re-review` — the orchestrator only consumes it in dry-run-rereview, but emitting it always keeps the contract symmetric and makes future testing easier).

- **Orchestrator dry-run-rereview rendering.** For `MODE=dry-run-rereview`, after the Coordinator returns:

  1. Print `formatNoticesAsPrePrPreamble(fetcherNotices + coordinatorNotices)`. Elide if empty.
  2. If `plannedActions` is non-empty, inline-render the "Planned thread actions" block:

     ```
     Planned thread actions (would not execute in dry-run):
       #<threadId>  <classification> → <action label>
       …
     ```

     where `<classification>` is the underlying Thread Classification state (`addressed` / `pending` / `disputed`) inferred from the action, and `<action label>` is one of `PATCH to fixed`, `new-evidence reply`, `acknowledgement reply`, `skip (no new evidence)`. Rendering is inline orchestrator prose — no new render helper. Elide the entire block when `plannedActions` is empty.

  3. Print severity-grouped findings (Pre-PR Step E format) using `freshFindings` only.
  4. Print Trailer via `formatTrailer({ mode: 'dry-run-rereview', findings, notices: fetcherNotices+coordinatorNotices, prUrl, plannedActionsCount })`.

- **`scripts/ado/notices.mjs` — `formatTrailer` accepts `dry-run-rereview`.** Same branch as `dry-run-first` from Slice 01; collapse both internally to one rendering path. `<A>` (planned thread actions count) is now non-zero in this MODE. Pass `plannedActionsCount` through `input` — the field is already a `number`, no contract surprise. (If you prefer, derive `<A>` from `input.plannedActions` directly; choose whichever keeps the existing `FindingCounts` / `Notice` shape vocabulary in `formatTrailer`'s JSDoc consistent.)

- **Orchestrator earlyExit-prints-Trailer in dry-run-rereview.** Today the orchestrator stops silently on Coordinator `earlyExit: true` (the no-new-revisions path). In **dry-run-rereview only**, instead of stopping silently, print the Trailer with `0 findings · 0 planned thread actions · …` and the PR URL still present. `re-review`'s identical silent-on-earlyExit path is **not** changed in this slice (it stays as a pre-existing UX gap — see PRD Out of Scope).

- **`tests/notices.test.mjs` — coverage for the new MODE.** Three cases at minimum: (1) `dry-run-rereview` with mixed findings + non-zero `plannedActions` + warnings → assert exact trailer including `<A>` non-zero; (2) `dry-run-rereview` zero-everything (the earlyExit shape) → assert the all-zero-segment line still includes the PR URL; (3) `dry-run-rereview` with zero fresh findings but non-zero `plannedActions` → assert `<N>=0` and `<A>` correct (covers the "purely-resolves-old-threads" preview shape).

- **CHANGELOG.** Update Slice 01's `[Unreleased] ### Added` entry to also mention re-review-eligible PRs and the planned-actions block. One paragraph, single entry.

End-to-end demoable: `/pr-review:review-pr <re-review-eligible-URL> --dry-run` renders Notices preamble + Planned thread actions block + severity-grouped fresh findings + `🔍 Dry-run complete: …` Trailer; `az devops invoke --resource pullRequestThreadComments` is never called; no PATCH-to-fixed; no replies. The same URL without `--dry-run` continues to post replies and PATCH thread statuses exactly as today.

## Acceptance criteria

- [ ] `commands/review-pr.md` Step 5 (MODE resolution) covers all four matrix cells; `IS_DRY_RUN=true / IS_REREVIEW=true → MODE=dry-run-rereview`.
- [ ] `commands/review-pr.md` Step 7 invokes the Re-review Coordinator for both `re-review` and `dry-run-rereview` MODEs, but invokes the ADO Writer **only** for `re-review` and `first-review`.
- [ ] `commands/review-pr.md` parses `plannedActions` from the Coordinator's result block alongside `earlyExit`, `freshFindings`, `NOTICES`.
- [ ] `commands/review-pr.md` inline-renders the Planned thread actions block when `plannedActions` is non-empty and `MODE=dry-run-rereview`; elides it otherwise.
- [ ] `commands/review-pr.md` prints the `🔍 Dry-run complete: …` Trailer on Coordinator `earlyExit: true` in dry-run-rereview (PR URL present, all counts `0`).
- [ ] `commands/review-pr.md` is ≤ 200 lines (orchestrator-thin invariant from ADR 0013).
- [ ] `agents/re-review-coordinator.md` accepts a `MODE` input documented in its inputs list.
- [ ] `agents/re-review-coordinator.md` wraps the new-evidence reply, dispute acknowledgement, and PATCH-to-fixed blocks in `MODE = re-review` guards. No `az devops invoke` write calls fire in dry-run-rereview.
- [ ] `agents/re-review-coordinator.md` documents `plannedActions` in the `RE_REVIEW_COORDINATOR_RESULT` block schema and emits it in both `re-review` and `dry-run-rereview` modes.
- [ ] `scripts/ado/notices.mjs` `formatTrailer` accepts `mode: 'dry-run-rereview'` and renders the documented line, including the non-zero `<A> planned thread actions` segment when applicable.
- [ ] `tests/notices.test.mjs` covers the three `dry-run-rereview` cases above.
- [ ] `CHANGELOG.md`'s `[Unreleased] ### Added` entry is updated to mention re-review-eligible PRs and the planned-actions preview.
- [ ] `pnpm format`, `pnpm check`, `pnpm --filter pr-review test`, `pnpm --filter pr-review verify:changelog` all pass.
- [ ] No new `az` invocations are introduced (`tests/fixtures/ado-cli-inventory.mjs` is unchanged).
- [ ] Re-review behaviour (no flag) is byte-identical to before this slice: same posts, same PATCHes, same replies. Verified by re-running the existing `tests/classify-thread.test.mjs` / `tests/match-finding.test.mjs` suites plus a manual smoke against a sandbox PR.

## Blocked by

- [#137](https://github.com/unic/unic-agents-plugins/issues/137) — Slice 01 (`dry-run-first` end-to-end). Parser, MODE matrix, `formatTrailer` `dry-run-*` branch, and AGENTS.md doctrine fix all land in Slice 01 and are reused here.
