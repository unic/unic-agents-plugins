# 12. Fix Step 4 — fold thread fetch into ADO Fetcher

- Priority: P0
- Effort: M
- Version impact: patch (bug fix; orchestrator delegation change is internal)
- Depends on: —
- Touches: `commands/review-pr.md`, `agents/ado-fetcher.md`, `scripts/mode-detection.mjs` (export `SIGNATURE_PREFIX`), new `docs/adr/0016-fold-thread-fetch-into-ado-fetcher.md`, `docs/adr/0013-orchestrator-split-for-review-pr.md` (status amendment), `docs/adr/0015-canonical-http-tier-mapping.md` (status amendment — thread-fetch exemption), `docs/adr/README.md`, `docs/plans/README.md`, `CHANGELOG.md`

## Context

The orchestrator's Step 4 calls `az repos pr thread list --id "$PR_ID" --org "$ORG_URL" --output json`. That subcommand does **not exist** in the `azure-devops` extension — valid `az repos pr` subcommands are `create / list / show / update / work-item / set-vote / reviewer / policy / checkout`. There is no `thread` group. Every ADO PR review since the orchestrator-split shipped has been failing at Step 4 with `ERROR: 'thread' is misspelled or not recognized`, hitting the fatal `exit 1` immediately after.

The first observed-in-the-wild failure is the 2026-05-14 dry-run captured in `docs/conversations/pr-review-dry-run-01.txt`. In that run the LLM-as-orchestrator improvised an inline data-fetch path instead of bailing — masking the bug as a partial success that bypassed the `pr-review:ado-fetcher` agent entirely.

ADR 0013 explicitly carved out Step 4 as "the one allowed inline ADO call" in the orchestrator. That carve-out is no longer worth its weight: (1) the inline call as documented is invalid syntax, (2) the data Step 4 needs (`RAW_THREADS_JSON`) is naturally adjacent to the data the Fetcher already fetches in Step 5 (`pullRequestIterations`, `pullRequestIterationChanges`, `pullRequestWorkItems`). Folding thread fetching into the Fetcher removes all `az devops invoke` from the orchestrator and consolidates ADO read knowledge in one place.

## Current behaviour

- Step 4 runs `az repos pr thread list ...` — exits non-zero on every run.
- Step 4 is the only place the orchestrator calls `az devops invoke`-shaped ADO data (in spirit; the actual call uses the invalid `az repos pr thread` path).
- `scripts/mode-detection.mjs` is invoked inline in Step 4.
- The Fetcher's result block emits: `ORG_URL`, `PROJECT`, `PR_ID`, `REPO_ID`, `PR_TITLE`, `PR_DESCRIPTION`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `LATEST_ITERATION_ID`, `LATEST_COMMIT_SHA`, `DIFF_RANGE`, `WORK_ITEM_IDS`, `NOTICES`, `CHANGED_FILES`, `RAW_DIFF`.

## Target behaviour

- Step 4 in the orchestrator runs `az repos pr show` only (capturing `REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION`). These values are passed into the Fetcher as literal-string inputs. No duplicate `az repos pr show` call inside the Fetcher.
- A new Step 5a inside the Fetcher (between iterations and changed-files) fetches threads via `az devops invoke --area git --resource pullRequestThreads --route-parameters "project=$PROJECT" "repositoryId=$REPO_ID" "pullRequestId=$PR_ID"`.
- The Fetcher invokes `detectMode` (from `scripts/mode-detection.mjs`) on the thread response and adds `RAW_THREADS_JSON`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID` to its result block.
- The orchestrator's Step 4 becomes the metadata fetch; mode detection is read from the Fetcher's result block after Step 5 completes.
- ADR 0013's "one allowed inline ADO call" carve-out is removed by an amending ADR (0016). The orchestrator's only remaining inline `az` calls are `az --version`, `az extension list` (preflight, Step 3) and `az repos pr show` (metadata, Step 4).
- A thread-fetch failure on `pullRequestThreads` aborts on every transport failure — `401/403 → ABORTED` (re-auth hint), `5xx / network → ABORTED` (transient but unsafe to default), `404 → OK` (treated as "no threads yet"; equivalent to first-review). This is a deliberate **exemption from ADR 0015's blanket 5xx-DEGRADED rule** because thread fetch drives mode selection: defaulting to first-review on a re-review-eligible PR would post duplicate threads (the issue #46 pattern) and violates CONTEXT.md's ABORTED-for-mode-misdetection invariant. The exemption is recorded in ADR 0016 and ADR 0015 is amended accordingly.

## Affected files

| File | Change |
|---|---|
| `commands/review-pr.md` | Step 4: replace inline `az repos pr thread list` block with `az repos pr show` metadata fetch; parse REPO_ID/PROJECT/branches/title/description. Pass these into the Fetcher prompt. Step 5: parse `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`, `RAW_THREADS_JSON` from the Fetcher's result block. |
| `.agents/ado-fetcher.md` | New "Step 1.5 — Fetch PR threads + detect mode" between iterations (Step 2) and changed-files (Step 3). Accept inputs from Step 4 as literal strings (`REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION`) and skip the `az repos pr show` call originally in Step 1. Add `RAW_THREADS_JSON`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID` to the result block. Add a `kind: thread-fetch` Notice emission path on degraded fetch. |
| `docs/adr/0016-fold-thread-fetch-into-ado-fetcher.md` | New ADR amending ADR 0013. |
| `docs/adr/0013-orchestrator-split-for-review-pr.md` | Status line: `Accepted (2026-05), amended by 0016`. |
| `docs/adr/README.md` | Add row 0015 (currently missing from the index) and row 0016. |
| `docs/plans/README.md` | Add row 12. |
| `CHANGELOG.md` | `Fixed` entry under `[Unreleased]` describing the Step 4 bug and the fold-into-Fetcher refactor. |

No new helper modules. `scripts/mode-detection.mjs` gains an exported `SIGNATURE_PREFIX` constant (`'🤖 *Reviewed by Claude Code*'`) so the Fetcher can import it directly rather than receive it as a prompt literal. Its `detectMode` invocation site moves from the orchestrator's Step 4 to the Fetcher's new Step 2.5; orchestrator no longer needs to know the prefix.

## Implementation steps

### 1. Write ADR 0016

Two coupled decisions, both recorded in ADR 0016:

1. **Amend ADR 0013's "one allowed inline ADO call" carve-out.** Thread fetching + mode detection moves into the Fetcher. The carve-out existed because mode detection had to precede Fetcher launch; consolidating mode-derived fields into the Fetcher's result block removes that constraint.

2. **Amend ADR 0015's blanket 5xx → DEGRADED rule with a thread-fetch exemption.** Thread fetch drives mode selection. A 5xx default of "treat as empty → first-review" would post duplicate threads on re-review-eligible PRs (the issue #46 failure pattern, now caused by ADO outage instead of Writer bug). CONTEXT.md's ABORTED-Notice-Tier definition explicitly lists "mode misdetection" as cross-run state corruption. Therefore 5xx / network on `pullRequestThreads` is ABORTED, not DEGRADED. ADR 0015's HTTP-tier mapping remains correct for every other ADO read.

### 2. Amend ADR 0013 and ADR 0015

- ADR 0013 status: `**Status:** Accepted (2026-05), amended by 0016`. Closing sentence: *"The 'one allowed inline ADO call' carve-out (mode-detection thread list) is removed by ADR 0016 — see that ADR for rationale."*
- ADR 0015 status: `**Status:** Accepted, amended by 0016 (thread-fetch exemption)`. Closing sentence in its "No retries in v1" section: *"Thread fetch is the one ADO read exempt from the blanket 5xx → DEGRADED rule — see ADR 0016 for rationale."*

### 3. Update `.agents/ado-fetcher.md`

Add new inputs to the Inputs section:

```
- `REPO_ID` — captured by the orchestrator in Step 4 from `az repos pr show`
- `PROJECT` — captured by the orchestrator in Step 4
- `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION` — captured by the orchestrator in Step 4

`SIGNATURE_PREFIX` is **not** a Fetcher input — it is imported from `scripts/mode-detection.mjs` as an exported constant (see "Out of scope" section's removal note).
```

Remove the existing Step 1 (`az repos pr show`). Renumber subsequent steps. Insert a new step between iterations (current Step 2) and changed-files (current Step 3):

```
## Step 2.5 — Fetch PR threads and detect mode

az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "project=$PROJECT" "repositoryId=$REPO_ID" "pullRequestId=$PR_ID" \
  --org "$ORG_URL" \
  --api-version "7.1" \
  --output json 2>/tmp/ado_fetcher_threads.err
```

On non-zero exit:
- 401 / 403 → ABORTED with `az devops login` hint.
- 404 → OK; treat `RAW_THREADS_JSON` as `{"value":[]}` (no threads yet — fresh PR). Distinguishable from "PR not found" because the orchestrator's Step 4 (`az repos pr show`) already succeeded.
- 5xx / network error → ABORTED with message: *"Thread fetch failed (transient HTTP error). Cannot safely detect Review mode — retry the review."* Re-run is the recovery path; no Notice emitted (ABORTED goes to stderr + Trailer, not the Notices array).

**No new `kind` is added to the `NoticeKind` union.** The original draft of this spec added `kind: thread-fetch`, but with 5xx now ABORTED, the only DEGRADED-emitting code path would be 404 — which is OK, not DEGRADED. So the existing kinds are sufficient.

Run `detectMode` from `scripts/mode-detection.mjs` against the `.value` array. Capture `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`.

Extend the result block with five new lines after `WORK_ITEM_IDS`:

```
RAW_THREADS_JSON:
{RAW_THREADS_JSON}
MODE: {MODE}
IS_REREVIEW: {IS_REREVIEW}
PRIOR_ITERATION_ID: {PRIOR_ITERATION_ID}
SUMMARY_THREAD_ID: {SUMMARY_THREAD_ID}
```

### 4. Rewrite Step 4 in `commands/review-pr.md`

Replace the existing Step 4 block. New Step 4:

```bash
PR_SHOW_ERR="${TMPDIR:-/tmp}/pr_show.err"
PR_SHOW_JSON=$(az repos pr show --id "$PR_ID" --org "$ORG_URL" --output json 2>"$PR_SHOW_ERR") || {
  echo "ERROR: failed to fetch PR metadata via az repos pr show. Try \`az devops login\` to re-authenticate." >&2
  cat "$PR_SHOW_ERR" >&2; exit 1; }
```

Parse `repository.id`, `repository.project.name`, `sourceRefName`, `targetRefName`, `title`, `description` into `REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION` (stripping `refs/heads/` from the branches).

Step 4 no longer invokes `scripts/mode-detection.mjs` and no longer emits `MODE` / `PRIOR_ITERATION_ID` directly.

### 5. Update Step 5 in `commands/review-pr.md`

Add the new inputs to the Fetcher prompt:

```
Agent(
  subagent_type: "pr-review:ado-fetcher",
  prompt: "Fetch all ADO data for this PR review.
  ORG_URL: {ORG_URL}
  PROJECT: {PROJECT}
  PR_ID: {PR_ID}
  REPO_ID: {REPO_ID}
  SOURCE_BRANCH: {SOURCE_BRANCH}
  TARGET_BRANCH: {TARGET_BRANCH}
  PR_TITLE: {PR_TITLE}
  PR_DESCRIPTION: {PR_DESCRIPTION}
  SIGNATURE_PREFIX: 🤖 *Reviewed by Claude Code*
  PRIOR_ITERATION_ID: <unused — Fetcher derives this from threads>
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}"
)
```

After parsing `ADO_FETCHER_RESULT`, extract the five new fields and assign them to the orchestrator's `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`, `RAW_THREADS_JSON`. Print `Mode detected: $MODE`.

### 6. Update Step 7 in `commands/review-pr.md`

The Coordinator prompt continues to receive `RAW_THREADS_JSON` from the orchestrator; no change required other than ensuring the value comes from the Fetcher's result block, not from the deleted Step 4.

### 7. Update READMEs and CHANGELOG

- `docs/plans/README.md`: add row 12.
- `docs/adr/README.md`: add row 0015 (Canonical HTTP-Tier Mapping — missing from index) and row 0016.
- `CHANGELOG.md`: under `[Unreleased]`, add `### Fixed` entry: *Step 4 mode detection was calling a non-existent `az repos pr thread list` subcommand and failing fatally on every ADO PR review. Thread fetching now lives in the ADO Fetcher and uses `az devops invoke --resource pullRequestThreads`.*

## Verification

- Run `/pr-review:review-pr <fresh PR URL>`: Fetcher emits `MODE: first-review`, `IS_REREVIEW: false`, `PRIOR_ITERATION_ID:` (empty), `SUMMARY_THREAD_ID:` (empty). Run proceeds through Step 6.
- Run `/pr-review:review-pr <PR with prior bot signature>`: Fetcher emits `MODE: re-review`, `IS_REREVIEW: true`, `PRIOR_ITERATION_ID: <N>`, `SUMMARY_THREAD_ID: <thread id>`. Step 7 invokes Coordinator with the same `RAW_THREADS_JSON`.
- Confirm orchestrator no longer contains any `az devops invoke` calls; only `az --version`, `az extension list`, `az repos pr show`.
- Confirm Fetcher no longer contains a `az repos pr show` call (the metadata is passed in).
- Simulate a 5xx on `pullRequestThreads`: Fetcher aborts with retry message; run stops before Step 6 fan-out; Trailer reflects ABORTED status. No Notice in any Summary block (run never produces one).
- Simulate 401 on `pullRequestThreads`: Fetcher aborts with `az devops login` hint.
- Simulate 404 on `pullRequestThreads` against a PR that exists (Step 4 PR-show succeeded): Fetcher treats threads as empty and proceeds in `first-review` mode.

## Acceptance criteria

- [ ] `az repos pr thread list` appears nowhere in the repo (grep returns no matches outside `docs/conversations/`).
- [ ] `commands/review-pr.md` contains no `az devops invoke` lines.
- [ ] `.agents/ado-fetcher.md` Step 2.5 calls `az devops invoke --area git --resource pullRequestThreads`.
- [ ] Fetcher result block includes `RAW_THREADS_JSON`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`.
- [ ] ADR 0013 status line ends with `, amended by 0016`.
- [ ] ADR 0015 status line ends with `, amended by 0016 (thread-fetch exemption)`.
- [ ] ADR 0016 exists and records both amendments (carve-out removal + thread-fetch ABORT exemption).
- [ ] `scripts/mode-detection.mjs` exports `SIGNATURE_PREFIX` and the Fetcher imports it (no `SIGNATURE_PREFIX` input in the Fetcher's prompt contract).
- [ ] `docs/adr/README.md` lists 0015 and 0016.
- [ ] CHANGELOG `[Unreleased]` has a `Fixed` entry.

## Out of scope

- A `kind: thread-fetch` Notice emission path. Considered and removed once the 5xx mapping flipped to ABORTED (see "Target behaviour"). `classify-http-error.mjs` is still used to detect 5xx but its result drives an abort, not a Notice.
- No change to `scripts/mode-detection.mjs`.
- No change to the Re-review Coordinator's downstream behaviour.
- Dry-run mode (spec 13) — handled separately.
- Fan-out resilience (spec 15) — handled separately.
