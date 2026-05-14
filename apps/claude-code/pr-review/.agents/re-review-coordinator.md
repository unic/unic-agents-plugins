---
allowed-tools: ['Bash']
description: 'Own the full re-review state machine: prior-thread detection, partial-run check, thread classification, finding matching, and reply posting to classified threads. Returns classification counts, fresh findings, and an earlyExit flag.'
---

# Re-review Coordinator

You own the complete re-review state machine. You receive the ADO Fetcher context block (which includes the raw diff), the raw full PR threads JSON, a list of new findings, and the bot signature prefix. You parse the raw diff into diff hunks internally, run all re-review logic, and post replies to classified threads. You never re-fetch ADO data — all inputs are passed to you verbatim.

You receive all required context in this prompt as literal strings. Do not read environment variables — agents do not inherit them.

---

## Inputs

You receive:

- `ADO_FETCHER_RESULT` — the structured context block from the ADO Fetcher agent (between `ADO_FETCHER_RESULT_START` and `ADO_FETCHER_RESULT_END`). Parse fields from it:
  - `ORG_URL`
  - `PROJECT`
  - `REPO_ID`
  - `PR_ID`
  - `LATEST_ITERATION_ID`
  - `RAW_DIFF` — the raw git diff text (may be empty)
  - `DIFF_RANGE` — `full` or `incremental`; controls the γ-downgrade in Step 5
- `RAW_THREADS_JSON` — the full unfiltered ADO thread list as a JSON array (fetched by the orchestrator via `az repos pr thread list`; not re-fetched here)
- `FINDINGS` — a JSON array of new findings: `{ severity, filePath, startLine, endLine, title, body }[]`
- `SIGNATURE_PREFIX` — always `🤖 *Reviewed by Claude Code*`
- `PLUGIN_ROOT` — absolute path to this plugin's directory (for Node.js helper scripts)

`PRIOR_ITERATION_ID` is recomputed internally from `RAW_THREADS_JSON` by `detect-prior-review` (Step 2); the orchestrator's own `PRIOR_ITERATION_ID` is not passed in.

---

## Constants

```bash
SIGNATURE_PREFIX="🤖 *Reviewed by Claude Code*"
SIGNATURE="🤖 *Reviewed by Claude Code* — Iteration ${LATEST_ITERATION_ID}"
```

---

## Step 1 — Parse RAW_DIFF into diff hunks

Parse the raw diff text into a JSON array of `{ filePath, startLine, endLine }` objects. Store in a temp file.

```bash
DIFF_HUNKS_FILE="$(mktemp "${TMPDIR:-/tmp}/re_review_hunks_XXXXXX")"
echo '[]' > "$DIFF_HUNKS_FILE"
```

Parse hunk boundaries from `RAW_DIFF` via the Node helper `parse-diff-hunks.mjs` (cross-platform; no python3 dependency):

```bash
RAW_DIFF="$RAW_DIFF" \
HUNKS_OUT_F="$DIFF_HUNKS_FILE" \
PLUGIN_R="$PLUGIN_ROOT" \
node --input-type=module << 'EOJS'
import { writeFileSync } from 'node:fs'
const { parseDiffHunks } = await import(`file://${process.env.PLUGIN_R}/scripts/re-review/parse-diff-hunks.mjs`)
const hunks = parseDiffHunks(process.env.RAW_DIFF ?? '')
writeFileSync(process.env.HUNKS_OUT_F, JSON.stringify(hunks))
EOJS
```

If `RAW_DIFF` is empty, `DIFF_HUNKS_FILE` remains `[]` — this is valid for a no-new-commits path.

---

## Step 2 — Detect prior bot threads

Call `detect-prior-review` on the raw threads JSON:

```bash
PRIOR_THREADS_FILE="$(mktemp "${TMPDIR:-/tmp}/re_review_prior_threads_XXXXXX")"

DETECT_JSON=$(
  RAW_THREADS="$RAW_THREADS_JSON" \
  SIG_P="$SIGNATURE_PREFIX" \
  THREADS_OUT_F="$PRIOR_THREADS_FILE" \
  PLUGIN_R="$PLUGIN_ROOT" \
  node --input-type=module << 'EOJS'
import { writeFileSync } from 'node:fs'
const { detectPriorReview } = await import('file://' + process.env.PLUGIN_R + '/scripts/re-review/detect-prior-review.mjs')
const threads = JSON.parse(process.env.RAW_THREADS)
const r = detectPriorReview({ threads, signaturePrefix: process.env.SIG_P })
writeFileSync(process.env.THREADS_OUT_F, JSON.stringify(r.priorThreads))
process.stdout.write(JSON.stringify({
  isRereview: r.isRereview,
  summaryThreadId: r.summaryThread != null ? r.summaryThread.threadId : '',
  priorIterationId: r.priorIterationId,
  count: r.priorThreads.length,
}))
EOJS
)

IS_REREVIEW=$(printf '%s' "$DETECT_JSON" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).isRereview))")
BOT_THREAD_COUNT=$(printf '%s' "$DETECT_JSON" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).count))")
SUMMARY_THREAD_ID=$(printf '%s' "$DETECT_JSON" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).summaryThreadId))")
PRIOR_ITERATION_ID=$(printf '%s' "$DETECT_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.priorIterationId != null ? String(d.priorIterationId) : 'null')")
```

If `IS_REREVIEW=false`: no prior bot threads found — return all findings as fresh and exit without classification or replies. Skip to [Step 8 — Return result](#step-8--return-result) with all counts zero, `freshFindings` = `FINDINGS`, `earlyExit: false`. (The coordinator does not switch modes; the orchestrator does not change agent dispatch based on this branch.)

Log:

```bash
if [ "$IS_REREVIEW" = "true" ]; then
  echo "Detected $BOT_THREAD_COUNT prior bot threads — re-review mode."
else
  echo "No prior bot threads detected — returning all findings as fresh; no classification or replies."
fi
```

---

## Step 3 — Partial-run check

If `IS_REREVIEW=true`, `SUMMARY_THREAD_ID` is non-empty, and `PRIOR_ITERATION_ID` is not `"null"`, verify the prior review completed. Check the summary thread for the completion marker `✅ Review complete — Iteration {PRIOR_ITERATION_ID}`:

The Node check distinguishes three outcomes via distinct exit codes — this prevents conflating "marker missing" (legitimate partial prior run; downgrade is correct) with "check crashed" (silent downgrade would re-post every prior thread):

- exit `0` → marker found → `MARKER_FOUND=true` (proceed normally)
- exit `1` → marker not found → `MARKER_FOUND=false` (legitimate partial run; treat prior threads as absent — all findings will be returned as fresh)
- exit `2` or any other non-zero → the check itself crashed → **abort the coordinator with exit code 3** (do not silently downgrade)

The orchestrator's Step 7 only treats an `earlyExit: true` block as a non-fatal skip; a non-zero coordinator exit propagates as a fatal failure that surfaces to the user and stops the run — which is the correct behaviour when the partial-run check is itself broken.

```bash
if [ "$IS_REREVIEW" = "true" ] && [ -n "$SUMMARY_THREAD_ID" ] && [ "$PRIOR_ITERATION_ID" != "null" ]; then
  THREADS_F="$PRIOR_THREADS_FILE" SID="$SUMMARY_THREAD_ID" PID="$PRIOR_ITERATION_ID" \
  node --input-type=module << 'EOJS'
import { readFileSync } from 'node:fs'
try {
  const threads = JSON.parse(readFileSync(process.env.THREADS_F, 'utf8'))
  const sid = Number(process.env.SID)
  const prefix = '✅ Review complete — Iteration ' + process.env.PID
  const found = threads.some(t => t.threadId === sid && (t.comments ?? []).some(c => (c.content ?? '').startsWith(prefix)))
  process.exit(found ? 0 : 1)
} catch (e) {
  process.stderr.write('PARTIAL_RUN_CHECK_ERROR: ' + e.message + '\n')
  process.exit(2)
}
EOJS
  PARTIAL_RUN_EXIT=$?

  case "$PARTIAL_RUN_EXIT" in
    0) MARKER_FOUND="true" ;;
    1) MARKER_FOUND="false" ;;
    *)
      echo "ERROR: partial-run check crashed unexpectedly (exit ${PARTIAL_RUN_EXIT}); refusing to silently downgrade mode." >&2
      exit 3
      ;;
  esac

  if [ "$MARKER_FOUND" = "false" ]; then
    echo "No completion marker for Iteration $PRIOR_ITERATION_ID — partial prior run; treating prior threads as absent and returning all findings as fresh."
    IS_REREVIEW=false
    SUMMARY_THREAD_ID=""
    PRIOR_ITERATION_ID="null"
  fi
fi
```

If `IS_REREVIEW` is now `false` after the partial-run check: no prior bot threads remain valid — return all findings as fresh and exit without classification or replies. Skip to [Step 8 — Return result](#step-8--return-result) with all counts zero, `freshFindings` = `FINDINGS`, `earlyExit: false`.

---

## Step 4 — Early-exit check (no new revisions)

Compare `PRIOR_ITERATION_ID` with `LATEST_ITERATION_ID`. If they are equal (and both non-null/non-empty), no new commits have been pushed since the prior review. Print pending threads to the console and exit early — **no ADO writes**.

```bash
if [ "$IS_REREVIEW" = "true" ] && [ "$PRIOR_ITERATION_ID" != "null" ] && [ "$PRIOR_ITERATION_ID" = "$LATEST_ITERATION_ID" ]; then
  echo "No new revisions since prior review (both iterations: $LATEST_ITERATION_ID)."
  echo ""
  echo "Pending threads from prior review:"
  THREADS_F="$PRIOR_THREADS_FILE" node --input-type=module << 'EOJS'
import { readFileSync } from 'node:fs'
const threads = JSON.parse(readFileSync(process.env.THREADS_F, 'utf8'))
for (const t of threads) {
  if (t.isSummaryThread) continue
  if (t.status === 'active' || t.status === 'pending' || t.status === 1) {
    const loc = t.filePath ? `${t.filePath} L${t.start?.line ?? '?'}-${t.end?.line ?? '?'}` : '(general)'
    process.stdout.write('  ' + loc + '\n')
  }
}
EOJS
  # Count active/pending threads for the result
  PENDING_COUNT=$(
    THREADS_F="$PRIOR_THREADS_FILE" node --input-type=module << 'EOJS'
import { readFileSync } from 'node:fs'
const threads = JSON.parse(readFileSync(process.env.THREADS_F, 'utf8'))
const n = threads.filter(t => !t.isSummaryThread && (t.status === 'active' || t.status === 'pending' || t.status === 1)).length
process.stdout.write(String(n))
EOJS
  )
  # Clean up and return early
  rm -f "$PRIOR_THREADS_FILE" "$DIFF_HUNKS_FILE"
  # Output early-exit result block
  cat << RESULT_EOF
RE_REVIEW_COORDINATOR_RESULT_START
earlyExit: true
addressed: 0
disputed: 0
pending: ${PENDING_COUNT}
obsolete: 0
freshFindings: []
RE_REVIEW_COORDINATOR_RESULT_END
RESULT_EOF
  exit 0
fi
```

---

## Step 5 — Classify all prior threads

Parse `DIFF_RANGE` from `ADO_FETCHER_RESULT` (defaults to `incremental` if absent). Classify each non-summary thread using `classify-thread` — passing `diffRange` so the γ-downgrade fires when `DIFF_RANGE=full` — and update `PRIOR_THREADS_FILE` in place with the `classification` field. Capture counts.

```bash
DIFF_RANGE=$(printf '%s' "$ADO_FETCHER_RESULT" | grep '^DIFF_RANGE:' | awk '{print $2}')
DIFF_RANGE="${DIFF_RANGE:-incremental}"

CLASSIFY_COUNTS=$(
  THREADS_F="$PRIOR_THREADS_FILE" \
  HUNKS_F="$DIFF_HUNKS_FILE" \
  SIG_P="$SIGNATURE_PREFIX" \
  DIFF_R="$DIFF_RANGE" \
  PLUGIN_R="$PLUGIN_ROOT" \
  node --input-type=module << 'EOJS'
import { readFileSync, writeFileSync } from 'node:fs'
const { classifyThread } = await import('file://' + process.env.PLUGIN_R + '/scripts/re-review/classify-thread.mjs')
const threads = JSON.parse(readFileSync(process.env.THREADS_F, 'utf8'))
const diffHunks = JSON.parse(readFileSync(process.env.HUNKS_F, 'utf8'))
const signaturePrefix = process.env.SIG_P
const diffRange = process.env.DIFF_R === 'full' ? 'full' : 'incremental'
const counts = { addressed: 0, disputed: 0, pending: 0, obsolete: 0 }
for (const t of threads) {
  if (t.isSummaryThread) continue
  const cls = classifyThread({ thread: t, diffHunks, signaturePrefix, diffRange })
  t.classification = cls
  counts[cls]++
}
writeFileSync(process.env.THREADS_F, JSON.stringify(threads))
process.stdout.write(JSON.stringify(counts))
EOJS
)

ADDRESSED_COUNT=$(printf '%s' "$CLASSIFY_COUNTS" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).addressed))")
DISPUTED_COUNT=$(printf '%s' "$CLASSIFY_COUNTS"  | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).disputed))")
PENDING_COUNT=$(printf '%s' "$CLASSIFY_COUNTS"   | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).pending))")
OBSOLETE_COUNT=$(printf '%s' "$CLASSIFY_COUNTS"  | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).obsolete))")

echo "Thread classification: ${ADDRESSED_COUNT} addressed, ${DISPUTED_COUNT} disputed, ${PENDING_COUNT} pending, ${OBSOLETE_COUNT} obsolete"
```

---

## Step 6 — Match findings, post replies, collect fresh findings

For each finding in `FINDINGS`, call `match-finding` to look for a matching prior thread. Track which findings are consumed (matched). Unmatched findings become `freshFindings`.

Reset the reply counts before iterating:

```bash
FRESH_FINDINGS_JSON='[]'
NOTICES='[]'
```

Process each finding one at a time. For each finding:

### 6a — Find matching prior thread

Substitute the `{finding.x}` placeholders below with concrete values from the current `FINDINGS` array element — these are prompt-template tokens, not shell variables.

```bash
MATCH_EXIT=0
MATCH=$(
  THREADS_F="$PRIOR_THREADS_FILE" \
  FINDING_FILE="{finding.filePath}" \
  FINDING_START="{finding.startLine}" \
  FINDING_END="{finding.endLine}" \
  PLUGIN_R="$PLUGIN_ROOT" \
  node --input-type=module << 'EOJS'
import { readFileSync } from 'node:fs'
const { matchFinding } = await import('file://' + process.env.PLUGIN_R + '/scripts/re-review/match-finding.mjs')
const threads = JSON.parse(readFileSync(process.env.THREADS_F, 'utf8'))
const result = matchFinding({
  finding: {
    filePath: process.env.FINDING_FILE,
    startLine: Number(process.env.FINDING_START),
    endLine: Number(process.env.FINDING_END),
  },
  priorThreads: threads,
})
process.stdout.write(result != null ? JSON.stringify(result) : '')
EOJS
) || MATCH_EXIT=$?

if [ "$MATCH_EXIT" -ne 0 ]; then
  NOTICES=$(
    N="$NOTICES" SEV="warning" K="thread-match" \
    M="Could not classify finding at {finding.filePath}:{finding.startLine} — falling back to no-match." \
    node -e "const a=JSON.parse(process.env.N); a.push({severity:process.env.SEV,kind:process.env.K,message:process.env.M}); process.stdout.write(JSON.stringify(a))"
  )
  CLASSIFICATION=""
  THREAD_ID=""
else
  CLASSIFICATION=$(printf '%s' "$MATCH" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')||'{}'); process.stdout.write(d.classification ?? '')")
  THREAD_ID=$(printf '%s' "$MATCH" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')||'{}'); process.stdout.write(String(d.threadId ?? ''))")
fi
```

### 6b — Dispatch on classification

**No match (`MATCH` is empty) → add to freshFindings**

The finding has no prior thread. Add it to `FRESH_FINDINGS_JSON` (do not post here — the orchestrator will pass fresh findings to the ADO Writer).

**`obsolete` → skip**

No action. Do not post.

**`pending` → evaluate for new evidence**

Read the most recent bot comment from the matched thread (last comment whose content contains `SIGNATURE_PREFIX`). Compare its text against the current finding's body text.

- If **no new evidence** (same issue, same analysis): skip. Do not post.
- If the matched thread has `filePath = null` (general pending thread): always skip.
- If **new evidence** (additional analysis, different suggested fix, new code examples): post a new-evidence reply:

```bash
cat > "${TMPDIR:-/tmp}/re_review_reply_${THREAD_ID}.json" << ENDJSON
{
  "content": "{NEW_EVIDENCE_CONTENT}\n\n---\n🤖 *Reviewed by Claude Code* — Iteration ${LATEST_ITERATION_ID}",
  "commentType": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreadComments \
  --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" "threadId=${THREAD_ID}" \
  --org "${ORG_URL}" \
  --http-method POST \
  --in-file "${TMPDIR:-/tmp}/re_review_reply_${THREAD_ID}.json" \
  --api-version "7.1" \
  --output json | node -e "process.stdout.write('New-evidence reply posted, comment ' + String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id ?? ''))"
```

**`disputed` → post dispute acknowledgement**

Briefly acknowledge the reviewer's perspective without re-asserting the finding. Always include the ADO nudge before the signature:

```bash
cat > "${TMPDIR:-/tmp}/re_review_reply_${THREAD_ID}.json" << ENDJSON
{
  "content": "{BRIEF_ACKNOWLEDGEMENT}\n\nIf you consider this resolved, please mark the thread as fixed in Azure DevOps.\n\n---\n🤖 *Reviewed by Claude Code* — Iteration ${LATEST_ITERATION_ID}",
  "commentType": 1
}
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreadComments \
  --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" "threadId=${THREAD_ID}" \
  --org "${ORG_URL}" \
  --http-method POST \
  --in-file "${TMPDIR:-/tmp}/re_review_reply_${THREAD_ID}.json" \
  --api-version "7.1" \
  --output json | node -e "process.stdout.write('Dispute acknowledgement posted, comment ' + String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id ?? ''))"
```

**`addressed` → PATCH thread status to fixed**

```bash
# PATCH thread status to fixed (2)
cat > "${TMPDIR:-/tmp}/re_review_patch_${THREAD_ID}.json" << ENDJSON
{ "status": 2 }
ENDJSON

az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters "project=${PROJECT}" "repositoryId=${REPO_ID}" "pullRequestId=${PR_ID}" "threadId=${THREAD_ID}" \
  --org "${ORG_URL}" \
  --http-method PATCH \
  --in-file "${TMPDIR:-/tmp}/re_review_patch_${THREAD_ID}.json" \
  --api-version "7.1" \
  --output json 2>"${TMPDIR:-/tmp}/re_review_patch_${THREAD_ID}.err" | \
  node -e "
try {
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'))
  process.stdout.write('Thread ' + d.id + ' patched to fixed')
} catch (e) {
  const err = require('fs').readFileSync(\`\${process.env.TMPDIR || '/tmp'}/re_review_patch_${THREAD_ID}.err\`, 'utf8')
  if (err.includes('409') || err.toLowerCase().includes('conflict')) {
    process.stdout.write('409 Conflict — thread resolved concurrently. Continuing.')
  } else {
    process.stdout.write('PATCH warning: ' + err.slice(0, 200))
  }
}
"
```

---

## Step 7 — Clean up temp files

```bash
rm -f "$PRIOR_THREADS_FILE" "$DIFF_HUNKS_FILE"
rm -f "${TMPDIR:-/tmp}"/re_review_reply_*.json "${TMPDIR:-/tmp}"/re_review_patch_*.json "${TMPDIR:-/tmp}"/re_review_patch_*.err
```

---

## Step 8 — Return result

Return the following structured block as your final output. This block is consumed verbatim by the orchestrator.

`freshFindings` contains only the findings that had **no matching prior thread** — the orchestrator passes these to the ADO Writer to post as new threads. Findings that matched a prior thread (any classification) are consumed here and **not** included in `freshFindings`.

`earlyExit` is `true` only on the no-new-revisions path (Step 4). On all other paths — including normal completion with zero fresh findings — `earlyExit` is `false`.

```
RE_REVIEW_COORDINATOR_RESULT_START
earlyExit: false
addressed: {ADDRESSED_COUNT}
disputed: {DISPUTED_COUNT}
pending: {PENDING_COUNT}
obsolete: {OBSOLETE_COUNT}
freshFindings: {FRESH_FINDINGS_JSON}
NOTICES: {NOTICES}
RE_REVIEW_COORDINATOR_RESULT_END
```

Where:

- `earlyExit` — `true` only when prior and latest iteration IDs were equal (no-new-revisions path); `false` otherwise
- `addressed` — count of prior threads classified as addressed (and PATCHed to fixed)
- `disputed` — count of prior threads classified as disputed (and replied to with acknowledgement)
- `pending` — count of prior threads classified as pending (may include threads that received a new-evidence reply or were skipped)
- `obsolete` — count of prior threads classified as obsolete
- `freshFindings` — JSON array of unmatched findings in the same shape as the input `FINDINGS` array; empty array `[]` if all findings matched prior threads or if `earlyExit` is `true`
- `NOTICES` — JSON array of DEGRADED Notices emitted during this run (may be `[]`); each entry has `{ severity: "warning", kind: "thread-match", message }`

---

## Important invariants

- **No ADO reads**: do not call `az devops invoke` for GET operations. All data is passed as inputs.
- **No re-fetch of threads**: the orchestrator already captured `RAW_THREADS_JSON` during mode detection — do not call `az repos pr thread list` again.
- **Early exit has no ADO writes**: the no-new-revisions path (Step 4) only prints to console and returns the result block — it never posts replies or PATCHes threads.
- **All four count fields are always present** in the result block, even when zero.
- **Matched findings are consumed**: a finding matched to any classified prior thread is excluded from `freshFindings`, regardless of whether a reply was posted.
- The completion marker is posted by the ADO Writer, not by this coordinator.
