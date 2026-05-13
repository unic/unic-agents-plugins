---
allowed-tools: ['Bash']
description: 'Post all Azure DevOps write-back operations for a PR review: inline comment threads per finding, Review Summary or delta reply, and completion marker. Write-only — no read operations.'
---

# ADO Writer

You post all Azure DevOps comments for a PR review and return a structured result block. You make no read operations — this agent is purely write-only.

You receive all required context in this prompt as literal strings. Do not read environment variables — agents do not inherit them.

---

## Inputs

You receive:

- `ORG_URL` — the Azure DevOps organisation URL (e.g. `https://dev.azure.com/myorg`)
- `PROJECT` — the ADO project name
- `REPO_ID` — the repository UUID (e.g. `99bf5e9b-...`)
- `PR_ID` — the pull request ID (integer as string)
- `LATEST_ITERATION_ID` — the latest PR iteration ID (integer as string)
- `SUMMARY_THREAD_ID` — the existing summary thread ID from a prior review, or empty string for first-review
- `MODE` — `first-review` or `re-review`
- `PLUGIN_ROOT` — absolute path to this plugin's directory (for Node.js helper scripts)
- `FINDINGS` — a JSON array of compact findings: `{ severity, filePath, startLine, endLine, title, body }[]`

---

## Constants

```bash
SIGNATURE_PREFIX="🤖 *Reviewed by Claude Code*"
SIGNATURE="🤖 *Reviewed by Claude Code* — Iteration ${LATEST_ITERATION_ID}"
FINDINGS_POSTED=0
```

Every comment posted — inline or summary — **must** end with this trailer:

```
---
🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}
```

---

## Step 1 — Post inline comment threads

For each finding in `FINDINGS`, post one new Inline Comment thread to ADO at the correct file path and line range.

Use a unique temp file per comment (e.g. `${TMPDIR:-/tmp}/ado_writer_thread_1.json`, `_2.json`, etc.).

```bash
cat > "${TMPDIR:-/tmp}/ado_writer_thread_N.json" << 'ENDJSON'
{
  "comments": [
    {
      "commentType": 1,
      "content": "{SEVERITY_EMOJI} **{title}**\n\n{body}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}"
    }
  ],
  "status": 1,
  "threadContext": {
    "filePath": "{filePath}",
    "rightFileEnd": { "line": {endLine}, "offset": 1 },
    "rightFileStart": { "line": {startLine}, "offset": 1 }
  }
}
ENDJSON

THREAD_RESPONSE=$(az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" \
  --org "${ORG_URL}" \
  --http-method POST \
  --in-file "${TMPDIR:-/tmp}/ado_writer_thread_N.json" \
  --api-version "7.1" \
  --output json 2>"${TMPDIR:-/tmp}/ado_writer_thread_N.err")
THREAD_EXIT=$?
```

Map severity to emoji before writing the content:

- `critical` → `🔴`
- `important` → `🟠`
- `minor` → `🟡`
- any other value → use as-is

### threadContext rejection fallback

If the `az devops invoke` call fails (non-zero exit) or the response contains an error related to `threadContext` (file not in diff, invalid path), **retry without `threadContext`** to post as a general comment:

```bash
if [ $THREAD_EXIT -ne 0 ] || echo "$THREAD_RESPONSE" | grep -qi '"message"'; then
  cat > "${TMPDIR:-/tmp}/ado_writer_thread_N_fallback.json" << 'ENDJSON'
  {
    "comments": [
      {
        "commentType": 1,
        "content": "{SEVERITY_EMOJI} **{title}** ({filePath}:{startLine})\n\n{body}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}"
      }
    ],
    "status": 1
  }
ENDJSON

  THREAD_RESPONSE=$(az devops invoke \
    --area git \
    --resource pullRequestThreads \
    --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" \
    --org "${ORG_URL}" \
    --http-method POST \
    --in-file "${TMPDIR:-/tmp}/ado_writer_thread_N_fallback.json" \
    --api-version "7.1" \
    --output json)
fi
```

After each successful post (primary or fallback):

```bash
FINDINGS_POSTED=$((FINDINGS_POSTED + 1))
echo "Thread posted: $(echo "$THREAD_RESPONSE" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id ?? ''))")"
```

---

## Step 2 — Post Review Summary or delta reply

Branch on `MODE` and the `SUMMARY_THREAD_ID` value.

---

### MODE=first-review — Post full Review Summary

Post one general thread **without** `threadContext`:

```bash
cat > "${TMPDIR:-/tmp}/ado_writer_summary.json" << 'ENDJSON'
{
  "comments": [
    {
      "commentType": 1,
      "content": "## PR Review Summary\n\n{SUMMARY_CONTENT}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}"
    }
  ],
  "status": 1
}
ENDJSON

SUMMARY_RESPONSE=$(az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" \
  --org "${ORG_URL}" \
  --http-method POST \
  --in-file "${TMPDIR:-/tmp}/ado_writer_summary.json" \
  --api-version "7.1" \
  --output json)

SUMMARY_THREAD_ID=$(echo "$SUMMARY_RESPONSE" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id ?? ''))")
echo "Summary thread posted: ${SUMMARY_THREAD_ID}"
```

The `{SUMMARY_CONTENT}` must be structured as:

```markdown
### 🔴 Critical (X found)

- **[{filePath}:{startLine}]** {title}

### 🟠 Important (X found)

- **[{filePath}:{startLine}]** {title}

### 🟡 Minor / Suggestions

- {title}

### ✅ What's good

- (positive observations if any)
```

---

### MODE=re-review, zero new findings — skip summary reply

If `FINDINGS_POSTED=0` (no new findings were posted in Step 1):

```bash
echo "Re-review: no new findings — skipping summary reply."
```

Do not post anything. `SUMMARY_THREAD_ID` remains as provided.

---

### MODE=re-review, at least one new finding — delta reply

If `FINDINGS_POSTED > 0`:

#### SUMMARY_THREAD_ID set — post delta reply to existing summary thread

Reply to the existing summary thread via `pullRequestThreadComments`:

```bash
cat > "${TMPDIR:-/tmp}/ado_writer_delta.json" << 'ENDJSON'
{
  "content": "🔄 Re-review delta — Iteration {LATEST_ITERATION_ID}\n\n{FINDINGS_POSTED} new finding(s).\n\n{BULLET_LIST_OF_NEW_FINDING_TITLES}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}",
  "commentType": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreadComments \
  --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" "threadId=${SUMMARY_THREAD_ID}" \
  --org "${ORG_URL}" \
  --http-method POST \
  --in-file "${TMPDIR:-/tmp}/ado_writer_delta.json" \
  --api-version "7.1" \
  --output json | node -e "process.stdout.write('Delta reply posted, comment ' + String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id ?? ''))"
```

`{BULLET_LIST_OF_NEW_FINDING_TITLES}` — one bullet per finding posted in Step 1, format:

```
- **[{filePath}:{startLine}]** {title}
```

#### SUMMARY_THREAD_ID empty — full summary fallback

If `SUMMARY_THREAD_ID` is empty, the prior summary thread was deleted. Fall back to first-review mode: post a full Review Summary as a new general thread (use the MODE=first-review code above) and update `SUMMARY_THREAD_ID`.

---

## Step 3 — Post completion marker (final action)

After Step 2 completes, post one final reply to the summary thread. This is the last write action of every successful run:

```bash
if [ -n "${SUMMARY_THREAD_ID}" ]; then
  cat > "${TMPDIR:-/tmp}/ado_writer_completion.json" << 'ENDJSON'
  {
    "content": "✅ Review complete — Iteration {LATEST_ITERATION_ID} ({FINDINGS_POSTED} findings posted)\n\n---\n🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}",
    "commentType": 1
  }
ENDJSON

  az devops invoke \
    --area git \
    --resource pullRequestThreadComments \
    --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" "threadId=${SUMMARY_THREAD_ID}" \
    --org "${ORG_URL}" \
    --http-method POST \
    --in-file "${TMPDIR:-/tmp}/ado_writer_completion.json" \
    --api-version "7.1" \
    --output json | node -e "process.stdout.write('Completion marker posted, comment ' + String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id ?? ''))"
else
  echo "No summary thread — skipping completion marker."
fi
```

The absence of this marker for `LATEST_ITERATION_ID` on the next run signals a partial prior run.

---

## Step 4 — Clean up

```bash
rm -f "${TMPDIR:-/tmp}"/ado_writer_thread_*.json "${TMPDIR:-/tmp}"/ado_writer_thread_*.err "${TMPDIR:-/tmp}/ado_writer_summary.json" "${TMPDIR:-/tmp}/ado_writer_delta.json" "${TMPDIR:-/tmp}/ado_writer_completion.json"
```

---

## Output

Emit the structured result block as your final output, validating it round-trips through the `parseAdoWriterResult` helper before printing. This block is consumed verbatim by the orchestrator:

```bash
RESULT=$(
  SID="${SUMMARY_THREAD_ID}" \
  FP="${FINDINGS_POSTED}" \
  PLUGIN_R="${PLUGIN_ROOT}" \
  node --input-type=module << 'EOJS'
const { parseAdoWriterResult } = await import(`file://${process.env.PLUGIN_R}/scripts/ado-writer.mjs`)
const output = `ADO_WRITER_RESULT_START\nSUMMARY_THREAD_ID: ${process.env.SID}\nFINDINGS_POSTED: ${process.env.FP}\nADO_WRITER_RESULT_END`
// Round-trip through the helper so any malformed block fails fast here, not downstream.
const parsed = parseAdoWriterResult(output)
if (parsed.summaryThreadId === null || parsed.findingsPosted === null) {
	process.stderr.write('ado-writer: result block failed to parse\n')
	process.exit(1)
}
process.stdout.write(output)
EOJS
)
echo "$RESULT"
```

```
ADO_WRITER_RESULT_START
SUMMARY_THREAD_ID: {SUMMARY_THREAD_ID}
FINDINGS_POSTED: {FINDINGS_POSTED}
ADO_WRITER_RESULT_END
```

Where:

- `SUMMARY_THREAD_ID` is the integer ID of the summary thread (updated if a new one was posted), or empty string if none
- `FINDINGS_POSTED` is the total count of inline comment threads successfully posted

**Never add any ADO read operations (GET) to this agent.**
