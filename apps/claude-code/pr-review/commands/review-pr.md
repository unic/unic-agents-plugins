---
allowed-tools: ['Agent', 'Bash', 'Read', 'Write', 'Grep', 'Glob']
argument-hint: '<ADO-PR-URL> [aspects: code|errors|tests|comments|types|all] [--dry-run]'
description: 'Review an Azure DevOps pull request: fetch diff, run multi-agent analysis, post inline + summary comments back to the PR. Pass --dry-run to preview without writing to ADO.'
---

# Azure DevOps PR Review

**Arguments:** "$ARGUMENTS"

Thin orchestrator that detects one of four peer modes — Pre-PR, First-review, Re-review, Dry-run — and delegates to focused agents. Dry-run resolves internally to `dry-run-first` (fresh PR) or `dry-run-rereview` (re-review-eligible). The `SIGNATURE_PREFIX` `🤖 *Reviewed by Claude Code*` is sacred (re-review detection depends on it) and appears inline at every call site that needs it.

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

Extract a PR URL from `$ARGUMENTS`. Expected format: `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}`. GitHub URLs are not supported. Also set `IS_DRY_RUN=true|false` deterministically from the optional `--dry-run` token: `case " $ARGUMENTS " in *" --dry-run "*) IS_DRY_RUN=true ;; *) IS_DRY_RUN=false ;; esac`.

- **No URL** → `MODE=pre-pr` → jump to [Pre-PR mode](#pre-pr-mode) (`--dry-run` is a silent no-op in this combination).
- **URL present** → extract `ORG_URL`, `PROJECT`, `PR_ID` and continue.

## Step 3 — Azure CLI check (PR modes only)

Run `az --version` and `az extension list | grep azure-devops`. If missing: `az extension add --name azure-devops`. Then verify `az devops invoke` itself is callable — the extension is sometimes installed but broken after partial upgrades (this is the failure class the smoke test in `tests/ado-cli-smoke.test.mjs` guards offline):

```bash
if ! az devops invoke --help >/dev/null 2>&1; then
  echo "ERROR: az devops invoke unavailable. Re-install: az extension remove --name azure-devops && az extension add --name azure-devops" >&2
  exit 1
fi
```

## Step 4 — Fetch PR metadata

Gather the PR's repository, branches, title, and description from the Azure CLI so the Fetcher can be launched with full context. This is the only Azure CLI call the orchestrator makes — thread fetching and mode detection live inside the Fetcher (see ADR 0016). Branch refs are stripped of the `refs/heads/` prefix.

```bash
PR_META_JSON=$(az repos pr show --id "$PR_ID" --org "$ORG_URL" --output json) || {
  echo "ERROR: failed to fetch PR metadata. Try \`az devops login\` to re-authenticate." >&2; exit 1; }

eval "$(printf '%s' "$PR_META_JSON" | node -e "
const m=JSON.parse(require('fs').readFileSync(0,'utf8'))
const q=s=>String(s||'').replace(/'/g,\"'\\\\''\")
const strip=r=>String(r||'').replace(/^refs\/heads\//,'')
for(const[k,v]of[['REPO_ID',m.repository?.id],['PROJECT',m.repository?.project?.name],['SOURCE_BRANCH',strip(m.sourceRefName)],['TARGET_BRANCH',strip(m.targetRefName)],['PR_TITLE',m.title],['PR_DESCRIPTION',m.description]])process.stdout.write(\`\${k}='\${q(v)}'\\n\`)
")"
```

Sets `REPO_ID`, `PROJECT`, `SOURCE_BRANCH`, `TARGET_BRANCH`, `PR_TITLE`, `PR_DESCRIPTION`. The Fetcher (Step 5) detects mode and emits `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID` in its result block.

## Step 5 — ADO Fetcher

Launch the ADO Fetcher agent and **wait for its result** before anything else (the PRD requires the Fetcher to complete before downstream agents run). The Fetcher fetches threads and runs mode detection internally.

```txt
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
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}"
)
```

Store the full output as `ADO_FETCHER_RESULT`. If the `ADO_FETCHER_RESULT_START`/`_END` block is absent (Fetcher exited non-zero), determine the abort kind from the output (output contains `az devops login` → `abortKind: 'auth'`; otherwise `abortKind: 'fetcher'`), call `formatTrailer({ mode: 'aborted', abortKind, abortReason: <first ERROR: line from output> })` from `scripts/ado/notices.mjs`, and stop. Otherwise parse `LATEST_ITERATION_ID`, `CHANGED_FILES`, `RAW_DIFF`, `DIFF_RANGE`, `MODE`, `IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID`, `RAW_THREADS_JSON`, `WORK_ITEM_IDS`, and `NOTICES` from the block. Store `DIFF_RANGE`; the Re-review Coordinator (Step 7) parses it from `ADO_FETCHER_RESULT` to apply the γ-downgrade when `DIFF_RANGE=full`. Set `NOTICES_JSON` to `mergeNotices(NOTICES)` via `scripts/ado/notices.mjs`.

Resolve final `MODE` from `IS_DRY_RUN × IS_REREVIEW`: `false × false → first-review` (keep Fetcher value), `false × true → re-review` (keep Fetcher value), `true × false → dry-run-first` (override), `true × true → dry-run-rereview` (override). Echo `Mode detected: $MODE`.

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

**Dry-run-first** — skip the Coordinator and the Writer entirely; jump to Step 8 dry-run rendering.

**Re-review and dry-run-rereview** — run the Coordinator (passing `MODE` verbatim), parse `RE_REVIEW_COORDINATOR_RESULT_START`/`_END`, extract `earlyExit`, `freshFindings`, `plannedActions`, and `NOTICES` (store as `coordinatorNotices`; default `[]`). For `plannedActions`: if the `plannedActions:` line is **present** in the block, parse its value (which may be `[]`); if **absent**, treat as a contract violation — push a warning Notice with kind `coordinator-contract` describing the missing field into `coordinatorNotices` and continue with `plannedActions = []` so the run completes and the bug surfaces via the Notices preamble. If the result block is absent (coordinator exited non-zero), infer `abortKind` from output (contains `az devops login` → `'auth'`; else `'coordinator'`), call `formatTrailer({ mode: 'aborted', abortKind, abortReason: <first ERROR: line from output> })`, and stop. On `earlyExit: true`: in `re-review` stop silently (pre-existing UX gap); in `dry-run-rereview` jump to Step 8 (Trailer prints with all-zero counts and PR URL). Otherwise reassign `FINDINGS_JSON` to `freshFindings`.

```txt
Agent(
  subagent_type: "pr-review:re-review-coordinator",
  prompt: "Run the re-review state machine.
  MODE: {MODE}
  ADO_FETCHER_RESULT:
  {ADO_FETCHER_RESULT}
  RAW_THREADS_JSON:
  {RAW_THREADS_JSON}
  FINDINGS: {FINDINGS_JSON}
  SIGNATURE_PREFIX: 🤖 *Reviewed by Claude Code*
  PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}"
)
```

**First-review and re-review only** — invoke ADO Writer (skipped in `dry-run-rereview`). For first-review, `MODE=first-review` and `SUMMARY_THREAD_ID=""`. For re-review, both come from Step 4.

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

## Step 8 — Parse Writer result + Trailer

**Dry-run modes** — no Writer ran; `prUrl` is built from `ORG_URL`/`PROJECT`/`PR_ID` identically to the ADO trailer. For **dry-run-first** (no Coordinator ran; `coordinatorNotices`/`freshFindings`/`plannedActions` do not exist): render `formatNoticesAsPrePrPreamble(NOTICES_JSON)` (fetcher notices only); no Planned thread actions block; severity-grouped findings (Pre-PR Step E format) from `FINDINGS_JSON`; Trailer via `formatTrailer({ mode, findings, notices: NOTICES_JSON, prUrl, plannedActionsCount: 0 })`. For **dry-run-rereview** (Coordinator ran in Step 7): render `formatNoticesAsPrePrPreamble(mergeNotices([...NOTICES_JSON, ...coordinatorNotices]))`; when `plannedActions` is non-empty, inline-render `Planned thread actions (would not execute in dry-run):` followed by one `  #<threadId>  <classification> → <action label>` per entry — `<classification>` inferred from `action` (`patch-to-fixed`→`addressed`, `reply-new-evidence`→`pending`, `reply-dispute-ack`→`disputed`, `skip`→`pending`); `<action label>` is `PATCH to fixed`, `new-evidence reply`, `acknowledgement reply`, or `skip (<reason>)` where `<reason>` is read dynamically from each plannedAction entry's `reason` field (e.g. `no new evidence`, `general pending thread`, `match crashed`); elide when empty. Severity-grouped findings from `freshFindings`. Trailer via `formatTrailer({ mode, findings, notices: mergedNotices, prUrl, plannedActionsCount: plannedActions.length })`.

**First-review / Re-review** — parse the Writer output via `parseAdoWriterResult` from `scripts/ado-writer.mjs`. On `{ ok: false }`, emit `ERROR: Writer did not return a valid result block (<reason>). The Summary may or may not have been posted; verify on ADO.` to stderr and print the Trailer aborted line, then stop. Otherwise extract `result.notices` and merge with fetcher and coordinator notices into `NOTICES_JSON` via `mergeNotices([...fetcherNotices, ...(coordinatorNotices ?? []), ...result.notices])` from `scripts/ado/notices.mjs` (for `first-review` the Coordinator never runs, so `coordinatorNotices` is implicitly `[]`); print Trailer via `formatTrailer({ mode, findings, notices: NOTICES_JSON, prUrl })`: reduce `FINDINGS_JSON` to `{ critical, important, minor }` counts; build `prUrl` from `ORG_URL`/`PROJECT`/`PR_ID`. Pre-PR: Step E.

## Pre-PR mode

No PR URL provided — reviewing the local branch diff; no ADO calls are made. Initialize `PRE_PR_NOTICES=[]`.

### Step A — Detect default branch + compute diff

Run `git remote show origin 2>/dev/null` and parse the `HEAD branch:` line as `REMOTE_HEAD` (empty string if absent); define `branchExists(name)` as exits 0 when `git rev-parse --verify --quiet refs/remotes/origin/$name` succeeds. Via `await import`, call `detectDefaultBranch({ remoteHeadBranch: REMOTE_HEAD, branchExists })` from `scripts/pre-pr/detect-default-branch.mjs`. On `{ branch: null }`: emit a clear stderr message, call `formatTrailer({ mode: 'pre-pr', findings: {}, notices: [] })` from `scripts/ado/notices.mjs`, and stop. If `result.notice` exists, push it to `PRE_PR_NOTICES`. Compute `RAW_DIFF=$(git diff "origin/${result.branch}...HEAD") || { echo "git diff failed"; exit 1; }`.

### Step B — Parse changed files

Via `await import`, call `buildPrePrContext(RAW_DIFF)` from `scripts/pre-pr.mjs`; merge `context.notices` into `PRE_PR_NOTICES` via `mergeNotices` from `scripts/ado/notices.mjs`; set `FILTERED_FILES` from `context.filteredFiles`. Read the contents of each file in `FILTERED_FILES`, skipping deleted ones.

### Step C — Resolve aspect filter

Apply the [aspect-filter selection](#aspect-filter-selection-used-in-step-6-and-pre-pr-step-d) defined above.

### Step D — Run review aspect agents

Doc Context is skipped (no work items without a PR). Launch all selected review aspect agents in a **single message**, passing `RAW_DIFF` and changed file contents. Every prompt **must** end with the [compact finding schema](#compact-finding-schema) verbatim; in Pre-PR mode the `body` field reads "exact text to post as the comment" (rendered in the Claude interface, not written back to ADO).

Collect, dedupe, and sort returned JSON arrays into `FINDINGS` (`critical` first).

### Step E — Present findings

Print Notices from `PRE_PR_NOTICES` via `formatNoticesAsPrePrPreamble(PRE_PR_NOTICES)` from `scripts/ado/notices.mjs`, then print each finding grouped by severity (`critical`, `important`, `minor`):

```
[{severity}] {filePath} L{startLine}–{endLine}
{title}
{body}
```

End with one Trailer line via `formatTrailer({ mode: 'pre-pr', findings, notices: PRE_PR_NOTICES })` from `scripts/ado/notices.mjs` (reduce `FINDINGS` to `{ critical, important, minor }` counts). The line reads `✅ Pre-PR review complete: <N> findings (...)  · <M> warning notices`.
