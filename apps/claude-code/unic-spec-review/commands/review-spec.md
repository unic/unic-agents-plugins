---
allowed-tools: Agent, Bash(node *), Write
argument-hint: '<confluence-url> [--post]'
description: Adversarial review of web specifications (Confluence). Parallel eleven-agent fan-out, ranked hat-grouped triage. Read-only by default; --post enables the Approval Loop (inert in S4).
---

# /review-spec (S4 Blue Orchestrator)

Runs a read-only adversarial review of one Confluence spec page using eleven parallel agents (eight Black-hat dimension agents plus Green, Yellow, Red perspective agents), ranks Findings by confidence \* severity, groups them by hat, prints a ranked hat-grouped triage, and writes a durable timestamped report under `.spec-review/`.

> **S4 scope:** single Confluence page, eleven parallel agents, Landscape Brief injection into Testability/Feasibility/Spec-versus-Live/NFR. No Figma, no live-system, no posting. `--post` is recognised but inert.

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
S4 supports only Confluence page URLs.
Got kind: <kind> for <TARGET_URL>
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
- Otherwise, if `errors` contains any entry whose `url === TARGET_URL` (or `url === ''`), stop and print that entry's `kind` and `message` verbatim:
  ```
  Could not fetch the Confluence page.
  <errors[0].kind>: <errors[0].message>
  ```
- If `items` is empty (and no matching error was reported), stop and report that the page returned no content.

Extract from `items[0]`:

- `PAGE_TITLE` = `title`
- `PAGE_CONTENT` = `excerpt` (first 800 chars of the page body, HTML-stripped)

## Step 4 - Detect technology landscape

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/landscape-detector.mjs" "."
```

Parse the JSON output into `LANDSCAPE_BRIEF`. If the command fails or returns invalid JSON, set `LANDSCAPE_BRIEF = null` and continue - landscape injection is optional.

## Step 5 - Fan out all eleven agents in parallel

Use the Agent tool to spawn all eleven agents **simultaneously** (in the same turn, as parallel tool calls). Do not wait for one before spawning the next.

**Agents that receive only page context** (no landscape):

- `unic-spec-review:gaps-agent`
- `unic-spec-review:ambiguity-agent`
- `unic-spec-review:spec-versus-design-agent`
- `unic-spec-review:internal-consistency-agent`
- `unic-spec-review:green-agent`
- `unic-spec-review:yellow-agent`
- `unic-spec-review:red-agent`

Pass as prompt:

```json
{
  "pageTitle": "<PAGE_TITLE>",
  "pageUrl": "<TARGET_URL>",
  "pageContent": "<PAGE_CONTENT>"
}
```

**Agents that also receive the Landscape Brief** (inject when `LANDSCAPE_BRIEF` is not null):

- `unic-spec-review:spec-versus-live-agent`
- `unic-spec-review:testability-agent`
- `unic-spec-review:feasibility-agent`
- `unic-spec-review:non-functional-agent`

Pass as prompt:

```json
{
  "pageTitle": "<PAGE_TITLE>",
  "pageUrl": "<TARGET_URL>",
  "pageContent": "<PAGE_CONTENT>",
  "landscapeBrief": <LANDSCAPE_BRIEF or null>
}
```

Wait for all eleven agents to complete.

## Step 6 - Collect and normalise findings

For each agent response, parse the JSON and extract the `findings` array. If a response is not valid JSON or contains no `findings`, skip it with a warning and continue with the rest.

For each finding, add `hat` and `dimension` if not already present in the response, using the agent that produced it. Map per ADR-0003:

- gaps-agent -> hat: 'black', dimension: 'gaps'
- ambiguity-agent -> hat: 'black', dimension: 'ambiguity'
- spec-versus-design-agent -> hat: 'black', dimension: 'spec-versus-design'
- spec-versus-live-agent -> hat: 'black', dimension: 'spec-versus-live'
- internal-consistency-agent -> hat: 'black', dimension: 'internal-consistency'
- testability-agent -> hat: 'black', dimension: 'testability'
- feasibility-agent -> hat: 'black', dimension: 'feasibility'
- non-functional-agent -> hat: 'black', dimension: 'non-functional'
- green-agent -> hat: 'green', dimension: 'green'
- yellow-agent -> hat: 'yellow', dimension: 'yellow'
- red-agent -> hat: 'red', dimension: 'red'

Also map the legacy `description` field to `body` if `body` is absent (gaps-agent backward compat).

## Step 7 - Rank and group findings

**Rank** all collected findings by `confidence * severity_weight` descending:

- critical = weight 3
- important = weight 2
- minor = weight 1

**Group** by hat in this display order: black, green, yellow, red.

## Step 8 - Print findings conversationally (hat-grouped)

Print a header: `Found <N> findings across <K> agents.`

For each hat group (in order: black, green, yellow, red), print:

```
--- <Hat Label> ---
[<severity>] <title> (confidence: <X>%, dimension: <dimension>)
<body>
Anchor: <anchor text, if present>
```

Hat labels: Black = "Critical Analysis", Green = "Alternatives", Yellow = "Value & Justification", Red = "User Reaction".

If a hat group has no findings, skip it.

If all findings are empty:

```
No issues found in this spec.
```

## Step 9 - Write the report

Construct the report input object (include `hat` and `dimension` fields on each finding):

```json
{
  "pageTitle": "<PAGE_TITLE>",
  "pageUrl": "<TARGET_URL>",
  "timestamp": "<current ISO timestamp>",
  "findings": [<all ranked findings, hat and dimension fields included>]
}
```

Use the **Write tool** to write this JSON to `.spec-review/.report-input.json` (the `.spec-review/` directory is gitignored, so the scratch file stays out of git; writing via the tool avoids shell-quoting issues with apostrophes in page titles, and the path is portable across macOS, Windows, and Linux). Then run:

```bash
REPORT_OUTPUT_DIR=".spec-review" node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/report-renderer.mjs" .spec-review/.report-input.json
```

The script prints the path of the written file. Report it:

```
Report written: .spec-review/spec-review-YYYY-MM-DD-HH-MM-SS.md
```

## Step 10 - Post a Finding (only when --post is active)

Skip this step entirely if `IS_POST` is false. This keeps bare `/review-spec` strictly read-only.

Present a numbered list of all findings in ranked order (same order as Step 8). For each:

```
N. [<severity>] <title> (dimension: <dimension>, confidence: <X>%, anchor: <anchor or "none">)
```

Ask the user:

```
Which Finding would you like to post as a Confluence comment? Enter a number, or 0 to post nothing.
```

If the user enters 0 or declines, print "Nothing posted." and stop. No writes are performed.

For the selected Finding:

1. Write the Finding object as JSON to `.spec-review/.post-finding.json` using the Write tool. Include all fields: `title`, `body`, `severity`, `confidence`, `dimension`, `hat`, `anchor`.

2. Run the confluence-writer:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/confluence-writer.mjs" \
     --page-url "$TARGET_URL" \
     --finding-file ".spec-review/.post-finding.json"
   ```

3. Parse the JSON from stdout. On success, report:

   ```
   Posted comment <id> to <TARGET_URL>
   Comment type: <type> (<reason if footer-fallback>)
   ```

On error (non-zero exit or error JSON on stderr), report the error message and stop without retrying.

