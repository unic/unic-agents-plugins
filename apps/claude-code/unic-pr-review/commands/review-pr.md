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

## Step 3.5 — Gather optional intent URLs

Prompt the user with this exact message:

```
Optional Work Item URLs (Jira/ADO Boards) and Confluence URLs, comma-separated. Press Enter to skip.
```

- **User presses Enter (empty response)** → set `PASTED_URLS` to the empty string. No
  intent gathering happens. Leave `intentBrief` and `intentCheck` undefined and skip to
  Step 4 (US 30: empty intent is legitimate).
- **User pastes one or more URLs** → store the full comma-separated string as `PASTED_URLS`
  and continue to Step 3.6.

## Step 3.6 — Spawn the Intent Checker agent (only when `PASTED_URLS` is non-empty)

Use the Task tool to launch the `intent-checker` agent. Provide it this input:

```json
{ "pastedUrls": [<PASTED_URLS split on comma, each entry trimmed>] }
```

Wait for the agent to complete. It emits exactly one of:

- **A — hard-stop** (ADR-0004, US 29):

  ```json
  { "hardStop": true, "url": "<url>", "setupCommand": "<cmd>" }
  ```

  Print verbatim and **stop** — do not spawn the code-reviewer and do not print a partial
  summary:

  ```
  Intent gathering failed: <url> is unreachable. Run <setupCommand> to configure credentials, then re-run the review.
  ```

- **B — intent gathered**:

  ```json
  { "intentBrief": "<markdown>", "intentCheck": [ ... ] }
  ```

  Store `intentBrief` (a markdown string) and `intentCheck` (an array). If `intentBrief`
  is an empty string and `intentCheck` is an empty array, treat intent as absent (leave
  both undefined). Continue to Step 4.

## Step 4 — Spawn the code-reviewer agent

Use the Task tool to launch the `code-reviewer` agent.

- **When `intentBrief` is defined** (intent was gathered in Step 3.6), append it verbatim
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

Wait for the agent to complete. The agent emits a JSON object:

```json
{ "findings": [...], "positiveObservations": [...] }
```

Store the raw JSON verbatim — do not parse or reformat it. The next step's
helper consumes the raw string and validates each Finding through
`parseFinding`. If the agent emits anything other than a JSON object,
`render-summary` will exit non-zero with a diagnostic in stderr; follow the
Step 5 contract below for how to handle that.

## Step 5 — Render the Review Summary

Pass the raw JSON from Step 4 into the `render-summary` helper via the
`FINDINGS_JSON` environment variable. The helper validates each Finding,
buckets by severity per ADR-0002, and writes the rendered markdown to stdout.

- **When `intentCheck` is defined** (a non-empty array from Step 3.6), also pass it via
  `INTENT_CHECK_JSON` so the helper renders the Intent Check block above the Severity
  sections (PRD §10):

  ```sh
  FINDINGS_JSON='<raw JSON from the agent>' INTENT_CHECK_JSON='<JSON.stringify(intentCheck)>' node "${CLAUDE_PLUGIN_ROOT}/scripts/render-summary.mjs"
  ```

- **When `intentCheck` is undefined or empty**, omit `INTENT_CHECK_JSON` entirely (the
  Intent Check block is then omitted, US 30):

  ```sh
  FINDINGS_JSON='<raw JSON from the agent>' node "${CLAUDE_PLUGIN_ROOT}/scripts/render-summary.mjs"
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

## Step 6 — Print the preview

Print the rendered Review Summary markdown to the terminal.

Remind the user:

- This is a terminal preview only — nothing has been written to ADO.
- `--post` mode (interactive Approval Loop) is coming in a later release.
