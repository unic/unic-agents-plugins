---
allowed-tools: ['Agent', 'Bash', 'Read', 'Write', 'Grep', 'Glob']
argument-hint: '<ADO-PR-URL> [aspects: code|errors|tests|comments|types|all]'
description: 'Review an Azure DevOps pull request: fetch diff, run multi-agent analysis, post inline + summary comments back to the PR'
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
- `PROJECT` = `{project}`
- `PR_ID` = `{id}`

**GitHub URLs** (`https://github.com/...`) are not supported — tell the user and stop.

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

Capture additionally:

- `repository.project.name` → `PROJECT`

---

## Step 3.5 — Detect prior review

Fetch all existing PR threads and check for prior Claude Code comments. This step runs **unconditionally** and performs **no write actions**.

### Variables exported by this step

| Variable             | Type                | Description                                                    |
| -------------------- | ------------------- | -------------------------------------------------------------- |
| `IS_REREVIEW`        | `true`/`false`      | Whether a prior Claude Code review was found                   |
| `PRIOR_THREADS_FILE` | path                | Temp file — jq-readable JSON array of prior bot threads        |
| `SUMMARY_THREAD_ID`  | integer or `""`     | Thread ID of the prior summary thread (if any)                 |
| `PRIOR_ITERATION_ID` | integer or `"null"` | Iteration number parsed from the most recent prior bot comment |

### Fetch all threads (paginated)

```bash
PRIOR_THREADS_RAW="$(mktemp "${TMPDIR:-/tmp}/pr_threads_raw_XXXXXX.json")"
PRIOR_THREADS_ALL="$(mktemp "${TMPDIR:-/tmp}/pr_threads_all_XXXXXX.json")"
echo '[]' > "$PRIOR_THREADS_ALL"

CONTINUATION_TOKEN=""
while true; do
  EXTRA_ARGS=()
  if [ -n "$CONTINUATION_TOKEN" ]; then
    EXTRA_ARGS=(--query-parameters "continuationToken=$CONTINUATION_TOKEN")
  fi

  az devops invoke \
    --area git \
    --resource pullRequestThreads \
    --route-parameters "project=$PROJECT" "repositoryId=$REPO_ID" "pullRequestId=$PR_ID" \
    --org "$ORG_URL" \
    --api-version "7.1" \
    "${EXTRA_ARGS[@]}" \
    --output json > "$PRIOR_THREADS_RAW"

  jq -s '.[0] + .[1].value' "$PRIOR_THREADS_ALL" "$PRIOR_THREADS_RAW" \
    > "${PRIOR_THREADS_ALL}.tmp" \
    && mv "${PRIOR_THREADS_ALL}.tmp" "$PRIOR_THREADS_ALL"

  CONTINUATION_TOKEN=$(jq -r '.continuationToken // empty' "$PRIOR_THREADS_RAW")
  [ -z "$CONTINUATION_TOKEN" ] && break
done
rm -f "$PRIOR_THREADS_RAW"
```

### Parse bot threads

```bash
PRIOR_THREADS_FILE="$(mktemp "${TMPDIR:-/tmp}/pr_prior_threads_XXXXXX.json")"
SIGNATURE_PREFIX="🤖 *Reviewed by Claude Code*"

jq --arg sig "$SIGNATURE_PREFIX" '
  [
    .[] |
    select(any(.comments[]?; (.content // "") | contains($sig))) |
    {
      threadId: .id,
      filePath: (.threadContext?.filePath // null),
      start:    (.threadContext?.rightFileStart // null),
      end:      (.threadContext?.rightFileEnd // null),
      comments: .comments,
      status:   .status,
      isSummaryCandidate: (
        (.threadContext?.filePath == null) and
        ((.comments[0]?.content // "") | startswith("## PR Review Summary"))
      )
    }
  ] |
  (map(select(.isSummaryCandidate) | .threadId) | max) as $maxSummaryId |
  map(
    .isSummaryThread = (.isSummaryCandidate and .threadId == $maxSummaryId) |
    del(.isSummaryCandidate)
  )
' "$PRIOR_THREADS_ALL" > "$PRIOR_THREADS_FILE"
rm -f "$PRIOR_THREADS_ALL"
```

### Set detection variables

```bash
BOT_THREAD_COUNT=$(jq 'length' "$PRIOR_THREADS_FILE")

if [ "$BOT_THREAD_COUNT" -gt 0 ]; then
  IS_REREVIEW=true

  SUMMARY_THREAD_ID=$(jq -r '
    last(.[] | select(.isSummaryThread == true) | .threadId | tostring) // ""
  ' "$PRIOR_THREADS_FILE")

  PRIOR_ITERATION_ID=$(jq -r '
    [ .[].comments[].content | strings |
      match("Iteration ([0-9]+)") | .captures[0].string
    ] | last // "null"
  ' "$PRIOR_THREADS_FILE")

  echo "Detected $BOT_THREAD_COUNT prior Claude Code threads — re-review mode ON"
else
  IS_REREVIEW=false
  SUMMARY_THREAD_ID=""
  PRIOR_ITERATION_ID="null"
  echo "Detected 0 prior Claude Code threads — re-review mode OFF"
fi
```

---

## Step 3.6 — Fetch PR iterations

Resolve the latest iteration ID and capture its commit SHA. These values drive the file-list query (Step 4) and the incremental diff baseline (spec 04).

```bash
ITERATIONS_JSON=$(az devops invoke \
  --area git \
  --resource pullRequestIterations \
  --route-parameters "project=$PROJECT" "repositoryId=$REPO_ID" "pullRequestId=$PR_ID" \
  --org "$ORG_URL" \
  --api-version "7.1" \
  --output json)

ITERATIONS_VALUE=$(echo "$ITERATIONS_JSON" | jq '.value // []')
ITERATION_COUNT=$(echo "$ITERATIONS_VALUE" | jq 'length')

if [ "$ITERATION_COUNT" -eq 0 ]; then
  echo "Warning: no iterations returned — defaulting to iteration 1"
  LATEST_ITERATION_ID=1
  LATEST_COMMIT_ID=""
else
  LATEST_ITERATION_ID=$(echo "$ITERATIONS_VALUE" | jq 'max_by(.id) | .id')
  LATEST_COMMIT_ID=$(echo "$ITERATIONS_VALUE" | jq -r --argjson id "$LATEST_ITERATION_ID" \
    '.[] | select(.id == $id) | .sourceRefCommit.commitId // ""')
fi
echo "Latest iteration: $LATEST_ITERATION_ID (commit: ${LATEST_COMMIT_ID:-n/a})"
```

When `IS_REREVIEW=true`, resolve the prior commit for spec 04's incremental diff:

```bash
if [ "$IS_REREVIEW" = "true" ]; then
  if [ "$PRIOR_ITERATION_ID" != "null" ]; then
    # Iteration ID was parsed directly from the "— Iteration N" signature suffix
    PRIOR_COMMIT_ID=$(echo "$ITERATIONS_VALUE" | jq -r --argjson id "$PRIOR_ITERATION_ID" \
      '.[] | select(.id == $id) | .sourceRefCommit.commitId // ""')
  else
    # Timestamp fallback: the prior comment had no "— Iteration N" suffix.
    # Find the max publishedDate across all prior bot comments, then pick the
    # highest iteration whose createdDate is still ≤ that timestamp.
    PRIOR_MAX_DATE=$(jq -r '[.[].comments[].publishedDate // empty] | max // ""' "$PRIOR_THREADS_FILE")
    if [ -n "$PRIOR_MAX_DATE" ]; then
      PRIOR_ITERATION_ID=$(echo "$ITERATIONS_VALUE" | jq -r --arg d "$PRIOR_MAX_DATE" \
        '[.[] | select(.createdDate <= $d)] | max_by(.id) | .id // "null"')
      if [ "$PRIOR_ITERATION_ID" != "null" ]; then
        PRIOR_COMMIT_ID=$(echo "$ITERATIONS_VALUE" | jq -r --argjson id "$PRIOR_ITERATION_ID" \
          '.[] | select(.id == $id) | .sourceRefCommit.commitId // ""')
      else
        PRIOR_COMMIT_ID=""
      fi
    else
      PRIOR_COMMIT_ID=""
    fi
  fi
  echo "Prior iteration: $PRIOR_ITERATION_ID (commit: ${PRIOR_COMMIT_ID:-n/a})"
fi
```

---

## Step 4 — List changed files

Use the ADO REST API (note: `az repos pr` has no file-list subcommand):

```bash
az devops invoke \
  --area git \
  --resource pullRequestIterationChanges \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" "iterationId=$LATEST_ITERATION_ID" \
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

Create the diff hunks output file (consumed by spec 05 for thread classification):

```bash
DIFF_HUNKS_FILE="$(mktemp "${TMPDIR:-/tmp}/pr_diff_hunks_XXXXXX.json")"
echo '[]' > "$DIFF_HUNKS_FILE"
```

### Diff strategy

Branch on `IS_REREVIEW` to decide which diff range to use.

#### Path A — First-time review (`IS_REREVIEW=false`)

Run the full branch diff:

```bash
git diff origin/{target-branch}...HEAD --name-only
RAW_DIFF=$(git diff origin/{target-branch}...HEAD)
```

Then [parse hunk boundaries](#hunk-boundary-parsing).

#### Path B — Re-review, no prior commit (`IS_REREVIEW=true`, `PRIOR_COMMIT_ID` empty)

```bash
echo "Warning: could not resolve prior commit — falling back to full diff."
git diff origin/{target-branch}...HEAD --name-only
RAW_DIFF=$(git diff origin/{target-branch}...HEAD)
```

Then [parse hunk boundaries](#hunk-boundary-parsing).

#### Path B2 — Re-review, no latest commit (`IS_REREVIEW=true`, `LATEST_COMMIT_ID` empty)

```bash
echo "Warning: could not resolve latest commit — falling back to full diff."
git diff origin/{target-branch}...HEAD --name-only
RAW_DIFF=$(git diff origin/{target-branch}...HEAD)
```

Then [parse hunk boundaries](#hunk-boundary-parsing).

#### Path C — Re-review, no new commits (`IS_REREVIEW=true`, `PRIOR_COMMIT_ID == LATEST_COMMIT_ID`)

```bash
echo "No new commits since last review."
echo ""
echo "Pending threads from prior review:"
jq -r '.[] | select(.status == "active" or .status == "pending") |
  "  \(.filePath // "(general)") L\(.start.line // "?")-\(.end.line // "?")"' "$PRIOR_THREADS_FILE"
```

**Stop here — do not proceed to Steps 5.5–11.** Clean up temp files and return to the user:

```bash
rm -f "$PRIOR_THREADS_FILE" "$DIFF_HUNKS_FILE"
```

#### Path D — Re-review, new commits (`IS_REREVIEW=true`, `PRIOR_COMMIT_ID != LATEST_COMMIT_ID`)

Attempt to fetch the prior commit, then diff only the new range:

```bash
if git fetch origin "$PRIOR_COMMIT_ID" 2>/dev/null; then
  git diff "${PRIOR_COMMIT_ID}".."${LATEST_COMMIT_ID}" --name-only
  RAW_DIFF=$(git diff "${PRIOR_COMMIT_ID}".."${LATEST_COMMIT_ID}")
else
  echo "Warning: prior commit ${PRIOR_COMMIT_ID} unreachable; latest commit ${LATEST_COMMIT_ID} — falling back to full diff."
  git diff origin/{target-branch}...HEAD --name-only
  RAW_DIFF=$(git diff origin/{target-branch}...HEAD)
fi
```

Then [parse hunk boundaries](#hunk-boundary-parsing).

### Hunk boundary parsing

After obtaining `$RAW_DIFF` in Paths A, B, B2, or D, parse file paths and line ranges into `DIFF_HUNKS_FILE`:

```bash
echo "$RAW_DIFF" | python3 -c "
import sys, json, re
hunks = []
current_file = None
for line in sys.stdin:
    m = re.match(r'^diff --git a/.* b/(.*)', line.rstrip())
    if m:
        current_file = '/' + m.group(1)
        continue
    m = re.match(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', line)
    if m and current_file:
        start = int(m.group(1))
        count = int(m.group(2)) if m.group(2) is not None else 1
        end = start + max(count - 1, 0)
        hunks.append({'filePath': current_file, 'startLine': start, 'endLine': end})
print(json.dumps(hunks))
" > "$DIFF_HUNKS_FILE"
```

If the diff is very large (>500 lines), focus on the most significant changed files rather than trying to pass the entire diff to agents.

---

## Step 5.5 — Classify existing threads

For each non-summary thread in `PRIOR_THREADS_FILE`, assign exactly one classification using diff hunks from `DIFF_HUNKS_FILE`. This step runs **unconditionally** — it is a no-op when `PRIOR_THREADS_FILE` is empty.

**Classification rules (evaluated in order):**

1. **`addressed`** — ADO status is `fixed`, `wontFix`, `closed`, or `byDesign` (string or numeric 2–5), **or** status is `active`/`pending` and the thread's `[start.line, end.line]` range intersects a changed hunk.
2. **`obsolete`** — `filePath` is non-null and does not appear in the diff at all.
3. **`disputed`** — status is `active` and at least one comment does not contain the signature prefix `🤖 *Reviewed by Claude Code*`.
4. **`pending`** — status is `active` and all comments contain the signature prefix (bot-only thread).

General threads (`filePath = null`, non-summary): rules 1 (intersection) and 2 do not apply; classify as `disputed` or `pending` only.

```bash
python3 -c "
import json, sys

threads = json.load(open(sys.argv[1]))
hunks   = json.load(open(sys.argv[2]))

diff_files = {h['filePath'] for h in hunks}
hunk_map   = {}
for h in hunks:
    hunk_map.setdefault(h['filePath'], []).append((h['startLine'], h['endLine']))

deleted_files = {
    fp for fp, ranges in hunk_map.items()
    if all(s == 0 and e == 0 for s, e in ranges)
}

sig_prefix        = '$SIGNATURE_PREFIX'
resolved_statuses = {'fixed', 'wontFix', 'closed', 'byDesign', 2, 3, 4, 5}
counts = {'addressed': 0, 'disputed': 0, 'pending': 0, 'obsolete': 0}

for t in threads:
    if t.get('isSummaryThread'):
        continue

    status    = t.get('status')
    file_path = t.get('filePath')
    comments  = t.get('comments', [])

    if status in resolved_statuses:
        cls = 'addressed'
    elif file_path is not None and (file_path not in diff_files or file_path in deleted_files):
        cls = 'obsolete'
    else:
        start_line = (t.get('start') or {}).get('line')
        end_line   = (t.get('end')   or {}).get('line')
        intersects = (
            file_path is not None
            and start_line is not None
            and end_line is not None
            and any(
                max(start_line, hs) <= min(end_line, he)
                for hs, he in hunk_map.get(file_path, [])
            )
        )
        if intersects:
            cls = 'addressed'
        else:
            has_human = any(sig_prefix not in (c.get('content') or '') for c in comments)
            cls = 'disputed' if has_human else 'pending'

    t['classification'] = cls
    counts[cls] += 1

json.dump(threads, open(sys.argv[1], 'w'))
print('Threads: %d addressed, %d disputed, %d pending, %d obsolete' % (
    counts['addressed'], counts['disputed'], counts['pending'], counts['obsolete']
))
" "$PRIOR_THREADS_FILE" "$DIFF_HUNKS_FILE"
```

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

Initialize the findings-posted counter:

```bash
FINDINGS_POSTED=0
```

Branch on `IS_REREVIEW`.

---

### Path A — IS_REREVIEW=false (first-review flow)

For each finding with a known file and line, post a PR thread:

```bash
cat > /tmp/pr_thread_N.json << 'ENDJSON'
{
  "comments": [
    {
      "commentType": 1,
      "content": "{COMMENT_TEXT}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}"
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

FINDINGS_POSTED=$((FINDINGS_POSTED + 1))
```

**Rules:**

- File paths: leading `/`, forward slashes, must match ADO exactly (as listed in Step 4)
- Line numbers: new/right file (post-diff), not original file
- `offset` can always be `1`
- Multi-line findings: set `rightFileStart.line` to first line, `rightFileEnd.line` to last
- If exact line is unknown, omit `threadContext` entirely (becomes a general comment)
- Use a unique temp file name per comment (e.g. `/tmp/pr_thread_1.json`, `/tmp/pr_thread_2.json`)

---

### Path B — IS_REREVIEW=true (re-review reply flow)

#### Partial-prior-run check

Before processing findings, verify the prior review completed. If the summary thread is known, check it for a completion marker for `PRIOR_ITERATION_ID`. If none is found, the prior run was partial — fall back to Path A for this iteration.

Skip this check when `PRIOR_ITERATION_ID` is `"null"` (no iteration suffix was parsed from the prior signature) — in that case, assume the prior run completed and proceed in re-review mode:

```bash
if [ -n "$SUMMARY_THREAD_ID" ] && [ "$PRIOR_ITERATION_ID" != "null" ]; then
  MARKER_FOUND=$(python3 -c "
import json, sys
threads = json.load(open(sys.argv[1]))
sid = int(sys.argv[2])
pid = sys.argv[3]
prefix = '✅ Review complete — Iteration ' + pid
for t in threads:
    if t.get('threadId') == sid:
        for c in t.get('comments', []):
            if (c.get('content') or '').startswith(prefix):
                print('true')
                sys.exit(0)
print('false')
" "$PRIOR_THREADS_FILE" "$SUMMARY_THREAD_ID" "$PRIOR_ITERATION_ID")

  if [ "$MARKER_FOUND" = "false" ]; then
    echo "No completion marker for Iteration $PRIOR_ITERATION_ID — partial prior run. Falling back to first-review mode."
    IS_REREVIEW=false
  fi
fi
```

If `IS_REREVIEW` was reset to `false` above, use Path A for all findings in this step.

#### Thread matching

For each finding (`{FINDING_FILE}`, line range `{FINDING_START}`–`{FINDING_END}`), search `PRIOR_THREADS_FILE` for a matching prior thread using filePath equality and line-range overlap with ±3 line drift:

```bash
MATCH=$(python3 -c "
import json, sys
DRIFT = 3
threads = json.load(open(sys.argv[1]))
file  = sys.argv[2]
start = int(sys.argv[3])
end   = int(sys.argv[4])
fs, fe = start - DRIFT, end + DRIFT
for t in threads:
    if t.get('isSummaryThread'):
        continue
    if t.get('filePath') != file:
        continue
    ts = ((t.get('start') or {}).get('line') or 0) - DRIFT
    te = ((t.get('end')   or {}).get('line') or 0) + DRIFT
    if max(fs, ts) <= min(fe, te):
        print(json.dumps(t))
        sys.exit(0)
" "$PRIOR_THREADS_FILE" "{FINDING_FILE}" {FINDING_START} {FINDING_END})

CLASSIFICATION=$(echo "$MATCH" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('classification',''))" 2>/dev/null || echo "")
THREAD_ID=$(echo "$MATCH"      | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('threadId',''))"      2>/dev/null || echo "")
```

- If `MATCH` is empty → **no prior thread**: post a fresh thread via Path A (increment `FINDINGS_POSTED`).
- If `MATCH` is non-empty → **prior thread found**: dispatch on `CLASSIFICATION` below.

#### `obsolete` — skip

No action. Do not post. Do not increment `FINDINGS_POSTED`.

#### `pending` — evaluate for new evidence

Read the most recent bot comment from the matched thread (last entry in `matched_thread['comments']` where the content contains `SIGNATURE_PREFIX`). Compare its text against the current finding's comment.

- **No new evidence** (same issue, no additional analysis): skip. Do not post. Do not increment `FINDINGS_POSTED`.
- General `pending` threads with no `filePath` (non-summary): always skip.

- **New evidence** (additional analysis, different suggested fix, new code examples not present in the prior comment): reply with only the new content:

```bash
cat > /tmp/pr_reply_N.json << 'ENDJSON'
{
  "content": "{NEW_EVIDENCE_CONTENT}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}",
  "commentType": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreadComments \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" "threadId=$THREAD_ID" \
  --org {ORG_URL} \
  --http-method POST \
  --in-file /tmp/pr_reply_N.json \
  --api-version "7.1" \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Reply posted, comment', d.get('id'))"

FINDINGS_POSTED=$((FINDINGS_POSTED + 1))
```

#### `disputed` — acknowledge the author's point

Reply without re-asserting the finding. Briefly acknowledge the author's perspective. Always include the ADO nudge before the signature:

```bash
cat > /tmp/pr_reply_N.json << 'ENDJSON'
{
  "content": "{BRIEF_ACKNOWLEDGEMENT}\n\nIf you consider this resolved, please mark the thread as fixed in Azure DevOps.\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}",
  "commentType": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreadComments \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" "threadId=$THREAD_ID" \
  --org {ORG_URL} \
  --http-method POST \
  --in-file /tmp/pr_reply_N.json \
  --api-version "7.1" \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Reply posted, comment', d.get('id'))"

FINDINGS_POSTED=$((FINDINGS_POSTED + 1))
```

#### `addressed` — confirm resolution and mark thread fixed

Reply to confirm the fix, then PATCH the thread status to `fixed` (`status: 2`). Log 409 and continue:

```bash
# 1. Post reply
cat > /tmp/pr_reply_N.json << 'ENDJSON'
{
  "content": "Resolved as of Iteration {LATEST_ITERATION_ID} — thanks!\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}",
  "commentType": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreadComments \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" "threadId=$THREAD_ID" \
  --org {ORG_URL} \
  --http-method POST \
  --in-file /tmp/pr_reply_N.json \
  --api-version "7.1" \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Reply posted, comment', d.get('id'))"

# 2. PATCH thread status to fixed (2)
cat > /tmp/pr_thread_patch_N.json << 'ENDJSON'
{ "status": 2 }
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" "threadId=$THREAD_ID" \
  --org {ORG_URL} \
  --http-method PATCH \
  --in-file /tmp/pr_thread_patch_N.json \
  --api-version "7.1" \
  --output json 2>/tmp/pr_patch_err_N.json | \
  python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print('Thread patched to fixed')
except Exception:
    err = open('/tmp/pr_patch_err_N.json').read()
    if '409' in err or 'conflict' in err.lower():
        print('409 Conflict — thread resolved concurrently. Continuing.')
    else:
        print('PATCH warning:', err[:200])
"

FINDINGS_POSTED=$((FINDINGS_POSTED + 1))
```

---

## Step 11 — Post summary comment

After all inline comments, post one general thread **without** `threadContext`:

```bash
cat > /tmp/pr_summary.json << 'ENDJSON'
{
  "comments": [
    {
      "commentType": 1,
      "content": "## PR Review Summary — {PR_TITLE}\n\n{SUMMARY_CONTENT}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}"
    }
  ],
  "status": 1
}
ENDJSON

SUMMARY_RESPONSE=$(az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" \
  --org {ORG_URL} \
  --http-method POST \
  --in-file /tmp/pr_summary.json \
  --api-version "7.1" \
  --output json)
echo "$SUMMARY_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print('Summary thread', d.get('id'), d.get('status'))"
# Always update SUMMARY_THREAD_ID to the newly posted thread so Step 11.5 posts the
# completion marker to the current run's summary thread, not the prior one.
SUMMARY_THREAD_ID=$(echo "$SUMMARY_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
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

🤖 _Reviewed by Claude Code_ — Iteration {N}
```

---

## Step 11.5 — Post completion marker

After Step 11 completes, post one final reply to the summary thread. This is the last write action of every successful run (first review or re-review):

```bash
cat > /tmp/pr_completion_marker.json << 'ENDJSON'
{
  "content": "✅ Review complete — Iteration {LATEST_ITERATION_ID} ({FINDINGS_POSTED} findings posted)\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}",
  "commentType": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreadComments \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" "threadId=$SUMMARY_THREAD_ID" \
  --org {ORG_URL} \
  --http-method POST \
  --in-file /tmp/pr_completion_marker.json \
  --api-version "7.1" \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Completion marker posted, comment', d.get('id'))"
```

The absence of this marker for `LATEST_ITERATION_ID` on the next run signals a partial prior run — Step 10 detects this and falls back to first-review mode.

---

## Step 12 — Clean up

```bash
rm -f /tmp/pr_thread_*.json /tmp/pr_reply_*.json /tmp/pr_thread_patch_*.json /tmp/pr_patch_err_*.json /tmp/pr_completion_marker.json /tmp/pr_summary.json
rm -f "$PRIOR_THREADS_FILE" "$DIFF_HUNKS_FILE"
```

---

## Comment signature

Every comment — inline or summary — **must** end with this trailer on its own line:

```txt
---
🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}
```

Two constants govern signature generation:

- `SIGNATURE_PREFIX` = `🤖 *Reviewed by Claude Code*`
- `SIGNATURE` = `🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}` (resolved at post time)

Never alter the prefix — re-review detection depends on it.

---

## Notes

- The PR may already be merged — post comments anyway as a review record.
- Use `az repos pr checkout --id {PR_ID} --org {ORG_URL}` if the local branch doesn't match the source branch.
- Always use the latest iteration of the PR (`LATEST_ITERATION_ID`). Re-reviews additionally compute `PRIOR_ITERATION_ID` — see Step 3.5 and Step 3.6.
- If `az devops invoke` returns an error on `threadContext` (e.g. file not found in the diff), retry without `threadContext` to post as a general comment.
- The detection prefix is `🤖 *Reviewed by Claude Code*` (substring match). The full emitted form is `🤖 *Reviewed by Claude Code* — Iteration N`. Never alter the prefix — re-review detection depends on it.
