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

Before passing the diff to the agent, sanity-check its size — extremely large
diffs will silently truncate at the agent's context window:

```sh
git diff "origin/${BASE_BRANCH}...HEAD" --shortstat
```

- **Diff exceeds ~2000 lines or ~200 KB**: warn the user that the review may be
  incomplete and suggest tightening the base branch (e.g. `--base feature/x`).

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

Pass the raw JSON from Step 4 into the `render-summary` helper via the
`FINDINGS_JSON` environment variable. The helper validates each Finding,
buckets by severity per ADR-0002, and writes the rendered markdown to stdout:

```sh
FINDINGS_JSON='<raw JSON from the agent>' node "${CLAUDE_PLUGIN_ROOT}/scripts/render-summary.mjs"
```

The helper is the single source of truth for the rendering pipeline — it
imports `parseFinding` from `scripts/lib/finding-validator.mjs` and
`renderReviewSummary` from `scripts/lib/review-summary-renderer.mjs`, so the
ADR-0006 Bot Signature invariant is preserved automatically.

## Step 6 — Print the preview

Print the rendered Review Summary markdown to the terminal.

Remind the user:

- This is a terminal preview only — nothing has been written to ADO.
- `--post` mode (interactive Approval Loop) is coming in a later release.
