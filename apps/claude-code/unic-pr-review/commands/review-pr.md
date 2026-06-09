---
allowed-tools: Agent, Bash(az *), Bash(node *), Bash(git *)
argument-hint: [<PR URL>] [--post] [--yes]
description: Review a pull request or your local branch. Pass an Azure DevOps PR URL to review an open PR; add --post to enter the Approval Loop and write to ADO; omit the URL to review your local branch against its upstream base (Pre-PR mode).
---

# unic-pr-review:review-pr

Runs an AI-powered code review. Without a URL the Plugin operates in **Pre-PR mode** — it computes the diff of your local branch against the resolved upstream base branch, determines which Review Aspect agents to spawn based on the changed files (ADR-0008), fans out to those agents in parallel, and prints the merged Review Summary in the terminal. Nothing is written to ADO.

With `--post` (ADO mode only) the Plugin enters the **Approval Loop** after the preview: you walk each Finding one at a time with accept / edit / skip choices, then the ADO Writer posts only the approved Findings as Review Threads plus the Review Summary as a General Comment Thread. `--post --yes` bulk-accepts all Findings without prompting.

## Step 1 — Detect mode and route

Parse all arguments passed to the command:

- **PR URL**: the first argument that is not a flag (does not start with `--`). If absent, use Pre-PR mode.
- **`IS_POST`**: true when `--post` is among the arguments.
- **`IS_YES`**: true when `--yes` is among the arguments.

### Path A: No argument → Pre-PR mode

Continue to Step 2.

### Path B: URL given → ADO first-review

#### Step 1.1 — Detect provider

```sh
node "${CLAUDE_PLUGIN_ROOT}/providers/index.mjs" detect "<URL>"
```

- **Exit 0**: stdout is a JSON object. Parse it: `PROVIDER_NAME`, `FETCHER_AGENT` (e.g. `unic-pr-review:ado-fetcher`).
- **Exit 1** (no provider matched): print `"Unsupported PR URL: <URL>. Only Azure DevOps URLs (dev.azure.com or *.visualstudio.com) are currently supported."` and stop.

#### Step 1.2 — Parse the PR URL

```sh
node "${CLAUDE_PLUGIN_ROOT}/providers/index.mjs" parse-url "<URL>"
```

- **Exit 0**: stdout is `{ orgUrl, project, repo, prId }`. Store as `PR_REF`.
- **Exit non-zero**: relay stderr verbatim and stop.

Also compute `PR_KEY` — the 16-hex state-directory key derived from the PR URL (used by the Approval Loop and cleanup):

```sh
node -e "
const {createHash}=require('node:crypto')
process.stdout.write(createHash('sha256').update('<URL>','utf8').digest('hex').slice(0,16))
"
```

Store the output as `PR_KEY`.

#### Step 1.2a — Check for Write Retry (ADR-0015)

Default `IS_WRITE_RETRY = false`. This step only applies when `IS_POST` is true and the provider is ADO (Write Retry has no meaning in a preview or Pre-PR run); when `IS_POST` is false, skip directly to Step 1.3.

A surviving Approval Loop state directory means the prior `--post` attempt did not complete (it is deleted only on a fully-successful write — ADR-0014). Before invoking the Fetcher, classify the re-run by comparing the saved `headSha` to the current HEAD.

Get the current HEAD:

```sh
git rev-parse HEAD
```

Capture as `HEAD_SHA`, then classify:

```sh
HEAD_SHA="<HEAD_SHA>" node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/write-outcomes.mjs" check "<PR_KEY>"
```

stdout is a JSON object. Route on its `mode`:

- **`{ "mode": "none" }`** → no prior state (or it was unreadable); proceed to Step 1.3 (normal review).
- **`{ "mode": "retry", "state": … }`** → **Write Retry**: set `IS_WRITE_RETRY = true`, store `state` as `WRITE_RETRY_STATE`, and set `CURRENT_ITERATION = WRITE_RETRY_STATE.iteration ?? 1`. Skip Steps 1.3–1.10 entirely (no Fetcher, no mode detection, no aspect fan-out) and go straight to Step 1.11 — the saved approval decisions are reused, nothing is re-prompted.
- **`{ "mode": "stale" }`** → the partial attempt is from a different HEAD (force-push / rebase). Print the Notice, discard the stale state directory, then proceed to Step 1.3 (normal review against the new HEAD):

  ```
  Notice: Prior --post state is stale (saved HEAD differs from current HEAD). Discarding saved state and running a normal review against the new HEAD.
  ```

  ```sh
  node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/clear-state-dir.mjs" "<PR_KEY>"
  ```

#### Step 1.3 — Invoke the ADO Fetcher agent

Use the Agent tool to launch the agent identified by `FETCHER_AGENT` (e.g. `unic-pr-review:ado-fetcher`). Provide:

```json
{ "orgUrl": "<PR_REF.orgUrl>", "project": "<PR_REF.project>", "repo": "<PR_REF.repo>", "prId": <PR_REF.prId> }
```

Wait for the agent to complete. It returns a JSON object:

```json
{
  "prMetadata": {},
  "revisions": {},
  "threads": {},
  "changedFiles": [],
  "rawDiff": "...",
  "diffUnavailable": true,
  "warnings": []
}
```

- **Print any `warnings` entries** first (if present) so the user sees diagnostic context even on error.
- **If the agent returns an object with `"error"` set**:
  - `"fetch-failed"` → print `"ADO data fetch failed at step <step> (<resource>): <message>"` and stop.
  - Any other error key → print the error message verbatim and stop.
- Store `FETCHER_OUTPUT`.

#### Step 1.4 — Route by mode

Read `FETCHER_OUTPUT.mode` (the ADO Fetcher emits `"first-review"`, `"re-review"`, or `"first-review-fallback"` — see `agents/ado-fetcher.md` Step 3a).

**`mode === "first-review"` → continue to Step 1.5 as-is.** Set `IS_FALLBACK = false` and `CURRENT_ITERATION = 1`.

**`mode === "first-review-fallback"` (force-push path):**

Set `IS_FALLBACK = true`. Set `CURRENT_ITERATION = 1` (fresh review — the prior Revision is gone, so there is no prior iteration to increment). Set `fallbackToFirstReview: true` in `NOTICES_CONTEXT`. Continue to Step 1.5 using the first-review path; the force-push warning appears in the Notices block of the rendered summary.

**`mode === "re-review"` → re-review path:**

Set `IS_FALLBACK = false`. Set `CURRENT_ITERATION = FETCHER_OUTPUT.priorIteration + 1`.

**Any other `mode` value → abort.** Print `Unexpected mode value: <mode>. Aborting.` and stop. Do not proceed.

Then proceed through the shared steps with these re-review deltas:

- Step 1.5 (Work Items) — unchanged.
- Step 1.7 (resolve spawn set) — use `FETCHER_OUTPUT.changedFiles`, unchanged.
- Step 1.8 (spawn agents) — use `FETCHER_OUTPUT.deltaRawDiff` as the diff (NOT `rawDiff`, which is empty in re-review mode), and pass `FETCHER_OUTPUT.priorFindings` to each aspect agent (see **Step 1.8 extension** below).
- After Step 1.8 completes, invoke the Re-review Coordinator (see **Step 1.8a** below) before rendering.
- Step 1.9 (render) — add `ITERATION=<CURRENT_ITERATION>` to the `render-summary.mjs` env call and build `NOTICES_CONTEXT` from the Coordinator's `persistentUnaddressed` output (see **Step 1.9 extension** below).
- Step 1.10 (preview print) — print normally.
- Step 1.11 (Approval Loop) — **skip it in re-review mode** (the Coordinator's plan is the approved plan). If `IS_POST` is false, stop after the preview as usual. If `IS_POST` is true, skip directly to the **Step 1.12 extension** below.
- Step 1.12 (ADO Writer) — use the re-review writer input shape (see **Step 1.12 extension** below).

#### Step 1.5 — Discover Work Items

Write `FETCHER_OUTPUT.prMetadata` to a temp file (avoids shell-quoting the JSON), then pipe it in:

```sh
node "${CLAUDE_PLUGIN_ROOT}/providers/index.mjs" discover-work-items "<URL>" < "<temp file with prMetadata JSON>"
```

- **Exit 0**: stdout is a JSON array. Store as `WORK_ITEMS`.
- **Exit non-zero**: relay stderr and stop.

#### Step 1.6 — Spawn Intent Checker (only when `WORK_ITEMS` is non-empty)

Use the Agent tool to launch `agents/intent-checker.md`. Provide:

```json
{ "workItems": <WORK_ITEMS> }
```

Wait for the agent to complete. It emits one of:

- **A — hard-stop on unreachable Work Item** (ADR-0004): the linked Work Item itself could not be fetched (auth error, unreachable org URL, or unrecognised URL shape):

  ```json
  { "hardStop": true, "workItem": "<id>", "url": "<url>", "reason": "work-item-unreachable" }
  ```

  Print and **stop** — do not spawn any aspect agents:

  ```
  Intent gathering failed: Work Item <id> (<url>) could not be fetched (network error, unreachable org, or credentials rejected). If credentials may be misconfigured, run /unic-pr-review:setup-azure to reconfigure Azure credentials, then re-run the review. For transient network errors, re-running the review directly may suffice.
  ```

- **B — hard-stop on unreachable Atlassian source** (ADR-0004): a Confluence page embedded in the Work Item is unreachable:

  ```json
  { "hardStop": true, "url": "<url>", "setupCommand": "<cmd>" }
  ```

  Print and **stop** — same message as the Pre-PR path (Step 5):

  ```
  Intent gathering failed: <url> could not be fetched (unreachable, or its credentials were rejected). Run <setupCommand> to configure credentials, then re-run the review.
  ```

- **C — intent gathered**:

  ```json
  { "intentBrief": "<markdown>", "intentCheck": [ ... ] }
  ```

  Store `intentBrief` and `intentCheck`. If both empty, treat intent as absent (no intent gathering).

- **D — unexpected hard-stop**: `"hardStop": true` but shape matches neither A nor B — print the full JSON verbatim and **stop**. (Defensive fallback: should not occur if the Intent Checker follows its spec.)

#### Step 1.7 — Resolve spawn set

Use `FETCHER_OUTPUT.changedFiles` for the file list and the appropriate diff for content-aware gates (ADR-0008). In **first-review** and **first-review-fallback** modes use `FETCHER_OUTPUT.rawDiff`; in **re-review** mode use `FETCHER_OUTPUT.deltaRawDiff`. Build the analyser input object `{"files":[...paths...],"diff":"<unified diff string>"}` and write it to a temp file with Node (not `jq` — it is unavailable by default on Windows; a temp file also avoids shell-quoting the diff), then pipe the file in:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/changed-file-analyser.mjs" < "<temp file with {files,diff} JSON>"
```

When `FETCHER_OUTPUT.diffUnavailable` is `true`, pass an empty string for `diff` — `hasCommentChanges('')` returns false and the gate falls back to path-only.

- **Exit 0**: stdout is a JSON array of agent names. Store as `SPAWN_SET`.
- **Exit non-zero**: relay stderr and stop.

Print the spawn set to the terminal.

#### Step 1.8 — Spawn all agents in parallel (ADO mode)

**Guard — diff unavailable.** The Review Aspect agents (and the Intent Assessor) are diff-driven. The ADO Fetcher emits `diffUnavailable: true` whenever line-level diff could not be fetched (see `agents/ado-fetcher.md` Step 6). If `FETCHER_OUTPUT.diffUnavailable` is `true`:

- Do **not** spawn the aspect agents or the Intent Assessor — running them on an empty diff would produce a misleading "clean" review with zero findings.
- Set `FINDINGS_JSON` to an empty findings set so Step 1.9 still renders the available context (spawn set, changed files, and the Intent Check skeleton when present).
- Set `diffUnavailable: true` in the NoticesContext — this is the structural guarantee that the "not a clean review" notice fires; do **not** print a separate prose notice.
- Continue to Step 1.9 to render the preview, then Step 1.10.

Otherwise (`rawDiff` non-empty), proceed as in Step 7 (Pre-PR): launch every agent in `SPAWN_SET` simultaneously, seeding each with the diff (and `intentBrief` as a preamble when it is defined). Spawn the Intent Assessor in the **same parallel batch** when `intentBrief` is defined **and** the `intentCheck` skeleton is non-empty (ADR-0011) — it is never added to `SPAWN_SET`.

After all Phase 1 agents finish, evaluate and run the **Phase 2 gate** exactly as described in the Pre-PR Step 7 "Phase 2 — Code Simplifier" section (ADR-0013): call `shouldRunPhase2` with `FETCHER_OUTPUT.changedFiles` and the flattened Phase 1 findings; if true, launch `agents/code-simplifier.md` sequentially with the same diff input (and `intentBrief` preamble when defined), wait for it, and merge its output into the full findings set before proceeding to Step 1.9.

#### Step 1.9 — Merge findings and render (ADO mode)

Same as Step 8 (Pre-PR): merge all agents' findings and positive observations, run the overlay merger when the Assessor was spawned, and pass `FINDINGS_JSON`, `INTENT_CHECK_JSON` (if applicable), and `NOTICES_JSON` (if applicable) to `render-summary.mjs`. Always relay the helper's stderr; stop on a non-zero exit.

When `FETCHER_OUTPUT.diffUnavailable` is `true`, always include `NOTICES_JSON` in the render-summary call (even if no Assessor Notice applies), so the renderer structurally guarantees the "diff unavailable" notice is surfaced to the reviewer.

#### Step 1.10 — Print preview (ADO mode)

Print the rendered Review Summary markdown.

If `IS_POST` is **false**:

- Remind the user: _"This is a terminal preview only — nothing has been written to ADO. Pass `--post` to enter the Approval Loop and write Findings to the PR."_
- **Stop. Do not continue to Step 1.11 or Step 2.**

If `IS_POST` is **true**, continue to Step 1.11.

#### Step 1.11 — Run the Approval Loop

Abort early if the diffUnavailable guard fired (FETCHER_OUTPUT.diffUnavailable is true) and FINDINGS_JSON contains an empty findings array — there is nothing to post:

```
unic-pr-review: --post ignored — diff unavailable; nothing to write to ADO.
```

Otherwise:

**1. Write the findings to a temp file.**

Extract the `findings` array from `FINDINGS_JSON` and write it to a temp file for the Approval Loop:

```sh
PR_KEY="<PR_KEY>" FINDINGS_JSON='<FINDINGS_JSON>' node -e "
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const {findings}=JSON.parse(process.env.FINDINGS_JSON)
const f=path.join(os.tmpdir(),'unic-pr-review-findings-'+process.env.PR_KEY+'.json')
fs.writeFileSync(f,JSON.stringify(findings??[]))
process.stdout.write(f)
"
```

Capture the output path as `FINDINGS_FILE`.

**Write Retry delta (`IS_WRITE_RETRY` is true):** `FINDINGS_JSON` was never computed (Steps 1.3–1.10 were skipped). Write an empty JSON array to `FINDINGS_FILE` instead — the Approval Loop ignores it and reuses `state.json` because the saved `headSha` matches the current HEAD and `--reset` is absent:

```sh
PR_KEY="<PR_KEY>" node -e "
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const f=path.join(os.tmpdir(),'unic-pr-review-findings-'+process.env.PR_KEY+'.json')
fs.writeFileSync(f,'[]')
process.stdout.write(f)
"
```

**If the `node -e` script exits non-zero**, print the stderr verbatim and stop. Do not proceed with an empty or invalid findings path.

**2. Determine the approved-Findings path.**

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/temp-paths.mjs" approved "<PR_KEY>"
```

Capture as `APPROVED_FILE`.

**3. Get the current HEAD SHA.**

```sh
git rev-parse HEAD
```

Capture as `HEAD_SHA`.

**4. Get the plugin version.**

```sh
PLUGIN_JSON="${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json" node -e "
const {version}=JSON.parse(require('node:fs').readFileSync(process.env.PLUGIN_JSON,'utf8'))
process.stdout.write(version)
"
```

Capture as `PLUGIN_VERSION`.

**5. Run the Approval Loop.**

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/approval-loop.mjs" \
  --findings "<FINDINGS_FILE>" \
  --approved "<APPROVED_FILE>" \
  --key "<PR_KEY>" \
  --head-sha "<HEAD_SHA>" \
  --mode first-review \
  --plugin-version "<PLUGIN_VERSION>" \
  --iteration 1 \
  <--yes if IS_YES>
```

- **Exit 0**: continue to Step 1.12.
- **Exit 2** (non-TTY without --yes): print `"approval-loop: --post requires an interactive terminal or --yes."` and stop.
- **Any other non-zero exit**: relay stderr verbatim and stop.

**Write Retry post-loop (`IS_WRITE_RETRY` is true):** after the Approval Loop writes `APPROVED_FILE`, filter it down to only the Findings that were **not** already successfully posted, using the `postedMap` persisted in `state.json`:

```sh
APPROVED_FILE="<APPROVED_FILE>" node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/write-outcomes.mjs" filter "<PR_KEY>"
```

Then set `SUMMARY_ALREADY_POSTED = WRITE_RETRY_STATE.summaryPosted === true` for the Writer input in Step 1.12.

**6. Clean up the findings temp file.**

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/cleanup.mjs" "<FINDINGS_FILE>"
```

#### Step 1.12 — Spawn ADO Writer

Use the Agent tool to launch `unic-pr-review:ado-writer`. Provide:

```json
{
  "orgUrl":       "<PR_REF.orgUrl>",
  "project":      "<PR_REF.project>",
  "repo":         "<PR_REF.repo>",
  "prId":         <PR_REF.prId>,
  "approvedPath": "<APPROVED_FILE>",
  "iteration":    1
}
```

**Write Retry delta (`IS_WRITE_RETRY` is true):** use `CURRENT_ITERATION` (from `WRITE_RETRY_STATE.iteration`) instead of `1`, and add `summaryAlreadyPosted` so the Writer skips the Summary when it already landed:

```json
{
  "orgUrl":               "<PR_REF.orgUrl>",
  "project":              "<PR_REF.project>",
  "repo":                 "<PR_REF.repo>",
  "prId":                 <PR_REF.prId>,
  "approvedPath":         "<APPROVED_FILE>",
  "iteration":            <CURRENT_ITERATION>,
  "summaryAlreadyPosted": <SUMMARY_ALREADY_POSTED>
}
```

Wait for the agent to complete. It returns:

```json
{
  "inlineResults": [...],
  "summaryResult": { "success": true, "threadId": 200, "error": null },
  "success": true
}
```

Print the summary: how many inline threads were posted, how many failed, and the summary thread ID. On failures, print each error.

If `success` is `false` (any thread failed), warn the user:

```
⚠ Some threads could not be posted. The failed Findings are recorded in the local state directory — re-run with --post (not --post --yes) from the same machine and checkout to trigger Write Retry: the review is skipped and only the threads that failed are re-posted; the Summary is skipped if it already landed.

Caveats:
- Cross-machine: Write Retry is local. A retry from a different clone has no state directory and falls back to re-review, which sees an empty delta and produces zero Findings.
- HEAD moved: if the branch is force-pushed or rebased between the failed attempt and the retry, the stale state is discarded and a normal re-review runs instead.
- Do not use --yes: --post --yes bypasses the Approval Loop entirely and re-posts all approved Findings, creating duplicate comments for the ones that already succeeded.
```

#### Step 1.12a — Persist post outcomes (ADR-0015)

After the ADO Writer returns, and **before** the success-gated state-directory cleanup in Step 1.13, persist each Finding's post outcome and the Summary-posted flag into `state.json`. This is what lets a subsequent `--post` re-run use Write Retry (Step 1.2a) instead of silently dropping the failed Findings.

Pass the Writer's returned JSON object through `WRITER_RESULT`:

```sh
WRITER_RESULT='<writerResult JSON>' node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/write-outcomes.mjs" record "<PR_KEY>"
```

If the script exits non-zero, print a warning (`outcomes not persisted — a retry will re-post all Findings`) and continue to Step 1.13. Do not stop the run.

**This step applies to both the first-review path and the Write Retry path.** On a first attempt the resulting `postedMap` simply seeds the dedup state; on a fully-successful write Step 1.13 then deletes the whole state directory anyway, so the persisted outcomes are discarded together with it.

#### Step 1.13 — Cleanup

Delete the approved-Findings temp file (always — it is not needed for retries):

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/cleanup.mjs" "<APPROVED_FILE>"
```

**Only if the ADO Writer reported `success: true`**, delete the Approval Loop state directory:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/clear-state-dir.mjs" "<PR_KEY>"
```

If the writer reported `success: false`, leave the state directory in place so the user can retry with `--post` (not `--post --yes`) and the Approval Loop will resume from the saved state.

**After Step 1.13, stop. Do not continue to Step 2.**

### Re-review extensions (Path B, `mode === "re-review"`)

These sub-steps apply only when Step 1.4 routed to the re-review path. They replace or augment the like-numbered first-review steps as noted in Step 1.4.

#### Step 1.8 extension — Re-review: pass priorFindings to aspect agents

When `mode === "re-review"` and `FETCHER_OUTPUT.diffUnavailable` is false, pass `priorFindings` alongside the delta diff for each agent in `SPAWN_SET`. The agent input becomes:

```
Diff to review:

<FETCHER_OUTPUT.deltaRawDiff>

Prior Findings to re-assess:

<JSON.stringify(FETCHER_OUTPUT.priorFindings)>

[Optional: Intent Brief preamble when intentBrief is defined]
```

The aspect agents use `priorFindings` to emit `priorFindingVerdicts` in their output. Store the full aspect-agent response map as `ASPECT_RESPONSES` (keyed by agent name).

After the Phase 1 aspect agents complete, evaluate and run the **Phase 2 gate** (ADR-0013) using `FETCHER_OUTPUT.changedFiles` and the flattened Phase 1 findings from `ASPECT_RESPONSES`. If `shouldRunPhase2` returns true, launch `agents/code-simplifier.md` sequentially (with the delta diff and `intentBrief` preamble when defined), wait for it, and store its response alongside `ASPECT_RESPONSES` so the Coordinator receives the full finding set.

#### Step 1.8a — Invoke Re-review Coordinator (re-review mode only)

After all aspect agents complete, use the Agent tool to launch `unic-pr-review:re-review-coordinator`. Provide:

```json
{
  "orgUrl":           "<PR_REF.orgUrl>",
  "project":          "<PR_REF.project>",
  "repo":             "<PR_REF.repo>",
  "prId":             <PR_REF.prId>,
  "deltaRawDiff":     "<FETCHER_OUTPUT.deltaRawDiff>",
  "priorFindings":    <FETCHER_OUTPUT.priorFindings>,
  "priorIteration":   <FETCHER_OUTPUT.priorIteration>,
  "currentIteration": <CURRENT_ITERATION>,
  "rawThreadsJson":   <FETCHER_OUTPUT.threads.value>,
  "aspectFindings":   <ASPECT_RESPONSES>
}
```

Wait for the Coordinator to complete. It returns:

```json
{
  "threadActions": [...],
  "persistentUnaddressed": [...],
  "freshFindings": [...]
}
```

Store as `COORDINATOR_PLAN`.

On error (non-JSON output or an `"error"` field present): print the error verbatim and stop. Do not proceed to an ADO write without a valid plan.

#### Step 1.9 extension — Re-review: build NoticesContext with persistentUnaddressed

When `mode === "re-review"`, add to `NOTICES_CONTEXT`:

- `persistentUnaddressed: COORDINATOR_PLAN.persistentUnaddressed` — pass through unchanged; the Coordinator has already sorted by `sinceIteration` ascending.
- `priorVerdictSummary`: aggregate `priorFindingVerdicts` across all aspect agents into `{ fixed, partial, ignored }` counts.

Pass `ITERATION=<CURRENT_ITERATION>` as an env var to `render-summary.mjs`:

```sh
FINDINGS_JSON='<freshFindings from Coordinator, as a {findings, positiveObservations} object>' \
  INTENT_CHECK_JSON='<JSON.stringify(mergedIntentCheck) when applicable>' \
  NOTICES_JSON='<JSON.stringify(NOTICES_CONTEXT)>' \
  ITERATION="<CURRENT_ITERATION>" \
  node "${CLAUDE_PLUGIN_ROOT}/scripts/render-summary.mjs"
```

> Construct `FINDINGS_JSON` as `JSON.stringify({ findings: COORDINATOR_PLAN.freshFindings, positiveObservations: [] })`.

`FINDINGS_JSON` for re-review contains **only** `COORDINATOR_PLAN.freshFindings` (brand-new issues). Do NOT re-surface prior Findings here — those are handled by `COORDINATOR_PLAN.threadActions` (reply/resolve/reopen). Re-adding them would print them in the summary as if they were new.

Store the rendered output as `RENDERED_SUMMARY`.

#### Step 1.11 extension — Re-review: skip the Approval Loop

When `mode === "re-review"` and `IS_POST` is true, skip Steps 1.11 (1–6) entirely — there is no Approval Loop in re-review mode; the Coordinator's plan is the approved plan. Proceed directly to the Step 1.12 extension below.

#### Step 1.12 extension — Re-review: invoke ADO Writer with the coordinator plan

When `mode === "re-review"` and `IS_POST` is true, use the Agent tool to launch `unic-pr-review:ado-writer` with the re-review input shape:

```json
{
  "orgUrl":          "<PR_REF.orgUrl>",
  "project":         "<PR_REF.project>",
  "repo":            "<PR_REF.repo>",
  "prId":            <PR_REF.prId>,
  "mode":            "re-review",
  "coordinatorPlan": <COORDINATOR_PLAN>,
  "renderedSummary": "<RENDERED_SUMMARY>",
  "rawThreadsJson":  <FETCHER_OUTPUT.threads.value>,
  "iteration":       <CURRENT_ITERATION>
}
```

Wait for the agent to complete. It returns:

```json
{
  "threadActionResults": [...],
  "inlineResults": [...],
  "summaryResult": { "success": true, "threadId": 200, "error": null },
  "success": true
}
```

Print a summary: how many thread actions succeeded/failed, how many fresh-finding threads were posted, and whether the Summary was rewritten in place. On failures, print each error.

If `success` is false, warn the user (same partial-failure guidance as the first-review path). There is no Approval Loop state directory in re-review mode, so no cleanup is required.

**After the re-review writer step, stop. Do not continue to Step 2.**

## Step 2 — Resolve the base branch

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/base-branch-resolver.mjs"
```

- **Exit 0**: stdout contains the base branch name (e.g. `develop`). Store it as `BASE_BRANCH`.
- **Exit non-zero**: relay the error from stderr verbatim and stop. Do not proceed with an empty diff.

## Step 3 — Compute the diff

```sh
git diff "origin/${BASE_BRANCH}...HEAD"
```

Store the full unified diff output. Also retrieve the changed-files list:

```sh
git diff "origin/${BASE_BRANCH}...HEAD" --name-only
```

- **Empty diff** (no output from `--name-only`): print "Nothing to review: no local changes against `<BASE_BRANCH>`." and stop.

Before passing the diff to the aspect agents, sanity-check its size — extremely large
diffs will silently truncate at an agent's context window:

```sh
git diff "origin/${BASE_BRANCH}...HEAD" --shortstat
```

- **Diff exceeds ~2000 lines or ~200 KB**: warn the user that the review may be
  incomplete, and suggest splitting the work into smaller branches/PRs. The base
  branch is auto-resolved (ADR-0009) and cannot be overridden per run.

## Step 4 — Gather optional intent URLs

Prompt the user with this exact message:

```
Optional Work Item URLs (Jira/ADO Boards) and Confluence URLs, comma-separated. Press Enter to skip.
```

- **User presses Enter (empty response)** → set `PASTED_URLS` to the empty string. No
  intent gathering happens. Leave `intentBrief` and `intentCheck` undefined and skip to
  Step 6 (US 30: empty intent is legitimate).
- **User pastes one or more URLs** → store the full comma-separated string as `PASTED_URLS`
  and continue to Step 5.

## Step 5 — Spawn the Intent Checker agent (only when `PASTED_URLS` is non-empty)

Use the Agent tool to launch the `intent-checker` agent. Provide it this input:

```json
{ "pastedUrls": [<PASTED_URLS split on comma, each entry trimmed>] }
```

Wait for the agent to complete. It emits exactly one of:

- **A — hard-stop** (ADR-0004, US 29):

  ```json
  { "hardStop": true, "url": "<url>", "setupCommand": "<cmd>" }
  ```

  Print verbatim and **stop** — do not spawn any aspect agents and do not print a partial
  summary:

  ```
  Intent gathering failed: <url> could not be fetched (unreachable, or its credentials were rejected). Run <setupCommand> to configure credentials, then re-run the review.
  ```

  The hard-stop fires for both `unreachable` and `auth-error` kinds (ADR-0004), so the
  message stays accurate without claiming the cause is a network failure.

- **B — intent gathered**:

  ```json
  { "intentBrief": "<markdown>", "intentCheck": [ ... ] }
  ```

  Store `intentBrief` (a markdown string) and `intentCheck` (an array). If `intentBrief`
  is an empty string and `intentCheck` is an empty array, treat intent as absent (leave
  both undefined). Continue to Step 6.

## Step 6 — Resolve the spawn set

Run the changed-file-analyser with both the changed-files list and the full diff so the content-aware gates (ADR-0008) can fire. Build the `{"files":[...paths...],"diff":"..."}` input with Node (not `jq` — it is unavailable by default on Windows) and pipe it to the analyser:

```sh
node -e "
const {execFileSync}=require('node:child_process')
const range='origin/'+process.env.BASE_BRANCH+'...HEAD'
const files=execFileSync('git',['diff',range,'--name-only'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean)
const diff=execFileSync('git',['diff',range],{encoding:'utf8',maxBuffer:1e9})
process.stdout.write(JSON.stringify({files,diff}))
" BASE_BRANCH="${BASE_BRANCH}" | node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/changed-file-analyser.mjs"
```

- **Exit 0**: stdout contains a JSON array of agent names, e.g. `["code-reviewer","silent-failure-hunter"]`. Store it as `SPAWN_SET`.
- **Exit non-zero**: relay stderr verbatim and stop.

Print the spawn set to the terminal so the user can see which agents will run:

```
Spawning agents: code-reviewer, silent-failure-hunter, pr-test-analyzer
```

## Step 7 — Spawn all agents in parallel

Use the Agent tool to launch every agent in SPAWN_SET simultaneously. Do not wait for one agent to finish before starting the next — launch all at once.

For each agent name in SPAWN_SET, launch an Agent task with this exact input:

- **When `intentBrief` is defined** (intent was gathered in Step 5), append it verbatim
  as a preamble after the diff so the agent can reference acceptance criteria. This is the
  broadcast point: every aspect agent spawned in the fan-out batch receives the same
  `intentBrief` block. Provide this input:

  ```
  Diff to review:

  <full unified diff from Step 3>

  Intent Brief:

  <intentBrief>
  ```

- **When `intentBrief` is undefined** (no URLs pasted or empty intent), provide the diff
  alone:

  ```
  Diff to review:

  <full unified diff from Step 3>
  ```

Agent-name to agent-file mapping:

| Agent name              | Agent file (relative to CLAUDE_PLUGIN_ROOT) |
| ----------------------- | ------------------------------------------- |
| `code-reviewer`         | `agents/code-reviewer.md`                   |
| `silent-failure-hunter` | `agents/silent-failure-hunter.md`           |
| `type-design-analyzer`  | `agents/type-design-analyzer.md`            |
| `pr-test-analyzer`      | `agents/pr-test-analyzer.md`                |
| `comment-analyzer`      | `agents/comment-analyzer.md`                |
| `code-simplifier`       | `agents/code-simplifier.md`                 |

Wait for all agents to complete. Each returns a JSON object:

```json
{ "findings": [...], "positiveObservations": [...] }
```

Store every response. If an agent returns something other than a JSON object, log a warning to the user (include the agent name) and continue with the remaining agents — do not abort the whole review.

### Intent Assessor (parallel, when applicable)

Before waiting for agent completion, when `intentBrief` is defined **and** `intentCheck` (skeleton) is non-empty, spawn the Intent Assessor in the **same parallel batch** alongside the Review Aspect agents:

- **Agent file**: `agents/intent-assessor.md`
- **Input**:

  ```json
  {
    "intentBrief": "<intentBrief>",
    "intentCheck": <intentCheck skeleton as JSON>,
    "diff": "<full unified diff from Step 3>"
  }
  ```

The Intent Assessor is **not** a Review Aspect and is **not** in the spawn set returned by the changed-file analyser. Do not add it to SPAWN_SET. It runs because intent is present, not because of changed-file categories (ADR-0011).

Store the Assessor's response separately as `ASSESSOR_RESPONSE`.

### Phase 2 — Code Simplifier (conditional, sequential, after Phase 1 completes)

After all Phase 1 agents finish, evaluate the Phase 2 gate (ADR-0013). The gate is implemented by `shouldRunPhase2` in `scripts/lib/changed-file-analyser.mjs` — call it via an inline Node.js one-liner:

```sh
FILES='<JSON.stringify(changedFiles from Step 6)>' FINDINGS='<JSON.stringify(all Phase 1 findings flattened)>' node -e "
const {shouldRunPhase2}=await import('${CLAUDE_PLUGIN_ROOT}/scripts/lib/changed-file-analyser.mjs')
const files=JSON.parse(process.env.FILES)
const findings=JSON.parse(process.env.FINDINGS)
process.stdout.write(shouldRunPhase2(files,findings)?'true':'false')
"
```

- **Output `true`**: launch `agents/code-simplifier.md` sequentially (wait for it before Step 8). Provide the same diff (and `intentBrief` preamble when defined) as in the Phase 1 fan-out. Wait for it to complete and merge its `findings` and `positiveObservations` into the full set alongside the Phase 1 results.
- **Output `false`**: skip Phase 2 entirely and proceed to Step 8.

Phase 2 honours the preview / `--dry-run` principle from ADR-0003: it always computes and renders, but nothing in Phase 2 changes the write path — if `IS_POST` is false the preview is terminal-only regardless.

## Step 8 — Merge findings and render the Review Summary

Merge the responses from all agents:

- Concatenate all `findings` arrays into one flat array.
- Concatenate all `positiveObservations` arrays into one flat array; remove exact-string duplicates.

Construct the merged JSON object:

```json
{ "findings": [...all findings...], "positiveObservations": [...deduplicated observations...] }
```

### Run the overlay merger (when Assessor was spawned)

When the Intent Assessor was spawned in Step 7:

1. Extract the assessed `intentCheck` array from `ASSESSOR_RESPONSE.intentCheck`. If `ASSESSOR_RESPONSE` is missing, not an object, or `ASSESSOR_RESPONSE.intentCheck` is not an array, treat `assessed` as `null`.

2. Run the merger:

   ```sh
   SKELETON_JSON='<JSON.stringify(intentCheck skeleton)>' ASSESSED_JSON='<JSON.stringify(assessed) or "null">' node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/intent-check-merger.mjs"
   ```

   Parse stdout as `{ items, diagnostics }`. Use `items` as the merged `intentCheck` for rendering. **If the merger exits non-zero or stdout cannot be parsed as JSON**, treat `assessed` as null (all-zero diagnostics), write the stderr diagnostic `unic-pr-review: intent-check degraded — merger CLI failure`, and set `unassessedIntentCheck: true` (the full Notice path, item 3 below).

3. **Reviewer-facing Notice** — when the Assessor was spawned but `diagnostics.applied === 0` (or `assessed` was missing/non-array), set `unassessedIntentCheck: true` in the NoticesContext object. Partial degradation (some applied, some dropped) raises **no** Notice.

4. **Maintainer-facing stderr** — when `diagnostics.droppedElements + diagnostics.rejectedVerdicts + diagnostics.unmatchedItems > 0` (or `assessed` was missing/non-array), write a stderr diagnostic naming the drift class:

   - `droppedElements > 0` → `schema drift (malformed elements)`
   - `rejectedVerdicts > 0` → `vocabulary drift (invalid verdict values)`
   - `unmatchedItems > 0` → `hallucinated ids (assessed items not in skeleton)`
   - Missing/non-array response → `missing or non-array Assessor response`
     Example: `unic-pr-review: intent-check degraded — schema drift (malformed elements)`

5. Build `NOTICES_JSON` from the NoticesContext (may be empty `{}`). Include it in the render-summary call.

When the Assessor was **not** spawned (no Intent Brief, or empty skeleton), skip the merger entirely: the `intentCheck` skeleton (if any) is forwarded unchanged and no `NOTICES_JSON` for intent degradation is set.

Pass it to the `render-summary` helper via the `FINDINGS_JSON` environment variable. The helper validates each Finding, buckets by severity per ADR-0002, and writes the rendered markdown to stdout.

- **When `intentCheck` is defined** (a non-empty array — the merged `items` when the Assessor
  ran, or the skeleton otherwise), also pass it via `INTENT_CHECK_JSON` so the helper renders
  the Intent Check block above the Severity sections (PRD § Schema: Review Summary). When a
  NoticesContext applies, pass it via `NOTICES_JSON`:

  ```sh
  FINDINGS_JSON='<merged JSON>' INTENT_CHECK_JSON='<JSON.stringify(mergedIntentCheck)>' NOTICES_JSON='<JSON.stringify(noticesCtx)>' node "${CLAUDE_PLUGIN_ROOT}/scripts/render-summary.mjs"
  ```

- **When `intentCheck` is undefined or empty**, omit `INTENT_CHECK_JSON` (and `NOTICES_JSON`)
  entirely (the Intent Check block is then omitted, US 30):

  ```sh
  FINDINGS_JSON='<merged JSON>' node "${CLAUDE_PLUGIN_ROOT}/scripts/render-summary.mjs"
  ```

The helper is the single source of truth for the rendering pipeline — it
imports `parseFinding` from `scripts/lib/finding-validator.mjs` and
`renderReviewSummary` from `scripts/lib/review-summary-renderer.mjs`, so the
ADR-0006 Bot Signature invariant is preserved automatically.

**Always relay the helper's stderr to the user.** It carries two kinds of
diagnostics that the user must see, neither of which appears in stdout:

- Per-Finding `parseFinding` failures (the helper drops the malformed
  Finding and keeps going). If any are reported, the user must know which
  Findings the agent produced were excluded from the summary.
- Fatal failures: missing `FINDINGS_JSON`, invalid JSON, non-object root —
  the helper exits non-zero. **If the helper exits non-zero, print the
  full stderr verbatim to the user and stop. Do not print a partial summary.**

## Step 9 — Print the preview

Print the rendered Review Summary markdown to the terminal.

Remind the user:

- This is a terminal preview only — nothing has been written to ADO.
- To write Findings back to a PR, pass an ADO PR URL with `--post`.
