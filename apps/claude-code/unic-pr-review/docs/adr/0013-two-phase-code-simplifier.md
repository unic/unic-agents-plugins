# 0013. Two-phase code-simplifier model

**Status:** Accepted (2026-06)

## Context

The `pr-review-toolkit` (Anthropic's reference implementation) runs `code-simplifier` as a **post-pass** — only after the review has passed — rather than in the initial parallel fan-out alongside the other Review Aspect agents. `unic-pr-review` originally included `code-simplifier` in the Phase 1 fan-out under the SPAWN_TABLE heuristic `≥3 non-test source files` (ADR-0008). This means a simplification pass can run on code that still has real correctness or quality problems, wasting tokens and potentially surfacing misleading "polish" suggestions on broken code.

Two approaches were considered:

- **Keep the single-phase fan-out.** Rejected — running a simplification pass on code that still has Critical or Important problems is noise. A simplification suggestion ("extract this helper") is unhelpful when the code is structurally incorrect.
- **Two-phase model: Review Aspect fan-out first, then an optional simplification phase.** Accepted — mirrors the `pr-review-toolkit` approach, aligns with the intuition that simplification is only valuable on code that is already correct.

## Decision

`code-simplifier` is removed from the Phase 1 SPAWN_TABLE (ADR-0008). After Phase 1 completes, the orchestrator checks two conditions before launching Phase 2:

1. **Severity gate** (ADR-0002): the merged Phase 1 findings array contains **zero** entries with severity `critical` or `important`. Minor findings are acceptable — they do not block Phase 2.
2. **File-count gate**: the diff contains **three or more** non-test source files (the same threshold previously used in SPAWN_TABLE).

Only when both conditions are true does the orchestrator launch `code-simplifier` as a sequential Phase 2 step. `code-simplifier`'s findings are merged into the full findings set before rendering, so they appear in the Review Summary alongside the Phase 1 findings.

A pure-function helper `shouldRunPhase2(changedFiles, findings)` is exported from `scripts/lib/changed-file-analyser.mjs` so the gate is unit-testable independently of the orchestrator.

## Interaction with the Approval Loop (ADR-0003) and re-review mode (ADR-0007)

- **Preview / no `--post`**: Phase 2 always runs (when conditions are met) and its findings appear in the terminal preview. Nothing is posted to ADO — this is unchanged from the default dry-run behaviour.
- **`--post` (first-review)**: Phase 2 runs before the Approval Loop. Its findings enter the same loop as Phase 1 findings — they are not distinguished from Phase 1 findings in the Approval Loop or in the ADO threads.
- **`--post --yes`**: same as above, bulk-accepted without prompting.
- **Re-review mode**: Phase 2 runs (when conditions are met) after the Re-review Coordinator produces its plan. Phase 2 findings are treated as fresh findings and follow the same write path as other fresh findings.
- **`diffUnavailable` guard**: when the ADO Fetcher sets `diffUnavailable: true`, neither Phase 1 nor Phase 2 spawns agents — the existing guard in Step 1.8 covers both phases.

## Consequences

- The ADR-0008 Spawn Table loses `code-simplifier`. The entry in `changed-file-analyser.mjs` that previously listed it is removed.
- `code-simplifier` findings can no longer appear for PRs with Critical or Important problems, which is the intended behaviour.
- A PR with ≥3 source files and only Minor Phase 1 findings gets a polish pass; the reviewer sees it alongside the Minor findings.
- The file-count gate is now evaluated at Phase 2 decision time (after Phase 1), not at spawn-set computation time. The threshold (≥3) is unchanged.
- Tests for `decideSpawnSet` must be updated to remove `code-simplifier` assertions. New tests for `shouldRunPhase2` cover the three canonical scenarios: pass+≥3-source → `true`; pass+<3-source → `false`; Important present → `false`.
