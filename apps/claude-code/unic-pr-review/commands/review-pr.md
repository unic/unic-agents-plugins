---
allowed-tools: Agent, Bash(node *), Bash(git *)
argument-hint: [<PR URL>]
description: Review a pull request or your local branch. Pass an ADO PR URL to review an open PR (coming soon); omit the URL to review your local branch against its upstream base (Pre-PR mode).
---

# unic-pr-review:review-pr

Runs an AI-powered code review. Without a URL the Plugin operates in **Pre-PR mode** — it computes the diff of your local branch against the resolved upstream base branch, fans out to the `code-reviewer` aspect agent, and prints the Review Summary in the terminal. Nothing is written to ADO.

## Step 1 — Detect mode

Inspect the first argument passed to the command.

- **URL given** → print the following message and stop:

  ```
  ADO mode is not yet supported in this release.
  Run `/unic-pr-review:review-pr` without a URL to use Pre-PR mode.
  ```

- **No argument** → continue to Step 2 (Pre-PR mode).

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

## Step 4 — Spawn the code-reviewer agent

Use the Task tool to launch the `code-reviewer` agent. Provide it the following input:

```
Diff to review:

<full unified diff from Step 3>
```

Wait for the agent to complete. The agent emits a JSON object:

```json
{ "findings": [...], "positiveObservations": [...] }
```

## Step 5 — Render the Review Summary

Parse the JSON from the code-reviewer agent. For each Finding, apply the severity bucket:

- confidence ≥ 90 → critical
- confidence ≥ 80 → important
- confidence ≥ 60 → minor
- confidence < 60 → drop (do not include in the summary)

Then call the review-summary-renderer. Run the following Node snippet (inline or as a helper script) to produce the rendered markdown:

```sh
node --input-type=module -e "
import { bucketBySeverity } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/severity-bucketer.mjs'
import { renderReviewSummary } from '${CLAUDE_PLUGIN_ROOT}/scripts/lib/review-summary-renderer.mjs'

const raw = JSON.parse(process.env.FINDINGS_JSON)
const buckets = { criticalFindings: [], importantFindings: [], minorFindings: [] }
for (const f of raw.findings) {
  const sev = bucketBySeverity(f.confidence)
  if (sev === 'critical') buckets.criticalFindings.push(f)
  else if (sev === 'important') buckets.importantFindings.push(f)
  else if (sev === 'minor') buckets.minorFindings.push(f)
}
const summary = renderReviewSummary({
  ...buckets,
  positiveObservations: raw.positiveObservations ?? [],
  iteration: 1,
})
process.stdout.write(summary)
"
```

Alternatively, compose the renderer call directly in your response by reading the findings JSON and constructing the context object — the key invariant is that you call `renderReviewSummary` from `scripts/lib/review-summary-renderer.mjs` and `bucketBySeverity` from `scripts/lib/severity-bucketer.mjs`.

## Step 6 — Print the preview

Print the rendered Review Summary markdown to the terminal.

Remind the user:

- This is a terminal preview only — nothing has been written to ADO.
- `--post` mode (interactive Approval Loop) is coming in a later release.
