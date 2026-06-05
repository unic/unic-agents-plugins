---
allowed-tools: Agent, Bash(node *), Write
argument-hint: '<confluence-url> [--post]'
description: Adversarial review of web specifications (Confluence). Read-only by default; --post enables the Approval Loop (inert in S1).
---

# /review-spec (S1 Skeleton)

Runs a read-only Gaps/Completeness review of one Confluence spec page, prints ranked Findings, and writes a durable timestamped report under `.spec-review/`.

> **S1 scope:** one source, one page, one agent. No traversal, no comments, no Figma, no live-system, no posting. `--post` is recognised but inert.

## Step 1 - Parse arguments

Split `$ARGUMENTS` on whitespace. Collect tokens that parse as valid `http://` or `https://` URLs into `URLS`. Set `IS_POST=true` when `--post` appears.

If `URLS` is empty, stop with:

```
Usage: /review-spec <confluence-page-url> [--post]
Example: /review-spec https://yoursite.atlassian.net/wiki/spaces/X/pages/123456/Title
```

Use `URLS[0]` as `TARGET_URL`.

## Step 2 - Classify the URL

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/link-classifier.mjs" "$TARGET_URL"
```

Parse the JSON output. If `kind` is not `"confluence"`, stop with:

```
S1 supports only Confluence page URLs.
Got kind: <kind> for <TARGET_URL>

S1 recognises: /wiki/spaces/SPACE/pages/ID/Title or ?pageId=ID
```

Store `PAGE_ID` from the output.

## Step 3 - Fetch the Confluence page

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atlassian-fetch.mjs" --urls "$TARGET_URL"
```

Parse the JSON from stdout. The fetch script writes its JSON to stdout **before** exiting non-zero, so a non-zero exit together with the `url === ''` auth-error sentinel is the expected credentials-missing signal - prefer the friendly "credentials not configured" message below over a raw command-failure report.

- If `errors` contains an entry where `kind === 'auth-error'` AND `url === ''`, stop with:
  ```
  Confluence credentials not configured.
  Run /unic-spec-review:setup-confluence to add them.
  ```
- Otherwise, if `errors` contains any entry whose `url === TARGET_URL` (or `url === ''`), stop and print that entry's `errors[0].kind` and `errors[0].message` verbatim, so the real cause (`parse-error` / `unreachable` / `not-found` / `auth-error`) is shown:
  ```
  Could not fetch the Confluence page.
  <errors[0].kind>: <errors[0].message>
  ```
- If `items` is empty (and no matching error was reported), stop and report that the page returned no content.

Extract from `items[0]`:

- `PAGE_TITLE` = `title`
- `PAGE_CONTENT` = `excerpt` (first 800 chars of the page body, HTML-stripped)

## Step 4 - Run the Gaps/Completeness agent

Use the Agent tool to spawn `unic-spec-review:gaps-agent`. Pass as its prompt input:

```json
{
  "pageTitle": "<PAGE_TITLE>",
  "pageUrl": "<TARGET_URL>",
  "pageContent": "<PAGE_CONTENT>"
}
```

Wait for the agent. Parse its JSON response to get the `findings` array. If the response is not valid JSON, print the raw output plus the parse error and stop.

## Step 5 - Print findings conversationally

Sort findings by `confidence` descending (highest first).

For each finding, present:

```
[severity] Finding: <title> (confidence: X%)
<description>
Anchor: <anchor text, if present>
```

If `findings` is empty:

```
No gaps or completeness issues found in this spec.
```

## Step 6 - Write the report

Construct the report input object:

```json
{
  "pageTitle": "<PAGE_TITLE>",
  "pageUrl": "<TARGET_URL>",
  "timestamp": "<current ISO timestamp>",
  "findings": [<findings array>]
}
```

Use the **Write tool** to write this JSON to `.spec-review/.report-input.json` (the `.spec-review/` directory is gitignored, so the scratch file stays out of git; writing via the tool avoids shell-quoting issues with apostrophes in page titles, and the path is portable across macOS, Windows, and Linux). Then run:

```bash
REPORT_OUTPUT_DIR=".spec-review" node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/report-renderer.mjs" .spec-review/.report-input.json
```

The script prints the path to the written file. Report it to the user:

```
Report written: .spec-review/spec-review-YYYY-MM-DDTHH-MM-SS.md
```

If `IS_POST` was true, note:

```
Note: --post is not yet active in S1. The report has been saved locally only.
```
