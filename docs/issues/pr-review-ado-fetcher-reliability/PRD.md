# PRD: pr-review — ADO Fetcher reliability

**Status:** needs-triage
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`

---

## Problem Statement

When the ADO Fetcher's Azure DevOps reads fail — iterations endpoint down, work-item fetch denied by auth, prior commit missing for an incremental diff — the failures are currently invisible. The bot keeps running and produces output that looks like a normal Review, but signed `Iteration ` (empty), or with `WORK_ITEM_IDS=[]` (indistinguishable from "no work items linked"), or classifying prior threads against the wrong diff range. The reviewer reading the PR has no way to tell that the Review was produced on degraded inputs; the next re-review can be corrupted permanently because Bot Signature drift breaks re-review detection. This is the most consequential class of silent failure surfaced by the PR #29 review.

## Solution

Introduce a four-state Notice Tier doctrine across the plugin and apply it first to the ADO Fetcher. Every Fetcher read terminates in one of four tiers — OK, EMPTY-BY-DESIGN, DEGRADED, ABORTED — and emits a structured Notice when the tier is non-OK (with one carve-out: EMPTY-BY-DESIGN is silent except for the Doc Context family). Notices flow from the Fetcher's structured result block through the orchestrator into the Review Summary, where the reviewer sees them. A mandatory end-of-run Trailer line printed in the Claude interface also reports notice counts, so the user invoking the command sees outcome status without opening the PR.

Failure classification moves to pure JavaScript helpers under `scripts/ado/`, refining the architecture documented in ADR 0013. Three new deep helpers (`classify-http-error`, `notices`, plus per-fetch wrappers) replace the inline bash-and-Node heredocs that today implicitly swallow exit codes. The discriminated-union return shape distinguishes EMPTY-BY-DESIGN from DEGRADED at the helper API level, removing the conflation that today defaults `parseIterations([])` to `{ latestIterationId: 1 }` (silently violating CLAUDE.md's "iterationId=1 is never used" rule).

The diff-range fallback that the Fetcher already performs (when the prior iteration's commit is unreachable, falling back to the full PR diff) gets a `DIFF_RANGE: full | incremental` sentinel field in `ADO_FETCHER_RESULT` and a DEGRADED Notice. PRD B will consume the sentinel; PRD A only emits it.

## User Stories

1. As a PR reviewer, I want a banner at the top of the Review Summary listing any platform failures that occurred during the Review, so that I can tell whether the bot's findings are based on complete or degraded context.
2. As a developer invoking `/pr-review:review-pr`, I want a single end-of-run Trailer line in my Claude interface reporting findings counts, notice counts, and the PR URL, so that I can scan outcome status across many AFK invocations without opening each PR.
3. As a PR reviewer, I want to know when the Review was produced without business context (no work items linked, or work-item fetch failed), so that I can decide whether to re-run with a linked work item or accept the review-without-context.
4. As a Plugin maintainer, I want the Bot Signature to never carry an empty or fabricated Iteration ID, so that re-review detection on the next run is not silently corrupted.
5. As a Plugin maintainer, I want auth or permission failures on the Azure DevOps iterations endpoint to abort the run with a clear stderr message naming `az devops login` as the remedy, so that the user is not left wondering why subsequent re-reviews behave oddly.
6. As a PR reviewer in re-review mode, I want the bot to tell me when it classified prior threads against the full PR diff instead of the incremental diff, so that I can interpret an unexpected `pending` verdict as conservative rather than definitive.
7. As a Plugin maintainer, I want failure classification logic to live in pure JS helpers with unit tests, rather than in bash-and-Node heredocs inside agent prompts, so that I can verify the doctrine is applied consistently without running an end-to-end ADO smoke test.
8. As a developer reading the codebase, I want every ADO write call site to consult one canonical helper that maps HTTP status codes to Notice Tiers, so that 401 means the same thing in every code path and a future contributor cannot accidentally invent a divergent mapping.
9. As a developer running `/pr-review:review-pr` in Pre-PR mode, I want any Fetcher-related infrastructure changes to be invisible to me, because Pre-PR mode does not run the Fetcher.
10. As a Plugin maintainer, I want a Notice that is emitted by multiple agents for the same root cause (e.g. Fetcher and Doc Context Orchestrator both noticing a Confluence outage) to be deduplicated in the orchestrator's merge step, so that the Summary does not list the same problem twice.
11. As a developer maintaining a Re-review on an ADO PR that was merged before the Review completed, I want the Fetcher to still return a usable iteration list (because comments are still useful as a review record), so that the merged-but-reviewable workflow ADR 0013 acknowledges keeps working.
12. As a Plugin maintainer, I want the discriminated-union refactor of `parseIterations` and `parseWorkItemIds` to be purely internal, so that no other plugin or release-tool depends on the old return shape.
13. As a developer running Pre-PR mode, I want the Doc Context EMPTY-BY-DESIGN informational Notice to be emitted only for the Doc Context family (no linked work items), so that other inherently-empty states (first-review having no prior threads, a clean PR having no findings) do not pollute the Summary with redundant `ℹ️` lines.
14. As a Plugin maintainer, I want the ADRs that record the new doctrine (helper-layer split from ADR 0013, canonical HTTP-tier mapping, γ-downgrade rule for diff-range) to be in place before PRD B's consumers start arriving, so that PRD B can reference them rather than re-litigate the decisions.
15. As a CI engineer, I want every new deep helper module to come with `node:test` unit tests in the prior-art style of `packages/release-tools/scripts/verify-changelog.test.mjs`, so that the helpers can be verified without an ADO PR and without Azure CLI installed.

## Implementation Decisions

### Notice Tier doctrine

A four-state classification of every Review operation outcome — **OK**, **EMPTY-BY-DESIGN**, **DEGRADED**, **ABORTED** — captured in `CONTEXT.md` under "Platform-failure handling". The tier choice is the gating decision; there is no fifth ASK tier. AFK invocations never block on user input. Failure modes that tempt an ASK tier are reclassified as ABORTED.

EMPTY-BY-DESIGN is silent for most states. The Doc Context family is the one exception: when `WORK_ITEM_IDS=[]` the orchestrator emits an `info`-severity Notice in the Summary, because the reviewer cannot tell from the PR alone whether the bot considered linked business context.

### Notice flow

Each orchestration agent emits a `NOTICES` JSON array as a new field in its structured result block. The orchestrator parses, merges (with `kind`-based deduplication), and passes the merged array to the ADO Writer alongside `FINDINGS`. The ADO Writer renders a `## Notices` block above the findings in the Review Summary content. The heading stays bare (no emoji) so a mixed `info` + `warning` Notices list does not require the heading emoji to misrepresent one of the tiers; each list item carries its own per-Notice emoji prefix (`ℹ️` for `info`, `⚠` for `warning`).

Notice shape: `{ severity: "info" | "warning", kind: <enum>, message: string }`. `kind` is a small enum (`doc-context`, `diff-range`, `work-items`, `iterations`, `default-branch`, `partial-run-check`, `thread-match`, `thread-classify`, `inline-post`, `summary-post`, `patch-to-fixed`, `diff-parse`); rejected: free-form strings, severity-coded numerics. ABORTED never reaches the Notice channel — its surface is stderr + the Trailer.

### End-of-run Trailer

The orchestrator prints a mandatory single-line Trailer to the Claude interface at end-of-run, regardless of mode or outcome:

- ADO modes: `✅ Review posted: <N> findings (<criticals> critical, <importants> important) · <warnings> warning notices · <infos> info notices → <PR URL>`
- Pre-PR mode: `✅ Pre-PR review complete: <N> findings (<criticals> critical, <importants> important) · <warnings> warning notices`
- Aborted: `❌ Review aborted: <kind> — <one-line reason>`

Designed for AFK skim: the invoker sees outcome status without opening the PR. Same `NOTICES` array drives both the Summary rendering and the Trailer counts.

### Helper layer (ADR 0014)

Failure classification moves from inline bash-and-Node heredocs to pure JS helpers under `scripts/ado/`. Agent prompts shrink to "import, call, branch on `result.ok`". This refines ADR 0013 — orchestration still lives in agent prompts, but **failure classification** lives in helpers.

New helper modules:

- **`scripts/ado/classify-http-error.mjs`** — pure function taking an HTTP status code, response body excerpt, and process exit code. Returns `{ tier: 'ok' | 'degraded' | 'aborted', kind, message }`. Encodes the canonical HTTP-tier mapping. Consumed by PRD B too.
- **`scripts/ado/notices.mjs`** — pure helpers `createNotice`, `mergeNotices` (dedupe by `kind`), `formatNoticesAsSummaryBlock`, `formatNoticesAsPrePrPreamble`, `formatTrailer`.
- **`scripts/ado/fetch-iterations.mjs`** — wraps the iterations fetch and parse; returns `{ ok: true, latestIterationId, latestCommitSha } | { ok: false, reason }`. Subsumes the existing `parseIterations` helper, refactored to the discriminated-union shape. Empty `value` array on a real PR → `{ ok: false, reason: 'empty-iterations' }` → ABORTED.
- **`scripts/ado/fetch-work-items.mjs`** — wraps the work-items fetch and parse; returns `{ ok: true, ids } | { ok: false, reason }`. Subsumes `parseWorkItemIds`. Empty array (legitimate "no work items linked") → `{ ok: true, ids: [] }`; fetch failure (auth, 5xx, network) → `{ ok: false }`.

### Canonical HTTP-tier mapping (ADR 0015)

| HTTP outcome          | Tier     | Notes                                                      |
| --------------------- | -------- | ---------------------------------------------------------- |
| 200 / 201             | OK       | No Notice.                                                 |
| 404                   | OK       | Domain "the thing is already gone."                        |
| 409                   | OK       | Domain "state already changed."                            |
| 401                   | ABORTED  | Token expired or revoked; all subsequent writes will fail. |
| 403                   | ABORTED  | Permission revoked; same.                                  |
| 5xx                   | DEGRADED | Transient backend; emit Notice; continue.                  |
| Other 4xx (400 / 422) | DEGRADED | Malformed request bug; Notice includes body excerpt.       |
| Network error         | DEGRADED | Treat as 5xx.                                              |

No retries in v1. Retries add latency, complexity, and a new failure mode (retry storm). The doctrine produces correct behaviour without them; retries can be added later behind the same Notice surface.

### DIFF_RANGE sentinel and ADR 0004 amendment

The ADO Fetcher's existing fallback from incremental to full diff (when the prior iteration's commit is unreachable) is currently silent. PRD A introduces:

- A new `DIFF_RANGE: full | incremental` line in `ADO_FETCHER_RESULT_START/END`.
- A DEGRADED Notice (`kind: diff-range`, message: "Incremental diff unavailable — Coordinator will classify against the full PR diff with conservative downgrades.") when the fallback fires.

The PRD B Coordinator changes (γ-downgrade rule that remaps `addressed` / `obsolete` to `pending` when `DIFF_RANGE=full`) consume this sentinel. PRD A only emits it.

ADR 0004 ("incremental diff baseline") is amended in-place with a "Degraded baseline" subsection covering this rule.

### Agent and orchestrator changes

- **`.agents/ado-fetcher.md`** — three inline bash heredocs (Steps 2, 4a/work-items, 4-diff) replaced with `await import` calls to the three new helpers. `ADO_FETCHER_RESULT` output block grows two fields: `DIFF_RANGE` and `NOTICES`.
- **`.agents/ado-writer.md`** — accepts a new `NOTICES` input; renders the `## Notices` block above the existing severity-grouped findings in the Summary content. No changes to write call sites in PRD A (those land in PRD B).
- **`commands/review-pr.md`** — parses `NOTICES` and `DIFF_RANGE` from `ADO_FETCHER_RESULT`; merges Notices via the `notices` helper; passes merged Notices to the ADO Writer prompt; emits Doc-Context EMPTY-BY-DESIGN info Notice when `WORK_ITEM_IDS=[]`; prints the mandatory end-of-run Trailer line. The 200-line cap from PRD-orchestrator-split is preserved by leaning on the new helpers (the bash side becomes uniform `if [ "$RESULT_OK" != "true" ]; then ...`).

### Existing helpers, breaking-change check

`parseIterations`, `parseWorkItemIds`, and any other affected helpers are verified to have zero consumers outside the `pr-review` plugin (`grep` across `apps/`, `packages/`, `docs/` returns no matches outside `apps/claude-code/pr-review/`). The discriminated-union refactor is therefore safe to land without a deprecation period.

## Testing Decisions

### What makes a good test

Tests assert the external behaviour of each helper given controlled inputs — no implementation-detail inspection, no internal-branching tests. Inputs are plain JavaScript objects or short JSON fixtures. A test reads as a sentence: "given an HTTP 401, classifyHttpError returns the aborted tier." `node:test` built-in, `node:assert/strict`, no external deps.

### Modules under test

**New deep helpers (full unit-test coverage):**

- `scripts/ado/classify-http-error.mjs` — one test per row of the canonical mapping (200, 201, 401, 403, 404, 409, 5xx, 400, 422, network/exit-code paths) plus the case where the body excerpt is malformed JSON.
- `scripts/ado/notices.mjs` — `createNotice` shape, `mergeNotices` dedup behaviour across multiple sources, the three `format…` renderers producing expected markdown / line shapes, `formatTrailer` for first-review / re-review / pre-pr / aborted modes.
- `scripts/ado/fetch-iterations.mjs` — happy path with one iteration, multiple iterations (returns the max), empty `value` array → `{ ok: false, reason: 'empty-iterations' }`, missing `value` key, malformed JSON, an ADO error response.
- `scripts/ado/fetch-work-items.mjs` — empty PR-work-item links → `{ ok: true, ids: [] }`, populated links, dedup of duplicate IDs (existing parseWorkItemIds invariant), null/missing response → `{ ok: false }`, ADO error response.

The existing test files for `parseIterations` and `parseWorkItemIds` are subsumed — the fetch helpers replace them and inherit their fixtures.

### Modules NOT under test in PRD A

- Agent prompt content (`.agents/*.md`, `commands/review-pr.md`): no new string-match assertions. The existing pattern is flagged as brittle in `docs/inbox/pr-review-prompt-content-tests-brittleness.md` and behaviour is verified by integration smoke test against a real ADO PR after merge, per ADR 0013's testing posture.

### Prior art

`packages/release-tools/scripts/verify-changelog.test.mjs`, `packages/release-tools/scripts/bump-version.test.mjs`, and `apps/claude-code/pr-review/tests/parse-diff-hunks.test.mjs` (added in PR #29). Same style throughout.

## Out of Scope

- Coordinator and Writer changes (DIFF_RANGE consumption, γ-downgrade rule applied, HTTP-tier mapping applied to every write call site, `*.err` retention policy, `parseAdoWriterResult` discriminated-union refactor) — those land in **PRD B**.
- Pre-PR mode changes (`parseChangedFilesFromDiff` suspicious-shape Notice, default-branch fallback chain + Notice) — those land in **PRD B**.
- The integration smoke test against a real ADO PR — verification is manual, post-merge.
- Retries on transient HTTP errors — out of scope per the doctrine. Re-evaluate if 5xx Notices prove painful in practice.
- A canonical thread shape spanning ADO and GitHub — deferred per ADR 0013 until a second platform consumer exists.
- Lifting any helper from `scripts/ado/` to `pr-review-toolkit` — none of these helpers are platform-shared yet.

## Further Notes

**ADR 0014** (`apps/claude-code/pr-review/docs/adr/0014-failure-classification-helpers.md`) records the helper-layer refinement to ADR 0013.

**ADR 0015** (`apps/claude-code/pr-review/docs/adr/0015-canonical-http-tier-mapping.md`) records the HTTP-tier mapping, the 401/403 abort rule, and the no-retries-in-v1 stance.

**ADR 0004** (`apps/claude-code/pr-review/docs/adr/0004-incremental-diff-baseline.md`) is amended in-place with a "Degraded baseline" subsection covering the γ-downgrade rule that PRD B will implement on the consumer side.

**`CONTEXT.md`** is already updated with the new terms (Notice, Notice Tier and its four states, Trailer).

**Source:** the deferred items from the PR #29 multi-agent review, grilled against the domain doctrine over the conversation captured in this session. The originating inbox file (`docs/inbox/pr-review-ado-error-hardening-pass.md`) is removed once PRD A and PRD B are published.

---

## Agent Brief

> _This was generated by AI during triage._

**Category:** enhancement
**Summary:** Apply the four-tier Notice doctrine to the ADO Fetcher. Introduce three new deep helpers in `scripts/ado/` (`classify-http-error`, `notices`, plus `fetch-iterations` and `fetch-work-items` as discriminated-union refactors of the existing parsers). The Fetcher emits a `NOTICES` array and a `DIFF_RANGE` sentinel in its structured result block; the orchestrator merges Notices, passes them to the ADO Writer, prints a mandatory end-of-run Trailer line. The ADO Writer renders a `## Notices` block above findings in the Review Summary.

**Current behavior:**
ADO Fetcher reads silently swallow exit codes. An iterations-fetch failure produces `LATEST_ITERATION_ID=''`, drifting the Bot Signature to `Iteration ` (empty) and breaking re-review detection forever afterward. A work-item-fetch failure is indistinguishable from "no work items linked" — both produce `WORK_ITEM_IDS=[]`. A diff-range fallback to the full PR diff happens silently, causing the Coordinator to classify prior threads against the wrong range. None of these surface to the reviewer or the invoker.

**Desired behavior:**
Every Fetcher operation terminates in one of four Notice Tiers (OK, EMPTY-BY-DESIGN, DEGRADED, ABORTED). Tier choice is the gating decision — no user prompts, AFK-friendly. Failures route to:

- **ABORTED** for state-corrupting failures (empty iterations on a real PR, 401/403 on iteration fetch). Process exits non-zero with stderr message + Trailer aborted line.
- **DEGRADED** for failures the Review can still complete around (work-item fetch failed, diff-range fallback to full diff, 5xx on any read). Emits a `warning` Notice surfaced in the Review Summary.
- **EMPTY-BY-DESIGN** for legitimate empty states. Silent except for the Doc Context family (`WORK_ITEM_IDS=[]` → `info` Notice in the Summary).
- **OK** for normal completion.

The four new helpers under `scripts/ado/` own the classification logic. Agent prompts shrink to `await import` + branch on `result.ok`. The Bot Signature is never signed with an empty Iteration ID again.

**Key interfaces:**

- `classifyHttpError({ status, body, exitCode }) → { tier, kind, message }` — canonical HTTP-tier mapping; consumed by PRD B.
- `createNotice / mergeNotices / formatNoticesAsSummaryBlock / formatNoticesAsPrePrPreamble / formatTrailer` from `scripts/ado/notices.mjs`.
- `fetchIterations(...) → { ok: true, latestIterationId, latestCommitSha } | { ok: false, reason }`.
- `fetchWorkItems(...) → { ok: true, ids } | { ok: false, reason }`.
- `ADO_FETCHER_RESULT` grows `DIFF_RANGE: full | incremental` and `NOTICES: [{severity, kind, message}, …]` fields.

**Acceptance criteria:**

- [ ] The four new helpers under `scripts/ado/` exist and pass their unit tests (`pnpm --filter pr-review test`).
- [ ] `parseIterations` / `parseWorkItemIds` are gone — the new fetch helpers fully subsume them; no consumer outside `pr-review` is broken (verified by `grep`).
- [ ] An iterations fetch that returns `value: []` aborts the run with a clear stderr message and a Trailer `❌ Review aborted: empty-iterations — …` line.
- [ ] A work-item fetch that fails with auth/5xx/network emits a DEGRADED Notice (`kind: work-items`); a work-item fetch that returns an empty list emits an `info` Notice (`kind: doc-context`).
- [ ] A diff-range fallback emits `DIFF_RANGE: full` in `ADO_FETCHER_RESULT` and a DEGRADED Notice (`kind: diff-range`).
- [ ] The orchestrator merges Notices, dedupes by `kind`, and passes them to the ADO Writer.
- [ ] The ADO Writer renders a `## Notices` block above findings in first-review and re-review Summaries.
- [ ] Every successful run ends with a Trailer line in the Claude interface listing findings, notices, and the PR URL (ADO modes) or finding counts (Pre-PR mode).
- [ ] `commands/review-pr.md` remains ≤ 200 lines.
- [ ] ADR 0014 (helper layer), ADR 0015 (HTTP-tier mapping), and the in-place ADR 0004 amendment exist.
- [ ] `pnpm test` passes; `pnpm format` produces no diff; `pnpm check` reports zero warnings.

**Out of scope:**

- Coordinator and Writer changes — PRD B.
- Pre-PR mode changes — PRD B.
- Retries on transient HTTP errors.
- Integration smoke test (manual, post-merge).
- Lifting helpers to `pr-review-toolkit`.
