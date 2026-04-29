---
description: "Review an Azure DevOps pull request: fetch diff, run multi-agent analysis, post inline + summary comments back to the PR"
argument-hint: "<ADO-PR-URL> [aspects: code|errors|tests|comments|types|all]"
allowed-tools: ["Agent", "Bash", "Read", "Write", "Grep", "Glob"]
---

# Azure DevOps PR Review

Perform a comprehensive code review for an Azure DevOps pull request, then post findings as threaded comments directly on the PR (inline where possible) and one general summary comment.

**Arguments:** "$ARGUMENTS"

---

## Prerequisites check

Before starting, verify:

```bash
az --version 2>&1 | head -1
az extension list --output table 2>&1 | grep azure-devops
```

If `azure-devops` extension is missing: `az extension add --name azure-devops`

Also verify `pr-review-toolkit` is available by checking if the agent `pr-review-toolkit:code-reviewer` can be invoked. If that plugin is not installed and enabled, stop immediately and tell the user:

> This command requires the `pr-review-toolkit` plugin (from `anthropics/claude-plugins-official`) to be installed and enabled. Enable it via Claude Code settings → Plugins, then re-run this command.

---

## Step 1 — Parse the PR URL

Extract from `$ARGUMENTS`. Expected ADO format:

```txt
https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
```

Variables to extract:

- `ORG_URL` = `https://dev.azure.com/{org}`
- `PR_ID` = `{id}`

**GitHub URLs** (`https://github.com/...`) are not supported in v0.1.0 — tell the user and stop.

If no URL provided, run `az repos pr list --status active --output table` to help them pick one.

---

## Step 2 — Check the default `az` org

```bash
az devops configure --list
```

Note the configured `organization`. If it differs from `ORG_URL`, pass `--org {ORG_URL}` explicitly in every `az` command below.

---

## Step 3 — Fetch PR metadata

```bash
az repos pr show --id {PR_ID} --org {ORG_URL} --output json
```

Capture and remember:

- `repository.id` → `REPO_ID` (UUID, e.g. `99bf5e9b-...`)
- `sourceRefName` → source branch (e.g. `refs/heads/feature/my-branch`)
- `targetRefName` → target branch (e.g. `refs/heads/develop`)
- `title`, `description`
- `status` — note if already merged (`mergeStatus: succeeded`); continue anyway, comments are still useful as a review record
- `createdBy.displayName`

Strip `refs/heads/` prefix to get plain branch names for git commands.

---

## Step 4 — List changed files

Use the ADO REST API (note: `az repos pr` has no file-list subcommand):

```bash
az devops invoke \
  --area git \
  --resource pullRequestIterationChanges \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" "iterationId=1" \
  --org {ORG_URL} \
  --api-version "7.1" \
  --output json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for c in data.get('changeEntries', []):
    path = c.get('item', {}).get('path', '')
    ct = c.get('changeType', '')
    print(f'{ct}: {path}')
"
```

---

## Step 5 — Get the diff locally

Check if the local branch matches the PR source branch:

```bash
git branch --show-current
```

If it does not match, check out the PR branch:

```bash
az repos pr checkout --id {PR_ID} --org {ORG_URL}
# or: git fetch origin {source-branch} && git checkout {source-branch}
```

Then get the diff:

```bash
git diff origin/{target-branch}...HEAD --name-only
git diff origin/{target-branch}...HEAD
```

If the diff is very large (>500 lines), focus on the most significant changed files rather than trying to pass the entire diff to agents.

---

## Step 6 — Read key changed files

Use the `Read` tool on the most important changed files (application logic, hooks, contracts, config). Skip auto-generated files:

- `*/generate-types/output/**`
- `*.Designer.cs`, `*.g.cs`, `*.generated.*`
- `**/serialization/**/*.yml` (Sitecore serialization)
- `**/swagger.md` (generated API contract)

---

## Step 7 — Determine review aspects

Parse `$ARGUMENTS` for an aspect filter: `code`, `errors`, `tests`, `comments`, `types`, `all` (default).

Map aspects to agents:

- `code` → `pr-review-toolkit:code-reviewer` (always run)
- `errors` → `pr-review-toolkit:silent-failure-hunter` (always run)
- `tests` → `pr-review-toolkit:pr-test-analyzer` (if test files changed)
- `comments` → `pr-review-toolkit:comment-analyzer` (if docs/comments added)
- `types` → `pr-review-toolkit:type-design-analyzer` (if new types introduced)

---

## Step 8 — Launch review agents in parallel

Launch at least `code-reviewer` and `silent-failure-hunter` in a **single message** (parallel). For each agent, provide a self-contained prompt including:

1. The PR title and description
2. The full diff (or the most important sections if large)
3. The content of key changed files (from Step 6)
4. Project conventions from `CLAUDE.md` if present
5. File paths and language context

**Example agent invocations (parallel):**

```txt
Agent(
  subagent_type: "pr-review-toolkit:code-reviewer",
  prompt: "Review PR '{title}' targeting {target-branch}. [diff content] [key file contents] [CLAUDE.md conventions]"
)

Agent(
  subagent_type: "pr-review-toolkit:silent-failure-hunter",
  prompt: "Review PR '{title}' for silent failures. [diff content] [key file contents]"
)
```

---

## Step 9 — Aggregate findings

Combine results from all agents. For each finding assign:

- **Severity**: 🔴 Critical / 🟠 Important / 🟡 Minor
- **File path** — exactly as it appears in the ADO PR (leading `/`, forward slashes, e.g. `/fe/src/pages/_app.tsx`)
- **Line number(s)** — use the **right/new file** line numbers (post-diff)
- **Comment text** — clear, actionable, with a suggested fix where possible

---

## Step 10 — Post inline comments

For each finding with a known file and line, post a PR thread:

```bash
cat > /tmp/pr_thread_N.json << 'ENDJSON'
{
  "comments": [
    {
      "commentType": 1,
      "content": "{COMMENT_TEXT}\n\n---\n🤖 *Reviewed by Claude Code*"
    }
  ],
  "status": 1,
  "threadContext": {
    "filePath": "/{path/to/file}",
    "rightFileEnd": { "line": END_LINE, "offset": 1 },
    "rightFileStart": { "line": START_LINE, "offset": 1 }
  }
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" \
  --org {ORG_URL} \
  --http-method POST \
  --in-file /tmp/pr_thread_N.json \
  --api-version "7.1" \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Thread', d.get('id'), d.get('status'))"
```

**Rules:**

- File paths: leading `/`, forward slashes, must match ADO exactly (as listed in Step 4)
- Line numbers: new/right file (post-diff), not original file
- `offset` can always be `1`
- Multi-line findings: set `rightFileStart.line` to first line, `rightFileEnd.line` to last
- If exact line is unknown, omit `threadContext` entirely (becomes a general comment)
- Use a unique temp file name per comment (e.g. `/tmp/pr_thread_1.json`, `/tmp/pr_thread_2.json`)

---

## Step 11 — Post summary comment

After all inline comments, post one general thread **without** `threadContext`:

```bash
cat > /tmp/pr_summary.json << 'ENDJSON'
{
  "comments": [
    {
      "commentType": 1,
      "content": "## PR Review Summary — {PR_TITLE}\n\n{SUMMARY_CONTENT}\n\n---\n🤖 *Reviewed by Claude Code*"
    }
  ],
  "status": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" \
  --org {ORG_URL} \
  --http-method POST \
  --in-file /tmp/pr_summary.json \
  --api-version "7.1" \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Summary thread', d.get('id'), d.get('status'))"
```

**Summary structure:**

```markdown
## PR Review Summary — {title}

### 🔴 Critical (X found)

- **[file:line]** Issue description

### 🟠 Important (X found)

- **[file:line]** Issue description

### 🟡 Minor / Suggestions

- Suggestion

### ✅ What's good

- Positive observation

---

🤖 _Reviewed by Claude Code_

### 🟡 Minor / Suggestions

- Suggestion

### ✅ What's good

- Positive observation

---

🤖 _Reviewed by Claude Code_
```

---

## Step 12 — Clean up

```bash
rm -f /tmp/pr_thread_*.json /tmp/pr_summary.json
```

---

## Comment signature

Every comment — inline or summary — **must** end with this trailer on its own line:

```txt
---
🤖 *Reviewed by Claude Code*
```

Never vary this signature.

---

## Notes

- The PR may already be merged — post comments anyway as a review record.
- Use `az repos pr checkout --id {PR_ID} --org {ORG_URL}` if the local branch doesn't match the source branch.
- For multi-iteration PRs, always use `iterationId=1` unless you have a specific reason to review a later iteration.
- If `az devops invoke` returns an error on `threadContext` (e.g. file not found in the diff), retry without `threadContext` to post as a general comment.
