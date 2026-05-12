---
allowed-tools: ['Agent', 'Bash', 'Read', 'Write', 'Grep', 'Glob']
argument-hint: '<ADO-PR-URL> [aspects: code|errors|tests|comments|types|all]'
description: 'Review an Azure DevOps pull request: fetch diff, run multi-agent analysis, post inline + summary comments back to the PR'
---

# Azure DevOps PR Review

**Arguments:** "$ARGUMENTS"

---

## Step 1 — Prerequisites (always)

Verify `pr-review-toolkit` is available (`pr-review-toolkit:code-reviewer` agent). If missing, stop and tell the user to install and enable it via Claude Code settings → Plugins.

Verify `git` is available: `git --version`

---

## Step 2 — Parse arguments and detect mode

Extract a PR URL from `$ARGUMENTS`. Expected format:
`https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}`

**GitHub URLs** are not supported — tell the user and stop.

If **no URL** provided → `MODE=pre-pr` → jump to [Pre-PR mode](#pre-pr-mode).

Extract: `ORG_URL=https://dev.azure.com/{org}`, `PROJECT={project}`, `PR_ID={id}`

---

## Step 3 — Azure CLI check (PR modes only)

Run `az --version` and check `az extension list` for `azure-devops`. If missing: `az extension add --name azure-devops`

---

## Step 4 — Mode detection

Fetch the full thread list **once** — captured here and passed forward; never re-fetched downstream.

```bash
RAW_THREADS_JSON=$(az repos pr thread list \
  --id "$PR_ID" --org "$ORG_URL" --output json 2>/dev/null) || RAW_THREADS_JSON="[]"
```

Check for a prior Bot Signature:

```bash
SIGNATURE_PREFIX="🤖 *Reviewed by Claude Code*"

DETECT_JSON=$(
  RAW_T="$RAW_THREADS_JSON" SIG_P="$SIGNATURE_PREFIX" PLUGIN_R="${CLAUDE_PLUGIN_ROOT}" \
  node --input-type=module << 'EOJS'
import { detectPriorReview } from 'file://' + process.env.PLUGIN_R + '/scripts/re-review/detect-prior-review.mjs'
const r = detectPriorReview({ threads: JSON.parse(process.env.RAW_T || '[]'), signaturePrefix: process.env.SIG_P })
process.stdout.write(JSON.stringify({
  isRereview: r.isRereview,
  priorIterationId: r.priorIterationId != null ? String(r.priorIterationId) : '',
  summaryThreadId: r.summaryThread != null ? String(r.summaryThread.threadId) : '',
}))
EOJS
)

IS_REREVIEW=$(printf '%s' "$DETECT_JSON" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).isRereview))")
PRIOR_ITERATION_ID=$(printf '%s' "$DETECT_JSON" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).priorIterationId)")
SUMMARY_THREAD_ID=$(printf '%s' "$DETECT_JSON" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).summaryThreadId)")

[ "$IS_REREVIEW" = "true" ] && MODE="re-review" || MODE="first-review"
echo "Mode detected: $MODE"
```

---

## Step 5 — ADO Fetcher

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

Store full output as `ADO_FETCHER_RESULT`. Parse `LATEST_ITERATION_ID`, `REPO_ID`, `CHANGED_FILES`, `RAW_DIFF`, `WORK_ITEM_IDS` from the `ADO_FETCHER_RESULT_START/END` block.

---

## Step 6 — Doc Context Orchestrator + review agents (parallel)

Launch all of the following in a **single message**:

**Doc Context Orchestrator:**

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

Store output as `DOC_CONTEXT`.

**Review aspect agents** — parse `$ARGUMENTS` for aspect filter (`code`/`errors`/`tests`/`comments`/`types`/`all`); default `all`. Always run `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:silent-failure-hunter`. Also run `pr-review-toolkit:pr-test-analyzer` if test files changed, `pr-review-toolkit:comment-analyzer` if docs/comments added, `pr-review-toolkit:type-design-analyzer` if new types introduced.

For each agent provide: PR title + description, full diff, changed file contents. Prepend `DOC_CONTEXT` as preamble if non-empty.

Collect findings. For each assign: severity (`critical`/`important`/`minor`), `filePath` (leading `/`, forward slashes matching ADO), `startLine`, `endLine`, `title`, `body`. Assemble `FINDINGS` as `{ severity, filePath, startLine, endLine, title, body }[]`.

---

## Step 7 — Write-back (branch on mode)

### First-review

```txt
Agent(
  subagent_type: "pr-review:ado-writer",
  prompt: "Post all ADO comments for this first-review.
  ORG_URL: {ORG_URL}
  PROJECT: {PROJECT}
  REPO_ID: {REPO_ID}
  PR_ID: {PR_ID}
  LATEST_ITERATION_ID: {LATEST_ITERATION_ID}
  SUMMARY_THREAD_ID:
  MODE: first-review
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
  FINDINGS: {FINDINGS_JSON}"
)
```

### Re-review

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

Parse `RE_REVIEW_COORDINATOR_RESULT_START/END`. Extract `earlyExit` and `freshFindings`.

If `earlyExit: true` — stop here; do **not** invoke ADO Writer.

Otherwise:

```txt
Agent(
  subagent_type: "pr-review:ado-writer",
  prompt: "Post all ADO comments for this re-review.
  ORG_URL: {ORG_URL}
  PROJECT: {PROJECT}
  REPO_ID: {REPO_ID}
  PR_ID: {PR_ID}
  LATEST_ITERATION_ID: {LATEST_ITERATION_ID}
  SUMMARY_THREAD_ID: {SUMMARY_THREAD_ID}
  MODE: re-review
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
  FINDINGS: {FRESH_FINDINGS_JSON}"
)
```

---

## Pre-PR mode

**Pre-PR mode active** — no PR URL provided. Reviewing local branch diff; no ADO calls will be made.

### Step A — Detect default branch and compute diff

```bash
# Detect the default remote branch (main or develop)
DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}' || echo "main")

RAW_DIFF=$(git diff "origin/${DEFAULT_BRANCH}...HEAD")
```

If `git diff` fails (e.g. no upstream remote), inform the user and stop.

### Step B — Parse changed files

```bash
PRE_PR_CONTEXT=$(
  RAW_DIFF_STR="$RAW_DIFF" \
  PLUGIN_R="${CLAUDE_PLUGIN_ROOT}" \
  node --input-type=module << 'EOJS'
import { buildPrePrContext } from 'file://' + process.env.PLUGIN_R + '/scripts/pre-pr.mjs'
const ctx = buildPrePrContext(process.env.RAW_DIFF_STR)
process.stdout.write(JSON.stringify(ctx))
EOJS
)

FILTERED_FILES=$(printf '%s' "$PRE_PR_CONTEXT" | node -e "
const chunks = []
process.stdin.on('data', c => chunks.push(c))
process.stdin.on('end', () => {
  const ctx = JSON.parse(Buffer.concat(chunks).toString())
  process.stdout.write(ctx.filteredFiles.join('\n'))
})")
```

Read the contents of each file in `FILTERED_FILES` (skip any that are deleted or unavailable).

### Step C — Resolve aspect filter

Parse `$ARGUMENTS` for aspect filter (`code`/`errors`/`tests`/`comments`/`types`/`all`); default `all`.
Use the same selection logic as ADO modes: always run `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:silent-failure-hunter`. Also run `pr-review-toolkit:pr-test-analyzer` if test files changed, `pr-review-toolkit:comment-analyzer` if docs/comments added, `pr-review-toolkit:type-design-analyzer` if new types introduced.

### Step D — Run review aspect agents

Doc Context is skipped (no PR URL means no work items to fetch).

Launch all applicable review aspect agents in a single message, passing:

- The raw diff (`RAW_DIFF`)
- Changed file contents
- No preamble (Doc Context is empty in pre-PR mode)

For each agent provide: full diff, filtered changed file contents. Collect findings and assign for each: `severity` (`critical`/`important`/`minor`), `filePath` (leading `/`, forward slashes), `startLine`, `endLine`, `title`, `body`. Assemble `FINDINGS` as `{ severity, filePath, startLine, endLine, title, body }[]`.

### Step E — Present findings

Present all findings directly in the Claude interface as a structured list — no ADO write-back occurs in pre-PR mode.

For each finding print:

```
[{severity}] {filePath} L{startLine}–{endLine}
{title}
{body}
```

Group by severity: `critical` first, then `important`, then `minor`. Print a summary count at the end.

If no findings, print: `✅ Pre-PR review complete — no issues found.`

Otherwise, print: `✅ Pre-PR review complete — {N} finding(s). Open a PR to post these as inline ADO comments.`

---

## Comment signature

Every comment must end with `---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}`.

`SIGNATURE_PREFIX` = `🤖 *Reviewed by Claude Code*` — never alter; re-review detection depends on it.
