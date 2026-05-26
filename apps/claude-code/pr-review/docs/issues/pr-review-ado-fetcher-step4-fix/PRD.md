# PRD: pr-review — ADO Fetcher Step 4 fix + ADO CLI smoke test

**Status:** ready-for-agent
**Category:** bug
**Plugin:** `apps/claude-code/pr-review`
**GitHub:** [#120](https://github.com/unic/unic-agents-plugins/issues/120)

---

> **Alignment note (2026-05-26): this PRD is aligned with [ADR 0016](../../adr/0016-fold-thread-fetch-into-ado-fetcher.md) as merged.** Three points in the original GitHub issue body diverged from the merged ADR and are corrected here:
>
> 1. **Thread-fetch 5xx/network handling.** Applies ADR 0015's standard mapping: `5xx / network → DEGRADED` with `kind: thread-fetch`, treating empty threads as first-review. The earlier "ABORTED exemption" framing is superseded.
> 2. **ADR amendment chain.** ADR 0016 amends only ADR 0013. ADR 0015 was separately amended by ADR 0018 (fan-out resilience), unrelated to thread fetch.
> 3. **`kind: thread-fetch` Notice.** A new `NoticeKind` IS added (DEGRADED tier for 5xx / network on the threads endpoint).
>
> **Foundation context.** The two prior pr-review PRDs (`pr-review-ado-fetcher-reliability`, `pr-review-platform-failure-handling`) have both landed. The 4-tier Notice doctrine, `scripts/ado/` helpers (`classify-http-error`, `notices`, `parse-write-response`), `DIFF_RANGE` sentinel, and Trailer are in place. Spec 12 plugs into that foundation — no overlap, clean dependency.

## Problem Statement

Since the pr-review orchestrator-split shipped (ADR 0013), every ADO PR Review fails at Step 4. The orchestrator calls `az repos pr thread list` — a CLI subcommand that does not exist in the `azure-devops` extension. The LLM-as-orchestrator silently improvises around the broken command instead of bailing, bypassing the ADO Fetcher entirely and producing inconsistent reviews. Observed symptoms: comments anchored to wrong iterations, mode misdetection on re-review-eligible PRs, and a fragile dependence on the LLM guessing the right metadata.

Additionally, there is no test that asserts every `az` command the plugin uses actually exists in the installed extension — so a Microsoft rename or removal of any subcommand would surface only in production, exactly as `az repos pr thread list` did.

## Solution

Fold thread fetching and mode detection into the ADO Fetcher (the agent that already owns ADO read operations). The orchestrator's Step 4 becomes a single `az repos pr show` metadata call; threads are fetched via the canonical `az devops invoke --area git --resource pullRequestThreads` endpoint inside the Fetcher; the Fetcher returns mode-derived fields in its output block.

Add a CI smoke test that runs `--help` on every `az` command the plugin uses, plus an inventory-completeness check that grep-validates every `az ` invocation in the source against a registered inventory file.

## User Stories

1. As a developer running `/pr-review:review-pr <ADO PR URL>`, I want Inline Comments to land at the correct file and line in Azure DevOps, so that my team gets the review feedback in the place it belongs.
2. As a developer reviewing a PR for the second time, I want Re-review mode to be correctly detected, so that the plugin replies to existing Review Threads instead of duplicating them.
3. As a developer hitting a transient 5xx on thread fetch, I want a DEGRADED Notice surfaced in the Review Summary and the run to proceed in first-review mode, consistent with ADR 0015's HTTP-tier mapping.
4. As a developer running the plugin on a fresh ADO PR with no prior threads (404 on the threads endpoint), I want the run to proceed cleanly as first-review, so that "no threads yet" is not treated as an error.
5. As a developer hitting an auth failure (401/403) on thread fetch, I want a clear `az devops login` hint and an aborted run, so that I know the recovery action.
6. As a plugin maintainer, I want every `az` command the plugin uses to be registered in a single inventory file, so that there is one source of truth for the plugin's ADO CLI surface.
7. As a plugin maintainer, I want CI to fail when an `az` subcommand the plugin uses no longer resolves to a real command, so that Microsoft renames don't ship undetected.
8. As a plugin maintainer adding a new `az` call to any agent, I want a test to fail until I've registered the command in the inventory, so that I can't silently expand the plugin's CLI surface without test coverage.
9. As a plugin maintainer, I want the `SIGNATURE_PREFIX` literal to live as an exported constant in `mode-detection.mjs`, so that there is no risk of string drift between the orchestrator and the Fetcher.
10. As a CI operator, I want the smoke test to install `azure-cli` on exactly one Linux matrix cell, so that the protection is real without paying install cost on every cell.
11. As a developer running tests locally without `azure-cli` installed, I want the CLI smoke test to skip cleanly while the inventory-completeness test still runs, so that I can verify the inventory contract without installing `az`.

## Implementation Decisions

**Architectural changes (spec 12 — Slice 01):**

- Thread fetch + mode detection move from the orchestrator's Step 4 into the ADO Fetcher. Recorded in [ADR 0016](../../adr/0016-fold-thread-fetch-into-ado-fetcher.md) (already merged).
- The Fetcher loses its current Step 1 (`az repos pr show`). That call moves to the orchestrator's Step 4, and the captured fields (`REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION`) are passed to the Fetcher as literal-string inputs in its prompt.
- The Fetcher gains a new step between iterations and changed-files: fetch threads via `az devops invoke --area git --resource pullRequestThreads --route-parameters "project=… repositoryId=… pullRequestId=…"`, then call `detectMode` on the response.
- The Fetcher's output block grows by five fields: `RAW_THREADS_JSON`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`. The orchestrator parses these from the output block and uses them in Step 7's Coordinator/Writer branching.
- **Thread-fetch failure mapping (aligned with ADR 0016):** `401/403` → ABORTED (re-auth hint); `404` → OK (treat as "no threads yet" → first-review); `5xx` / network → DEGRADED with `kind: thread-fetch`, treat as empty threads → first-review. This follows ADR 0015's standard HTTP-tier mapping; no exemption.
- `scripts/mode-detection.mjs` gains an exported constant `SIGNATURE_PREFIX = '🤖 *Reviewed by Claude Code*'`. The Fetcher imports it directly. No prompt-literal `SIGNATURE_PREFIX` input.
- `agents/re-review-coordinator.md` lines 27 and 471 lose their references to `az repos pr thread list` as the data source — `RAW_THREADS_JSON` now flows from the Fetcher's output block via the orchestrator, not from a (broken) orchestrator-level call.

**Hardening (spec 14 — Slice 02):**

- A new inventory file enumerates every `az` command the plugin uses, including `--area`/`--resource` combinations. Initial entries: `az repos pr show`, `az repos pr checkout`, `az devops invoke --area git --resource {pullRequestThreads | pullRequestIterations | pullRequestIterationChanges | pullRequestWorkItems | pullRequestThreadComments}`, `az boards work-item show`.
- A new allowlist file enumerates intentional exceptions to the inventory: `az --version`, `az extension list`, and error-message-only hints like `az devops login` and `az extension add`. Each entry is documented inline with the reason for exemption.
- A new deep module `scripts/ado/cli-completeness.mjs` (following the `scripts/ado/` pattern PRD A established) exports `findUninventoriedCommands({ sources, inventory, allowlist }) → string[]`. Pure function. Handles multi-line bash blocks, backslash continuations, and `--area`/`--resource` split across lines.
- A new smoke test has two cases:
  1. **Inventory-completeness** — pure-JS, runs everywhere. Reads `agents/`, `commands/`, `scripts/` source files; calls `findUninventoriedCommands`; asserts the result is empty.
  2. **CLI smoke** — integration test, requires `az` on PATH. Iterates the inventory; runs each entry's `--help` via `child_process.spawnSync` with a 5s timeout; asserts exit 0 and that `helpKeywordsRequired` substrings appear in stdout. `t.skip` when `az` is absent.
- CI installs `azure-cli` + the `azure-devops` extension on a single matrix cell only (`ubuntu-latest × Node 24`), via a conditional workflow step. Other matrix cells skip the CLI smoke test cleanly.
- The orchestrator's Step 3 preflight gains an assertion: `az devops invoke --help` must exit 0. On failure, exit with re-install instructions.
- `AGENTS.md` gets a single pointer paragraph to the inventory file. No mirrored command table — the inventory is the only source of truth.

## Testing Decisions

Assert external behaviour against module contracts, not internal regex shape. Feed fixture markdown into `findUninventoriedCommands`, assert the returned array. Don't assert on internal helper functions or intermediate parser state.

**Modules to test:**

- `scripts/ado/cli-completeness.mjs` (new). Fixture-style cases: empty source; single inline `az` command; multi-line bash block with backslash continuation; `--area`/`--resource` split across lines; allowlist filtering; uninventoried command surfaces correctly; mixed allowlisted + inventoried + uninventoried.
- `scripts/mode-detection.mjs`. Extend `tests/mode-detection.test.mjs` with one case asserting `SIGNATURE_PREFIX` equals the canonical literal `🤖 *Reviewed by Claude Code*`. Catches accidental edits to the constant.

**Integration (not unit):**

- The CLI smoke test (`tests/ado-cli-smoke.test.mjs`'s second case) is an integration test that requires `az`. It skips on machines/cells without the CLI installed.

**Prior art:** existing tests follow the `node:test` ESM pattern with `// @ts-check`, fixture inputs, and `assert.deepStrictEqual`-style assertions. `tests/parse-diff-hunks.test.mjs` is the closest reference for the completeness parser tests; `tests/mode-detection.test.mjs` is the file to extend with the `SIGNATURE_PREFIX` assertion.

## Out of Scope

- The duplicate-comment bug from issue #46. Different root cause (ADO Writer's multi-script batching + spurious threadContext-rejection fallback). Independent investigation, independent fix.
- Replacing `az` with direct REST calls. Considered and rejected: `az` handles token acquisition and corporate TLS-inspecting proxies that bare REST does not.
- Invoking the global `azure-devops-cli` skill from the plugin. ADR 0008 keeps pr-review self-contained.
- Validating ADO REST response shapes against schemas. If response drift becomes a real failure mode, that's future work.
- Running the CLI smoke test on macOS/Windows in CI. The smoke test's purpose is catching Microsoft API changes, which surface identically across OSes — one Linux runner is sufficient.

## Further Notes

- **Severity.** Slice 01 is P0. Every ADO PR review currently runs through an improvised LLM workaround that bypasses the documented architecture. The user's most recent run produced Inline Comments anchored to wrong locations.
- **Why combined PRD.** Slice 02's inventory-completeness check immediately validates Slice 01's new `pullRequestThreads` registration. Shipping them together is one CHANGELOG entry, one review cycle, and one patch bump.
- **Related but independent.** Issue #46 (duplicate threads) was filed against the same plugin and looked like it might share a root cause. Investigation confirmed they are independent: the PR in issue #46 had two iterations (so "Iteration 2" in the signature was correct), and the duplication pattern matches an ADO Writer concern (multi-script restart + spurious fallback), not a Fetcher concern.
