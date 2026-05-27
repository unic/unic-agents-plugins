# PRD: pr-review — Formal Dry-run mode

**Status:** ready-for-agent
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`
**GitHub:** [#136](https://github.com/unic/unic-agents-plugins/issues/136)

---

> **Alignment note (2026-05-27).** This PRD implements [ADR 0017](../../adr/0017-dry-run-as-fourth-peer-mode.md) (**Accepted**, 2026-05-14) but sharpens one piece of its framing. ADR 0017's Decision section describes a four-MODE switch (`MODE ∈ {pre-pr, dry-run, first-review, re-review}`) while also requiring `IS_REREVIEW` to drive Coordinator inclusion within dry-run. Read literally, that is a two-state-variable switch — exactly what the ADR's Alternatives section rejected for the orthogonal-flag option. To preserve the ADR's single-discriminator intent, this PRD resolves `dry-run` into two internal MODE literals — `dry-run-first` and `dry-run-rereview` — so the orchestrator branches on a single five-literal `MODE`. The ADR itself is left unchanged; the splitting is an implementation detail consistent with its stated intent. Domain-language `Dry-run mode` (see `CONTEXT.md`) remains a single concept.
>
> **Foundation context.** Spec 12 ([#120](https://github.com/unic/unic-agents-plugins/issues/120)) has merged. Step 4 metadata fetch, the ADO Fetcher's ownership of thread fetch + mode detection, the four-tier Notice doctrine, and the `formatTrailer` / `formatNoticesAsPrePrPreamble` rendering helpers in `scripts/ado/notices.mjs` are all in place. Spec 13 plugs into that foundation — no overlap, no new ADO calls, clean dependency.

## Problem Statement

The plugin has no deterministic dry-run mechanism. The 2026-05-14 dry-run captured in `docs/conversations/pr-review-dry-run-01.txt` was invoked by natural language (_"Make a dry-run PR review. DO NOT POST ANY COMMENT TO THE PR! Only report inline"_). The LLM-as-orchestrator honoured the no-post instruction by also skipping the ADO Fetcher entirely, inlining `az` calls (compounding the then-unfixed Step 4 bug), and never invoking the Doc Context Orchestrator. The user got useful findings only by accident; the documented spec was bypassed.

Two consequences for users:

1. **No safe preview of a Re-review.** Re-reviews edit Review Threads on a customer-facing PR — they PATCH thread statuses to `fixed`, reply with new-evidence comments, and post dispute acknowledgements. Today there is no way to see what would happen before letting it happen. Asking the LLM to "not post" works most of the time but invites free-form deviation.

2. **Improvised dry-runs mask real bugs.** Skipping the structured fetch path means dry-runs run a different code path than real Reviews — so bugs in the structured path (like the Step 4 thread-list call) can go unnoticed for releases at a time.

## Solution

Add `--dry-run` as a formal flag to `/pr-review:review-pr <ADO PR URL>` that activates a fourth peer operating mode. Dry-run executes every read-side step identically to first-review / re-review — preflight, metadata fetch, ADO Fetcher, Doc Context Orchestrator, Review Aspect agents in parallel, and (when a prior Bot Signature exists) the Re-review Coordinator's Thread Classification — but **no write reaches Azure DevOps**. The ADO Writer is never invoked; the Coordinator's three posting blocks (new-evidence reply, dispute acknowledgement, PATCH-to-fixed) short-circuit. Findings and the planned thread actions are rendered to the Claude interface using the Pre-PR mode rendering format, plus a new severity-prefixed Trailer line that includes the PR URL the run **would have** posted to.

Slice 1 ships dry-run for fresh PRs (`dry-run-first`). Slice 2 ships dry-run for re-review-eligible PRs (`dry-run-rereview`) with the per-thread planned-actions preview.

## User Stories

1. As a developer about to run a real Review, I want to invoke `/pr-review:review-pr <URL> --dry-run`, so that I see exactly which Inline Comments and Review Summary would be posted before any write reaches Azure DevOps.
2. As a developer about to run a Re-review on a customer-facing PR, I want `--dry-run` to preview each planned thread action (resolve, reply, skip) per existing Review Thread, so that I can catch a misclassification before it changes thread state in ADO.
3. As a developer running dry-run on a PR with no prior Bot Signature, I want the orchestrator to take the `dry-run-first` path automatically, so that the Coordinator is not invoked and the rendered output is the same shape as a pre-PR review plus the PR URL.
4. As a developer running dry-run on a PR with a prior Bot Signature, I want the orchestrator to take the `dry-run-rereview` path automatically, so that the Coordinator runs Thread Classification and surfaces the planned actions in the rendered output.
5. As a developer running dry-run with no PR URL, I want the flag to be silently treated as a tautology and the run to behave as Pre-PR mode, so that I do not need to remember which combinations are legal.
6. As a developer running dry-run-rereview, I want a per-thread plan rendered above the fresh findings (`#123 addressed → PATCH to fixed`, `#124 pending → new-evidence reply`, `#125 disputed → acknowledgement reply`, `#126 pending → skip (no new evidence)`), so that I can audit every write the real Re-review would perform.
7. As a developer running dry-run-rereview on a PR where the prior Iteration equals the latest Iteration (Coordinator's `earlyExit: true` path), I want a Trailer line that clearly reports "nothing would have been posted" with the PR URL, so that the dry-run never appears to "produce nothing" silently.
8. As a developer reading the Trailer, I want a `🔍 Dry-run complete: …` line that carries findings count by severity, planned-thread-action count, warning-notice count, and the PR URL the run would have posted to, so that I can skim outcome without scrolling.
9. As a developer running dry-run with Notices from the ADO Fetcher or Re-review Coordinator (e.g. DEGRADED on a 5xx thread-fetch retry), I want those Notices rendered above the findings via the same preamble format Pre-PR mode uses, so that I see the same warnings I would see in a real run.
10. As a developer running dry-run with the aspect filter (`code` | `errors` | `tests` | `comments` | `types` | `all`), I want the filter to compose with `--dry-run`, so that I can preview a narrowed Review without manually replaying the aspect logic in my head.
11. As a plugin maintainer, I want the orchestrator to detect `--dry-run` via a deterministic bash branch — not LLM-interpreted prose — so that the dry-run path can never be silently skipped by the LLM improvising around the flag (the exact failure mode that motivated ADR 0017).
12. As a plugin maintainer, I want the Re-review Coordinator to learn its mode via a single `MODE` input — not a separate `IS_DRY_RUN` boolean — so that the "orchestrator branches on a single MODE discriminator" invariant from ADR 0017 extends naturally into the agent.
13. As a plugin maintainer, I want the Coordinator's three posting blocks (new-evidence reply, dispute acknowledgement, PATCH-to-fixed) gated by a single `MODE = re-review` guard, so that future contributors cannot accidentally add a fourth posting block without picking up the guard.
14. As a plugin maintainer, I want `formatTrailer` in `scripts/ado/notices.mjs` to accept both `dry-run-first` and `dry-run-rereview` MODE literals natively, so that the orchestrator can pass MODE through verbatim without an intermediate collapse step.
15. As a plugin maintainer, I want the AGENTS.md doctrine line that cites ADR 0017 to read correctly (`pre-pr`, `first-review`, `re-review` peers, plus an internal split note) instead of the current stale wording (`review`, `re-review`, `summary-delta`), so that newcomers to the plugin do not learn the wrong peer-mode vocabulary.
16. As a plugin maintainer, I want each PRD slice to be independently demoable end-to-end (dry-run-first in Slice 1, dry-run-rereview in Slice 2), so that if Slice 2's `plannedActions` contract needs revision the dry-run capability is still available for fresh PRs in the interim.

## Implementation Decisions

### Operating-mode vocabulary

- The orchestrator branches on `MODE ∈ {pre-pr, first-review, re-review, dry-run-first, dry-run-rereview}` — five literals, single discriminator. CONTEXT.md's `Dry-run mode` domain term is preserved (single concept); the two MODE literals are an internal implementation of that concept and are not promoted to glossary entries.
- `IS_REREVIEW` (whether the ADO Fetcher detected a prior Bot Signature) is captured by the Fetcher exactly as today. The orchestrator combines `IS_DRY_RUN × IS_REREVIEW` once, in Step 5, to produce the final `MODE` literal. After Step 5, no orchestrator branch reads `IS_DRY_RUN` or `IS_REREVIEW` directly — only `MODE`.

### Argument parsing (Slice 1)

- `commands/review-pr.md` Step 2 gains a deterministic bash branch that scans `$ARGUMENTS` for the literal token `--dry-run` and sets `IS_DRY_RUN=true|false`. No new module; the branch is two lines of bash, inspectable from the orchestrator file.
- `IS_DRY_RUN=true` + no URL → silently treated as Pre-PR mode (`MODE=pre-pr`). The flag is a no-op in that combination. Step 2 does not error.
- `IS_DRY_RUN=true` + URL → continues through Steps 3–5 identically to a non-dry-run URL run. Final MODE crystallises in Step 5 once `IS_REREVIEW` is known.
- The `argument-hint` frontmatter on `commands/review-pr.md` grows a `[--dry-run]` token. The description sentence picks up dry-run as a fourth supported mode.

### MODE resolution (Slice 1 for fresh half; Slice 2 for re-review half)

After parsing the Fetcher's `IS_REREVIEW`:

| `IS_DRY_RUN` | `IS_REREVIEW` | `MODE`             |
| ------------ | ------------- | ------------------ |
| `false`      | `false`       | `first-review`     |
| `false`      | `true`        | `re-review`        |
| `true`       | `false`       | `dry-run-first`    |
| `true`       | `true`        | `dry-run-rereview` |

The orchestrator's Step 7 branch becomes a five-case switch on `MODE`. `pre-pr` and `dry-run-first` skip the Coordinator entirely. `re-review` and `dry-run-rereview` invoke the Coordinator. The Writer is invoked only for `first-review` and `re-review`.

### Coordinator contract change (Slice 2)

- `agents/re-review-coordinator.md` accepts a new `MODE` input alongside `ADO_FETCHER_RESULT`, `RAW_THREADS_JSON`, `FINDINGS`, `SIGNATURE_PREFIX`, `PLUGIN_ROOT`.
- The three `az devops invoke` posting blocks (new-evidence reply, dispute acknowledgement, PATCH-to-fixed) gain an outer guard: write only when `MODE = re-review`. In `dry-run-rereview`, Thread Classification still runs and `freshFindings` still populates; no `az devops invoke` writes fire.
- The Coordinator's result block grows a new field, `plannedActions`, with shape `[{ threadId: number, action: 'patch-to-fixed' | 'reply-new-evidence' | 'reply-dispute-ack' | 'skip', reason: string }]`. The Coordinator emits the same per-thread classifications it already computes; in `re-review` mode this field is still populated (no-op cost) so the contract is symmetric. The orchestrator uses `plannedActions` only when `MODE = dry-run-rereview`.

### Rendering (Slice 1 + Slice 2)

- In `dry-run-first` and `dry-run-rereview`, the orchestrator reuses `formatNoticesAsPrePrPreamble(fetcherNotices + coordinatorNotices)` to render Notices above the findings — same shape as Pre-PR mode.
- In `dry-run-rereview` only, between the Notices preamble and the severity-grouped findings, the orchestrator inline-renders a "Planned thread actions" block:

  ```
  Planned thread actions (would not execute in dry-run):
    #123  addressed → PATCH to fixed
    #124  pending   → new-evidence reply
    #125  disputed  → acknowledgement reply
    #126  pending   → skip (no new evidence)
  ```

  The block is elided when `plannedActions` is empty (consistent with how the Notices preamble elides). No new render helper is introduced — rendering is inline orchestrator prose.

- Severity-grouped findings render via the exact Pre-PR Step E format (`[{severity}] {filePath} L{startLine}–{endLine}\n{title}\n{body}`) — fresh findings only (i.e. `freshFindings` for `dry-run-rereview`, all findings for `dry-run-first`).

### Trailer (Slice 1 + Slice 2)

- `formatTrailer` in `scripts/ado/notices.mjs` accepts `dry-run-first` and `dry-run-rereview` as new `mode` values and collapses both internally into one rendering branch.
- The dry-run Trailer shape is:

  ```
  🔍 Dry-run complete: <N> findings (<C> critical, <I> important) · <A> planned thread actions · <W> warning notices · would have posted to <PR URL>
  ```

- `<N>` counts fresh findings only (not findings + planned actions). `<A>` is the `plannedActions` length (0 for `dry-run-first`). `<W>` is the warning Notice count, identical to the existing pre-pr trailer. `<PR URL>` is built from `ORG_URL`/`PROJECT`/`PR_ID` exactly as the ADO-mode trailer builds it.
- One Trailer shape covers both dry-run MODE literals — zero-able segments render as `0` (consistent with the pre-pr trailer's `0 warning notices` behaviour).
- The `formatTrailer` signature gains nothing else: `findings`, `notices`, `prUrl` are all already in its `input` shape.

### Coordinator `earlyExit: true` in dry-run-rereview (Slice 2)

- Today the orchestrator stops after the Coordinator returns `earlyExit: true` (no-new-revisions path), producing no Trailer. This is a pre-existing UX gap in `re-review` and is out of scope to fix here.
- In `dry-run-rereview`, the orchestrator does **not** stop silently on `earlyExit: true`. It prints the Trailer (`0 findings · 0 planned thread actions · …`) and exits cleanly, so the dry-run user always gets a clear outcome. `re-review`'s behaviour stays untouched.

### Doctrine and documentation (Slice 1)

- The plugin's `AGENTS.md` doctrine line citing ADR 0017 changes from:

  > **Dry-run is a fourth peer mode.** Dry-run sits alongside `review`, `re-review`, and `summary-delta` as a peer Review mode, not a flag on another mode.

  to:

  > **Dry-run is a fourth peer operating mode.** Dry-run sits alongside `pre-pr`, `first-review`, and `re-review` as a peer mode, not a flag on another mode. Internally it resolves to one of two `MODE` literals (`dry-run-first` / `dry-run-rereview`) based on whether a prior Bot Signature is found. See [ADR-0017].

- `CONTEXT.md`'s `Dry-run mode` term and Relationships entries already cover the behaviour correctly; no change required.

## Testing Decisions

External-behaviour testing only. Feed inputs into module contracts, assert the returned string / object. Do not assert on intermediate state or internal helper structure.

**Modules to test:**

- `scripts/ado/notices.mjs` — extend `tests/notices.test.mjs` with `formatTrailer` cases:
  - `mode: 'dry-run-first'` with findings + zero planned actions + warnings → assert exact line.
  - `mode: 'dry-run-rereview'` with findings + non-zero planned actions + warnings → assert exact line including `<A> planned thread actions` segment.
  - `mode: 'dry-run-rereview'` zero-everything (the `earlyExit` shape) → assert exact line with all-zero segments + PR URL still present.
  - `mode: 'dry-run-first'` and `mode: 'dry-run-rereview'` minor-findings-only → assert minor count is excluded from the parenthetical breakdown, consistent with the existing trailer behaviour.

**Tests considered and skipped:**

- Coordinator `plannedActions` emission shape — the Coordinator is markdown agent prose, not a JS module. The existing test suite has no precedent for asserting agent prose contracts.
- Orchestrator MODE-resolution matrix — prose, not module. The matrix is exercised indirectly by the `formatTrailer` cases above (each new MODE literal corresponds to one matrix cell).
- A new `scripts/parse-args.mjs` and corresponding test were considered and explicitly rejected (a deterministic bash branch in Step 2 carries the same contract for one flag without inventing a module the orchestrator does not otherwise have).
- A new `formatPlannedActionsBlock` helper and corresponding test were considered and explicitly rejected (the block is rendered inline by the orchestrator; the marginal testability gain did not justify a new module).

**Prior art:**

- `tests/notices.test.mjs` is the file to extend; it already covers `formatTrailer` for `pre-pr`, ADO-mode, and `aborted`. The new cases follow the same `node:test` ESM pattern with `// @ts-check`, fixture inputs, and `assert.strictEqual` on the returned string.

## Out of Scope

- **Fixing the Coordinator's doctrine violation.** The Re-review Coordinator writes (PATCH-to-fixed, new-evidence reply, dispute acknowledgement) via `az devops invoke` directly, violating the AGENTS.md doctrine "all write operations go through the ADO Writer." Spec 13 works around this by gating those writes on `MODE = re-review`; it does not lift them into the ADO Writer. That is a separate refactor with its own ADR/PRD if pursued.
- **Fixing the missing-Trailer-on-earlyExit gap in re-review.** Spec 13 prints the Trailer on `earlyExit: true` only in `dry-run-rereview`. Re-review's identical silent path stays untouched; file a separate issue if it needs fixing.
- **A dedicated CONTEXT.md term for the per-thread planned action.** "Planned thread actions" is a UI rendering element, not domain language. CONTEXT.md is a glossary; spec 13 introduces no new glossary entry.
- **Pre-PR mode + `--dry-run` as an error.** The combination is silently treated as Pre-PR mode (the `--dry-run` flag is a no-op). No diagnostic message is added.
- **Composing dry-run with the aspect filter as a new feature.** Composition works for free (the orchestrator's aspect parsing in Step 6 / Pre-PR Step D is independent of MODE). No new tests of composition are added; existing aspect-filter tests cover the parsing.
- **Amending or revising ADR 0017.** The PRD's Alignment note clarifies the ADR's intent without editing the ADR file. If decisions need genuine revisiting, file an amending ADR rather than editing 0017 in place.

## Further Notes

- **Severity.** P1 (enhancement, not a regression fix). Today's improvised dry-run produces useful findings in practice but on an undocumented path. The new deterministic path is the precondition for trusting dry-run output before letting a Re-review touch a customer-facing PR.
- **Why two slices.** Slice 1 (`dry-run-first`) and Slice 2 (`dry-run-rereview`) are independently demoable. Slice 1 ships a usable dry-run on fresh PRs the moment it merges. Slice 2 builds strictly on top: its parser, MODE resolution, and Trailer scaffolding are inherited from Slice 1; its additions are scoped to the Coordinator + the planned-actions block. The split exists to give review-time headroom on Slice 2's `plannedActions` contract (the only contract introduced in this PRD).
- **No new `az` invocations.** Spec 13 introduces no new Azure CLI calls. No update to `tests/fixtures/ado-cli-inventory.mjs` is needed. The CLI smoke test from spec 12 continues to assert the existing set without modification.
- **Related but independent.** Issue #46 (duplicate threads) is unrelated; the dry-run path will surface the same plannedActions whether the bug is present or not.
