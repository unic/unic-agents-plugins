# PRD: pr-review — platform-failure handling

**Status:** needs-triage
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`
**Depends on:** `docs/issues/pr-review-ado-fetcher-reliability/PRD.md` (PRD A — must land first)

---

## Problem Statement

After PRD A lands, the four-tier Notice doctrine is established and the ADO Fetcher is correct, but the rest of the plugin still swallows platform failures in three places. The Re-review Coordinator silently downgrades to first-review mode when its match-finding helper throws (duplicating every prior thread); its PATCH-to-fixed call has a catch-all that only special-cases HTTP 409 (silently letting 401/403/5xx through as 200-char "warnings" no one reads). The ADO Writer's inline POST path captures stderr to `*.err` files but only logs them on cleanup — the actual failure text never reaches the user, and 401/403 are treated like recoverable per-finding failures. Pre-PR mode's diff parser returns `[]` for both empty diffs and malformed inputs, so a broken pipeline looks like a clean Review. The default-branch fallback chain still hardcodes `main` even though most Unic projects use Gitflow.

These are not isolated bugs — they are the same doctrine PRD A established, not yet applied across the remaining surfaces. PRD B finishes the job by routing every ADO write call site through PRD A's canonical helpers, extending the Coordinator's classification helpers to honour `DIFF_RANGE`, and giving Pre-PR mode the same Notice surface that the ADO modes get.

## Solution

Apply the Notice Tier doctrine + helper-layer doctrine (both from PRD A) to the Re-review Coordinator, ADO Writer, and Pre-PR mode. The shared helpers (`classify-http-error`, `notices`, `parse-write-response`) own all classification; the agent prompts shrink to "call the helper, branch on `result.ok`".

The Coordinator consumes the `DIFF_RANGE` sentinel PRD A emits: when `full`, the existing `classify-thread` helper downgrades verdicts that depend on diff position (`addressed`, `obsolete`) to the safer `pending`; `disputed` is unaffected. A DEGRADED Notice surfaces the downgrade. The Coordinator's per-finding match call wraps `match-finding` in try/catch and emits a DEGRADED Notice on throw, instead of silently treating the parse failure as "no match" and duplicating the thread. PATCH-to-fixed routes every response through the canonical HTTP-tier mapping — 401/403 abort the whole re-review, 5xx/network/other-4xx emit per-thread DEGRADED Notices.

The ADO Writer routes every `az devops invoke` POST/PATCH through `parse-write-response` (a new pure helper composing PRD A's `classify-http-error` with response-`id` parsing). The H1 path (inline POST) inherits the canonical mapping retroactively — auth failures no longer log-and-continue, they abort. `*.err` files stream their content to stderr at the moment of failure (so the failure text is adjacent to the Notice that references it), then are unconditionally cleaned up. The `parseAdoWriterResult` helper is refactored to the discriminated-union shape, so the orchestrator can distinguish a missing result block (Writer crashed before printing) from a parsed-with-zero-findings outcome.

Pre-PR mode gets the same Notice surface that PRD A wired for ADO modes. `parseChangedFilesFromDiff` detects a suspicious shape (non-empty input with `diff --git` headers but zero parsed paths) and emits a DEGRADED Notice via `buildPrePrContext`. The default-branch detection becomes a fallback chain (`git remote show origin` → `origin/develop` → `origin/main` → `origin/master` → ABORTED) implemented in a pure helper `scripts/pre-pr/detect-default-branch.mjs`, with a Notice that names the actually-used branch when any fallback level fires.

## User Stories

1. As a PR reviewer in re-review mode, I want the bot to never silently re-post a thread it already opened on a prior iteration, so that my PR's thread list does not accumulate duplicates.
2. As a PR reviewer, I want any HTTP 401 / 403 error from Azure DevOps during write-back to abort the Review with a clear stderr message naming `az devops login` as the remedy, so that the run does not silently complete with most threads missing.
3. As a PR reviewer, I want a per-thread DEGRADED Notice in the Review Summary listing every thread the bot tried to mark as fixed but couldn't (because of a 5xx or network blip), so that I can manually mark them fixed if appropriate.
4. As a PR reviewer in re-review mode with no incremental diff available, I want prior threads that would have been classified `addressed` or `obsolete` to instead be classified `pending`, so that I am never told a comment is resolved when the bot wasn't actually able to verify it.
5. As a developer running Pre-PR mode in a Gitflow-style project, I want the default-branch detection to try `origin/develop` before `origin/main`, so that the local diff is computed against the actual integration branch most of the time.
6. As a developer running Pre-PR mode, I want a Notice telling me which branch the bot diffed against when default-branch detection fell back, so that I can spot the case where it picked the wrong branch.
7. As a Plugin maintainer, I want the ADO Writer's existing H1 inline-POST path (which today logs auth failures and continues) to inherit the canonical HTTP-tier mapping introduced in PRD A, so that 401/403 abort the writer consistently with every other ADO write.
8. As a Plugin maintainer, I want `*.err` file contents to be visible at the moment of failure, not buried in a cleanup step, so that diagnosing a partial-success run does not require reaching for temp files that may have been deleted.
9. As a Plugin maintainer, I want the `parseAdoWriterResult` helper to distinguish "result block missing" (Writer crashed mid-run) from "result block parsed with zero findings" (legitimate zero outcome), so that the orchestrator can fail loud on the first case instead of silently reporting success.
10. As a PR reviewer, I want a Notice telling me when Pre-PR mode's diff parser detected `diff --git` headers but produced zero file paths, so that I can tell the "no files changed" message apart from "the pipeline broke".
11. As a Plugin maintainer, I want the Coordinator's match-finding error path to emit a DEGRADED Notice (`kind: thread-match`) when the helper throws on a parse error, so that the reviewer sees one warning instead of one silent duplicate posting.
12. As a developer reading the codebase, I want every ADO write call site (inline POST, summary POST, delta reply, completion marker, PATCH-to-fixed) to route through one shared helper, so that adding a new write call type in the future inherits the same HTTP-tier mapping for free.
13. As a Plugin maintainer, I want the existing classify-thread and match-finding tests to be extended with the new branches (diffRange parameter; throw on parse error), so that the new behaviour is verified at the helper boundary even though the agent prompts are not unit-tested.
14. As a developer running re-review mode, I want the partial-run check from H4 (already landed in PR #29) to keep its exit-code contract (`0` = found, `1` = not found, `2` = crash); PRD B does not modify that path.

## Implementation Decisions

### Foundation (from PRD A)

All shared helpers (`scripts/ado/classify-http-error.mjs`, `scripts/ado/notices.mjs`) and the Notice flow + Trailer printing in the orchestrator are assumed in place. PRD B only adds consumers and one new shared helper (`parse-write-response.mjs`). The Notice tier doctrine, the canonical HTTP-tier mapping, the four-state classification, and the no-fifth-ASK-tier rule are all documented in PRD A's ADRs (0014, 0015) and the in-place ADR 0004 amendment.

### New helpers

- **`scripts/ado/parse-write-response.mjs`** — pure function composing PRD A's `classify-http-error` with response-`id` parsing. Returns `{ ok: true, id } | { ok: false, tier, kind, message }`. Consumed by every ADO write call site (inline POST, threadContext fallback, summary POST, delta reply, completion marker, PATCH-to-fixed). One shape, one classifier.
- **`scripts/pre-pr/detect-default-branch.mjs`** — pure function over an injectable `branchExists(name) → bool` tester. Walks the fallback chain `git remote show origin HEAD` → `origin/develop` → `origin/main` → `origin/master` → `{ branch: null }`. Returns `{ branch, source: 'remote-show' | 'develop-fallback' | 'main-fallback' | 'master-fallback' | 'none', notice?: Notice }`. The bash side wires the tester to `git rev-parse --verify --quiet`. ABORTED when all four fail.

### Modified helpers

- **`scripts/re-review/classify-thread.mjs`** — adds a `diffRange: 'full' | 'incremental'` parameter. When `diffRange === 'full'`, outputs that would be `addressed` or `obsolete` are remapped to `pending`; `disputed` is unaffected. Default `diffRange === 'incremental'` preserves today's behaviour. Single new branch, ~3 lines.
- **`scripts/re-review/match-finding.mjs`** — today returns `null` on no match. New contract: `null` continues to mean "legitimate no-match"; a thrown `Error` distinguishes a parse failure in the input. The Coordinator's per-finding call wraps in try/catch.
- **`scripts/ado-writer.mjs` (`parseAdoWriterResult`)** — discriminated-union refactor: `{ ok: true, summaryThreadId, findingsPosted } | { ok: false, reason: 'missing-block' | 'malformed' }`. Subsumes today's `null` return.
- **`scripts/pre-pr.mjs` (`buildPrePrContext`, `parseChangedFilesFromDiff`)** — `buildPrePrContext` return shape extends to `{ rawDiff, changedFiles, filteredFiles, notices: Notice[] }`. `parseChangedFilesFromDiff` detects suspicious shape (non-empty input with ≥ 1 `diff --git` header but zero parsed paths) and emits a DEGRADED Notice (`kind: diff-parse`).

### Agent and orchestrator changes

- **`.agents/re-review-coordinator.md`**:
  - Consume `DIFF_RANGE` from `ADO_FETCHER_RESULT`; pass it to `classify-thread`.
  - Wrap per-finding `match-finding` call in try/catch; on throw, push a DEGRADED Notice and continue to the next finding (do NOT add the unclassified prior thread to `freshFindings` — let it fall through naturally to a duplicate posting, but with a Notice surfacing the cause).
  - Route PATCH-to-fixed responses through `parse-write-response`. Tier `aborted` → exit non-zero with the abort kind. Tier `degraded` → push a Notice (`kind: patch-to-fixed`) and continue to the next thread.
  - Emit `NOTICES` array in `RE_REVIEW_COORDINATOR_RESULT_START/END` for the orchestrator to merge.
- **`.agents/ado-writer.md`**:
  - Route every `az devops invoke` POST/PATCH (inline POST, threadContext-fallback, summary POST, delta reply, completion marker) through `parse-write-response`.
  - H1 retroactive fix: the inline POST path inherits the canonical mapping — 401/403 abort the writer immediately, 5xx/network/other-4xx push a `warning` Notice and continue.
  - Stream the `*.err` file content to stderr at the moment of failure, then unconditional `rm -f` in cleanup. No conditional retention.
  - Emit `NOTICES` array in `ADO_WRITER_RESULT_START/END`.
- **`commands/review-pr.md` (Pre-PR mode)**:
  - Wire `detect-default-branch.mjs` (via the existing helper-import pattern). On `branch: null`, abort with stderr message and Trailer aborted line.
  - Use `buildPrePrContext().notices` to prepend the pre-findings Notices block in the Claude interface.
  - Trailer line includes Pre-PR notice counts (already mandatory per PRD A).
  - 200-line cap preserved.

### Test-scope choice

The user explicitly chose "NEW deep modules only" in the test-scope question during the grilling session. PRD B writes unit tests for the two new helpers (`parse-write-response`, `detect-default-branch`). The MODIFY helpers (`classify-thread`, `match-finding`, `parseAdoWriterResult`, `pre-pr.mjs`) get no new unit tests in this PRD; their existing test files stay frozen except for whatever fixture updates the new return shapes force. Behaviour change verification on the MODIFY helpers and on the agent prompts goes to the integration smoke test against a real ADO PR, per ADR 0013's stated testing posture.

## Testing Decisions

### What makes a good test

Same as PRD A: tests assert the external behaviour of each helper given controlled inputs. Plain JS object or short JSON fixtures, sentence-shaped test names, `node:test` + `node:assert/strict`, no external deps.

### Modules under test

**New deep helpers (full unit-test coverage):**

- `scripts/ado/parse-write-response.mjs` — happy path (`{ id: 12345 }` response), 401 → `{ ok: false, tier: 'aborted', kind: 'auth' }`, 5xx → `{ ok: false, tier: 'degraded' }`, 404 → `{ ok: true }` (domain-OK), 409 → `{ ok: true }`, malformed JSON body, network exit-code path, missing `id` field on otherwise-200 response.
- `scripts/pre-pr/detect-default-branch.mjs` — `git remote show` succeeds → no fallback Notice, `develop` exists → `develop-fallback` with Notice, only `main` exists → `main-fallback` with Notice, only `master` exists → `master-fallback` with Notice, nothing exists → ABORTED (no branch, no Notice — Trailer carries the abort), `branchExists` thrown exception → propagated.

### Modules NOT under test in PRD B

Per the user's choice during grilling:

- `classify-thread.mjs` extension (`diffRange` parameter) — verified by integration smoke test.
- `match-finding.mjs` extension (throw-on-parse-error) — same.
- `parseAdoWriterResult` discriminated-union refactor — same.
- `pre-pr.mjs` suspicious-shape Notice — same.
- All agent prompt content (`.agents/*.md`, `commands/review-pr.md`) — same.

### Prior art

Same as PRD A: `packages/release-tools/scripts/verify-changelog.test.mjs`, `bump-version.test.mjs`, `apps/claude-code/pr-review/tests/parse-diff-hunks.test.mjs`. No external deps, no spawnSync, fixtures as inline JS objects.

## Out of Scope

- Anything PRD A delivers (helper layer, canonical HTTP mapping, ADRs, Fetcher fixes, orchestrator Notice merging + Trailer).
- Unit tests for MODIFY-only helpers (`classify-thread`, `match-finding`, `parseAdoWriterResult`, `pre-pr.mjs` suspicious-shape).
- Unit tests for agent prompt content.
- Retries on transient HTTP errors.
- The integration smoke test (manual, post-merge).
- A canonical thread shape spanning ADO and GitHub — deferred per ADR 0013.
- Changes to the four pre-existing re-review modules' interfaces (`detect-prior-review`, `parse-signature`) — only `classify-thread` and `match-finding` are modified, and only additively (new parameter / new throw path).
- Pre-PR mode informational notices for inherently-empty states beyond the Doc Context family — PRD A already capped that.

## Further Notes

**Dependency on PRD A:** PRD B cannot land before PRD A. The helper imports (`classify-http-error`, `notices`, `formatTrailer`), the orchestrator's Notice-merge step, the ADO Writer's `## Notices` block rendering, and the Trailer line are all PRD A deliverables that PRD B's new consumers and modified call sites rely on. The two PRDs ship together as a coherent "platform-failure handling" feature; PRD A is the foundation, PRD B is the rollout.

**Inbox file removal:** the originating `docs/inbox/pr-review-ado-error-hardening-pass.md` is deleted once PRD A and PRD B are published (per the inbox graduation flow documented in `docs/inbox/README.md`).

**Source:** same grilling session as PRD A. See PRD A's "Further Notes" for the doctrine, ADR cross-references, and `CONTEXT.md` term additions.

---

## Agent Brief

> _This was generated by AI during triage._

**Category:** enhancement
**Summary:** Apply PRD A's four-tier Notice doctrine + helper-layer architecture to the remaining surfaces: Re-review Coordinator, ADO Writer (every write call site, including H1 retroactively), and Pre-PR mode. Adds two new deep helpers (`parse-write-response`, `detect-default-branch`), extends two re-review classifier helpers (`classify-thread` gets a `diffRange` parameter for γ-downgrade; `match-finding` throws instead of returning null on parse error), and refactors `parseAdoWriterResult` to the discriminated-union shape. Default-branch detection becomes a Gitflow-aware fallback chain (`develop` → `main` → `master`) with a Notice naming the actually-used branch.

**Current behavior (after PRD A lands):**

- Coordinator's per-finding `match-finding` call falls back to "no match" on Node parse error, silently duplicating prior threads.
- Coordinator's PATCH-to-fixed catch-all only special-cases HTTP 409; auth, 5xx, and network failures become 200-char `process.stdout.write` warnings that nothing reads. Threads stay open, the user is not told.
- ADO Writer's inline POST path (H1, from PR #29) treats 401/403 as recoverable per-finding failures — every subsequent inline POST in the same run also fails, but the user only sees "N findings posted" with N=0 or partial.
- ADO Writer's `*.err` files are unconditionally cleaned up at the end, destroying the only diagnostic for partial-success runs.
- `parseAdoWriterResult` returns `null` for both "Writer never printed a result block" and "Writer parsed but block was malformed", conflating crash with empty-success.
- Pre-PR `parseChangedFilesFromDiff` returns `[]` for both empty input and `diff --git`-bearing input that fails to parse — broken pipelines look like clean reviews.
- Pre-PR default-branch detection hardcodes `main` as the fallback, computing the diff against the wrong base on every Gitflow project.
- Coordinator and Writer ignore the new `DIFF_RANGE` sentinel PRD A emits.

**Desired behavior:**

- All five ADO write call sites in the Writer and Coordinator route through `parse-write-response` (composing PRD A's `classify-http-error` with response-`id` parsing). One canonical HTTP-tier mapping across the plugin.
- 401/403 anywhere in a Writer or Coordinator run aborts that run with a single stderr message + Trailer aborted line.
- Every per-thread / per-finding write failure that the canonical mapping classifies as DEGRADED pushes a `warning` Notice (`kind` = `inline-post` / `summary-post` / `patch-to-fixed`) that the orchestrator merges and the Writer renders in the Summary.
- Coordinator consumes `DIFF_RANGE: full | incremental`. When `full`, `classify-thread` downgrades `addressed` / `obsolete` outputs to `pending`; `disputed` is unaffected; a DEGRADED Notice (`kind: diff-range` is emitted by the Fetcher, so the Coordinator only consumes — the Notice is already in the merged array).
- Coordinator `match-finding` calls wrap in try/catch; on throw, push DEGRADED Notice (`kind: thread-match`) and let the finding fall through naturally — the reviewer sees one duplicate-and-Notice instead of one silent duplicate.
- Writer streams `*.err` content to stderr at the moment of failure; unconditional cleanup follows.
- `parseAdoWriterResult` returns the discriminated union; orchestrator fails-loud on `{ ok: false, reason: 'missing-block' }`.
- Pre-PR `parseChangedFilesFromDiff` detects suspicious-shape and emits a DEGRADED Notice (`kind: diff-parse`); `buildPrePrContext` returns the Notice array.
- Pre-PR `detect-default-branch.mjs` walks `develop` → `main` → `master`; emits a Notice naming the actually-used branch; aborts when none exists.

**Key interfaces:**

- `parseWriteResponse({ httpExit, responseText, errStream }) → { ok: true, id } | { ok: false, tier, kind, message }`.
- `detectDefaultBranch({ branchExists }) → { branch, source, notice? }`.
- `classifyThread({ ..., diffRange }) → { classification }` — new optional parameter with default `'incremental'`.
- `matchFinding(...) → { classification, threadId } | null` — now throws on parse error.
- `parseAdoWriterResult(...) → { ok: true, summaryThreadId, findingsPosted } | { ok: false, reason }`.
- `buildPrePrContext(rawDiff) → { rawDiff, changedFiles, filteredFiles, notices: Notice[] }`.

**Acceptance criteria:**

- [ ] PRD A is merged before PRD B starts.
- [ ] Every `az devops invoke` POST/PATCH in `.agents/ado-writer.md` and `.agents/re-review-coordinator.md` is routed through `parse-write-response`.
- [ ] 401 or 403 from any Writer or Coordinator HTTP call aborts the run with a clear stderr message and a Trailer aborted line.
- [ ] 5xx / network / other-4xx from any write call emits a DEGRADED Notice and continues; the Notice appears in the Review Summary.
- [ ] `classify-thread` accepts a `diffRange` parameter; when `'full'`, `addressed` / `obsolete` are remapped to `pending`; `disputed` unaffected.
- [ ] `match-finding` throws on parse error; the Coordinator's call site catches the throw and emits a DEGRADED Notice (`kind: thread-match`).
- [ ] `parseAdoWriterResult` returns a discriminated union; the orchestrator surfaces `{ ok: false, reason: 'missing-block' }` as an ABORTED run.
- [ ] `buildPrePrContext` returns a `notices: Notice[]` field; suspicious-shape diffs emit a DEGRADED Notice (`kind: diff-parse`).
- [ ] `detect-default-branch.mjs` exists, has unit tests covering the four fallback levels + the abort case, and the orchestrator wires it via injectable `branchExists`.
- [ ] Pre-PR mode aborts with a clear stderr message when none of `develop`, `main`, `master` exist.
- [ ] `*.err` content is streamed to stderr at the moment of failure; cleanup is unconditional.
- [ ] `commands/review-pr.md` remains ≤ 200 lines.
- [ ] `pnpm test` passes; `pnpm format` produces no diff; `pnpm check` reports zero warnings.
- [ ] `docs/inbox/pr-review-ado-error-hardening-pass.md` is removed.

**Out of scope:**

- Anything PRD A delivers.
- Retries on transient HTTP errors.
- Integration smoke test (manual, post-merge).
- Lifting helpers to `pr-review-toolkit`.
- Unit tests for MODIFY helpers (`classify-thread`, `match-finding`, `parseAdoWriterResult`, `pre-pr.mjs` suspicious-shape).
