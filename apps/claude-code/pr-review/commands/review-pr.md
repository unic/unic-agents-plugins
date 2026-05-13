---
allowed-tools: ['Agent', 'Bash', 'Read', 'Write', 'Grep', 'Glob']
argument-hint: '<ADO-PR-URL> [aspects: code|errors|tests|comments|types|all]'
description: 'Review an Azure DevOps pull request: fetch diff, run multi-agent analysis, post inline + summary comments back to the PR'
---

# Azure DevOps PR Review

**Arguments:** "$ARGUMENTS"

Thin orchestrator that detects one of three modes — Pre-PR, First-review, Re-review — and delegates to focused agents. The `SIGNATURE_PREFIX` `🤖 *Reviewed by Claude Code*` is sacred (re-review detection depends on it) and appears inline at every call site that needs it.

### Compact finding schema

Every review aspect agent prompt (Step 6, Step D) ends with this exact contract:

```
Return your findings as a JSON array. Each element must have exactly these six fields:
- severity: "critical" | "important" | "minor"
- filePath: string — leading /, forward slashes, matching ADO format (e.g. /src/foo.ts)
- startLine: integer — first line of the relevant range
- endLine: integer — last line of the relevant range (same as startLine for single-line findings)
- title: string — one line, ≤ 80 chars
- body: string — one paragraph; the exact text to post as the ADO comment or local-interface comment

Keep reasoning and supporting evidence inside your own context. Do not include code quotes, prose reasoning, or any text outside the JSON array in your return value.
```

### Aspect-filter selection (used in Step 6 and Pre-PR Step D)

Parse `$ARGUMENTS` for an aspect filter (`code` | `errors` | `tests` | `comments` | `types` | `all`); default `all`. Always run `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:silent-failure-hunter`. Also run `pr-review-toolkit:pr-test-analyzer` if test files changed, `pr-review-toolkit:comment-analyzer` if docs/comments were added, and `pr-review-toolkit:type-design-analyzer` if new types were introduced.

## Step 1 — Prerequisites

Verify `pr-review-toolkit` is enabled (e.g. the `pr-review-toolkit:code-reviewer` agent exists). If missing, stop with installation instructions. Verify `git --version` succeeds.

## Step 2 — Parse arguments and detect mode

Extract a PR URL from `$ARGUMENTS`. Expected format: `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}`. GitHub URLs are not supported.

- **No URL** → `MODE=pre-pr` → jump to [Pre-PR mode](#pre-pr-mode).
- **URL present** → extract `ORG_URL`, `PROJECT`, `PR_ID` and continue.

## Step 3 — Azure CLI check (PR modes only)

Run `az --version` and `az extension list | grep azure-devops`. If missing: `az extension add --name azure-devops`.

## Step 4 — Re-review detection

Fetch the thread list **once**; never re-fetch downstream.

```bash
PR_THREADS_ERR="${TMPDIR:-/tmp}/pr_threads.err"
RAW_THREADS_JSON=$(az repos pr thread list --id "$PR_ID" --org "$ORG_URL" --output json 2>"$PR_THREADS_ERR") || {
  echo "ERROR: failed to fetch PR threads via Azure CLI. Try \`az devops login\` to re-authenticate." >&2
  cat "$PR_THREADS_ERR" >&2; exit 1; }

eval "$(
  RAW_T="$RAW_THREADS_JSON" SIG_P="🤖 *Reviewed by Claude Code*" PLUGIN_R="${CLAUDE_PLUGIN_ROOT}" \
  node --input-type=module << 'EOJS'
const { detectMode, formatModeEnv } = await import(`file://${process.env.PLUGIN_R}/scripts/mode-detection.mjs`)
const threads = JSON.parse(process.env.RAW_T || '[]')
process.stdout.write(formatModeEnv(detectMode({ threads, signaturePrefix: process.env.SIG_P })))
EOJS
)"

echo "Mode detected: $MODE"
```

Sets `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`.

## Step 5 — ADO Fetcher

Launch the ADO Fetcher agent and **wait for its result** before anything else (the PRD requires the Fetcher to complete before downstream agents run).

```txt
Agent(
  subagent_type: "pr-review:ado-fetcher",
  prompt: "Fetch all ADO data for this PR review.
  ORG_URL: {ORG_URL}
  PROJECT: {PROJECT}
  PR_ID: {PR_ID}
  PRIOR_ITERATION_ID: {PRIOR_ITERATION_ID}
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}"
)
```

Store the full output as `ADO_FETCHER_RESULT`. Parse `LATEST_ITERATION_ID`, `REPO_ID`, `CHANGED_FILES`, `RAW_DIFF`, `WORK_ITEM_IDS`, and `NOTICES` from the `ADO_FETCHER_RESULT_START`/`ADO_FETCHER_RESULT_END` block. Set `NOTICES_JSON` to `mergeNotices(NOTICES)` via `scripts/ado/notices.mjs` (in this slice the only source is the Fetcher; subsequent slices add Coordinator/Writer sources).

## Step 6 — Doc Context Orchestrator + review aspect agents (parallel)

Launch both groups concurrently in a **single message**.

**Doc Context Orchestrator** — gathers business context. The returned text is stored as `DOC_CONTEXT` and surfaced in the final user-facing summary; it is **not** prepended to review aspect agent prompts (those run in parallel with the orchestrator and cannot block on its output).

```txt
Agent(
  subagent_type: "pr-review:doc-context-orchestrator",
  prompt: "Orchestrate Doc Context gathering.
  ORG_URL: {ORG_URL}
  PR_ID: {PR_ID}
  Work item IDs: {WORK_ITEM_IDS}
  Confluence client path: {CLAUDE_PLUGIN_ROOT}/scripts/confluence-client.mjs
  Changed files:
  {CHANGED_FILES}
  Diff:
  {RAW_DIFF}
  Return the complete Doc Context markdown block, or an empty string."
)
```

**Review aspect agents** — apply the [aspect-filter selection](#aspect-filter-selection-used-in-step-6-and-pre-pr-step-d) above. For each selected agent, pass the full diff and changed file contents (the Fetcher captures PR title and description for downstream use only; they are not parsed by the orchestrator). Every prompt **must** end with the [compact finding schema](#compact-finding-schema) block verbatim. Collect returned JSON arrays, deduplicate, sort by severity (`critical` first); assemble `FINDINGS` as `{ severity, filePath, startLine, endLine, title, body }[]`.

## Step 7 — Write-back (branch on mode)

**Re-review only** — first run the coordinator, parse `RE_REVIEW_COORDINATOR_RESULT_START`/`_END`, extract `earlyExit` and `freshFindings`. If `earlyExit: true`, stop; otherwise reassign `FINDINGS_JSON` to `freshFindings`.

```txt
Agent(
  subagent_type: "pr-review:re-review-coordinator",
  prompt: "Run the re-review state machine.
  ADO_FETCHER_RESULT:
  {ADO_FETCHER_RESULT}
  RAW_THREADS_JSON:
  {RAW_THREADS_JSON}
  FINDINGS: {FINDINGS_JSON}
  SIGNATURE_PREFIX: 🤖 *Reviewed by Claude Code*
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}"
)
```

**Both modes** — invoke ADO Writer. For first-review, `MODE=first-review` and `SUMMARY_THREAD_ID=""`. For re-review, both come from Step 4.

```txt
Agent(
  subagent_type: "pr-review:ado-writer",
  prompt: "Post all ADO comments for this {MODE} run.
  ORG_URL: {ORG_URL}
  PROJECT: {PROJECT}
  REPO_ID: {REPO_ID}
  PR_ID: {PR_ID}
  LATEST_ITERATION_ID: {LATEST_ITERATION_ID}
  SUMMARY_THREAD_ID: {SUMMARY_THREAD_ID}
  MODE: {MODE}
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
  FINDINGS: {FINDINGS_JSON}
  NOTICES_JSON: {NOTICES_JSON}"
)
```

## Step 8 — End-of-run Trailer

Print one Trailer line via `formatTrailer({ mode, findings, notices, prUrl })` from `scripts/ado/notices.mjs`: reduce `FINDINGS_JSON` to `{ critical, important, minor }` counts for `findings`; pass `NOTICES_JSON` as `notices`; build `prUrl` from `ORG_URL`/`PROJECT`/`PR_ID`. On an aborted run, pass `{ mode: 'aborted', abortKind, abortReason }` instead. Pre-PR mode emits its Trailer in Step E with `mode: 'pre-pr'`.

## Pre-PR mode

No PR URL provided — reviewing the local branch diff; no ADO calls are made.

### Step A — Compute diff

```bash
DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | awk '/HEAD branch/{print $NF}' | grep . || echo "main")
RAW_DIFF=$(git diff "origin/${DEFAULT_BRANCH}...HEAD") || { echo "git diff failed"; exit 1; }
```

### Step B — Parse changed files

```bash
FILTERED_FILES=$(
  RAW_DIFF_STR="$RAW_DIFF" PLUGIN_R="${CLAUDE_PLUGIN_ROOT}" \
  node --input-type=module << 'EOJS'
const { buildPrePrContext } = await import(`file://${process.env.PLUGIN_R}/scripts/pre-pr.mjs`)
process.stdout.write(buildPrePrContext(process.env.RAW_DIFF_STR).filteredFiles.join('\n'))
EOJS
)
```

Read the contents of each file in `FILTERED_FILES`, skipping deleted ones.

### Step C — Resolve aspect filter

Apply the [aspect-filter selection](#aspect-filter-selection-used-in-step-6-and-pre-pr-step-d) defined above.

### Step D — Run review aspect agents

Doc Context is skipped (no work items without a PR). Launch all selected review aspect agents in a **single message**, passing `RAW_DIFF` and changed file contents. Every prompt **must** end with the [compact finding schema](#compact-finding-schema) verbatim; in Pre-PR mode the `body` field reads "exact text to post as the comment" (rendered in the Claude interface, not written back to ADO).

Collect, dedupe, and sort returned JSON arrays into `FINDINGS` (`critical` first).

### Step E — Present findings

Print each finding in the Claude interface, grouped by severity (`critical`, `important`, `minor`):

```
[{severity}] {filePath} L{startLine}–{endLine}
{title}
{body}
```

End with one Trailer line via `formatTrailer({ mode: 'pre-pr', findings, notices: [] })` from `scripts/ado/notices.mjs` (reduce `FINDINGS` to `{ critical, important, minor }` counts). The line reads `✅ Pre-PR review complete: <N> findings (...) · 0 warning notices`.
