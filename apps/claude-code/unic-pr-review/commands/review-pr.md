---
allowed-tools: Agent, Bash(node *), Bash(git *)
argument-hint: [<PR URL>]
description: Review a pull request or your local branch. Pass an Azure DevOps PR URL to review an open PR (first-review preview, read-only); omit the URL to review your local branch against its upstream base (Pre-PR mode).
---

# unic-pr-review:review-pr

Runs an AI-powered code review. Without a URL the Plugin operates in **Pre-PR mode** — it computes the diff of your local branch against the resolved upstream base branch, determines which Review Aspect agents to spawn based on the changed files (ADR-0008), fans out to those agents in parallel, and prints the merged Review Summary in the terminal. Nothing is written to ADO.

## Step 1 — Detect mode and route

Inspect the first argument passed to the command.

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

#### Step 1.3 — Invoke the ADO Fetcher agent

Use the Agent tool to launch the agent identified by `FETCHER_AGENT` (e.g. `unic-pr-review:ado-fetcher`). Provide:

```json
{ "orgUrl": "<PR_REF.orgUrl>", "project": "<PR_REF.project>", "repo": "<PR_REF.repo>", "prId": <PR_REF.prId> }
```

Wait for the agent to complete. It returns a JSON object:

```json
{
  "identity": { "id": "...", "displayName": "..." },
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
  - `"identity-cache-failed"` → print `"ADO identity caching failed. Run /unic-pr-review:doctor to diagnose."` and stop.
  - `"fetch-failed"` → print `"ADO data fetch failed at step <step> (<resource>): <message>"` and stop.
  - Any other error key → print the error message verbatim and stop.
- Store `FETCHER_OUTPUT`.

#### Step 1.4 — Detect mode (first-review vs re-review)

Scan `FETCHER_OUTPUT.threads` for a prior Bot Signature authored by `FETCHER_OUTPUT.identity.id` (ADR-0006). For **this release (first-review preview only)**:

- **Prior signature found** → print `"Re-review mode is not yet supported in this release. Proceeding as first-review."` and continue.
- **No prior signature** → continue (first-review mode).

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

Process the response identically to the Pre-PR path (Step 5):

- Hard-stop on `{ "hardStop": true }` → print verbatim error and stop.
- Success → store `intentBrief` and `intentCheck`.
- Empty brief + empty intentCheck → treat as absent (no intent gathering).

#### Step 1.7 — Resolve spawn set

Use `FETCHER_OUTPUT.changedFiles` instead of `git diff --name-only`. Pipe the newline-joined paths into the analyser:

```sh
printf '%s\n' "<each entry of FETCHER_OUTPUT.changedFiles>" | node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/changed-file-analyser.mjs"
```

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

#### Step 1.9 — Merge findings and render (ADO mode)

Same as Step 8 (Pre-PR): merge all agents' findings and positive observations, run the overlay merger when the Assessor was spawned, and pass `FINDINGS_JSON`, `INTENT_CHECK_JSON` (if applicable), and `NOTICES_JSON` (if applicable) to `render-summary.mjs`. Always relay the helper's stderr; stop on a non-zero exit.

When `FETCHER_OUTPUT.diffUnavailable` is `true`, always include `NOTICES_JSON` in the render-summary call (even if no Assessor Notice applies), so the renderer structurally guarantees the "diff unavailable" notice is surfaced to the reviewer.

#### Step 1.10 — Print preview (ADO mode)

Print the rendered Review Summary markdown.

Remind the user:

- This is a terminal preview only — nothing has been written to ADO.
- `--post` mode (interactive Approval Loop) is coming in a later release.

**After Step 1.10, stop. Do not continue to Step 2.**

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

Run the changed-file-analyser to determine which Review Aspect agents apply to this diff:

```sh
git diff "origin/${BASE_BRANCH}...HEAD" --name-only | node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/changed-file-analyser.mjs"
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
- `--post` mode (interactive Approval Loop) is coming in a later release.
