---
allowed-tools: Agent, Bash(node *), Write, mcp__figma*, mcp__playwright*
argument-hint: '<confluence-url> [figma-url ...] [live-url ...] [--post]'
description: Adversarial review of web specifications. Classify pasted Confluence, Figma, and live URLs; gather designs via Figma Dev Mode MCP and live observations via Playwright MCP; parallel eleven-agent fan-out, ranked hat-grouped triage. Read-only by default; --post activates the Approval Loop.
---

# /review-spec (Blue Orchestrator)

Runs a read-only adversarial review of one Confluence spec page using eleven parallel agents (eight Black-hat dimension agents plus Green, Yellow, Red perspective agents), ranks Findings by confidence \* severity, groups them by hat, prints a ranked hat-grouped triage, and writes a durable timestamped report under `.spec-review/`.

> **Scope:** Confluence page traversal (seed page plus child pages and in-body `/wiki/` links, gated behind reviewer confirmation), eleven parallel agents (including Spec-versus-Design via Figma Dev Mode MCP and Spec-versus-Live via Playwright MCP), Landscape Brief injection, and a multi-Finding Approval Loop via `--post` with similarity-based deduplication. Figma and live system are read-only sources; nothing is posted to either. If the Figma or Playwright MCP is absent when a pasted link demands it, the run fails loudly.

## Step 1 - Parse arguments

Split `$ARGUMENTS` on whitespace. Collect tokens that parse as valid `http://` or `https://` URLs into `URLS`. Set `IS_POST=true` when `--post` appears.

If `URLS` is empty, stop with:

```
Usage: /review-spec <confluence-url> [figma-url ...] [live-url ...] [--post]
Example: /review-spec https://yoursite.atlassian.net/wiki/spaces/X/pages/123456/Title https://www.figma.com/design/abc/Flow https://prod.example.com
```

## Step 1.5 - Classify all pasted URLs

Run the link-classifier once per URL in `URLS`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/link-classifier.mjs" "$URL"
```

Run them in a loop (one fast synchronous Bash call per URL; do not spawn agents for classification), collect all results, then group by `kind`:

- `CONFLUENCE_URLS` = URLs whose `kind` is `'confluence'`
- `FIGMA_URLS` = URLs whose `kind` is `'figma-page'` or `'figma-frame'` (keep the `kind` so Step 3.5 picks the right tool)
- `LIVE_URLS` = URLs whose `kind` is `'live'`

URLs with `kind` `'unknown'` are ignored (warn once, listing them, but do not abort).

If `CONFLUENCE_URLS` is empty, stop with:

```
No Confluence page URL found in the pasted links.
Usage: /review-spec <confluence-url> [figma-url ...] [live-url ...] [--post]
At least one Confluence page URL is required as the spec source.
```

Set `TARGET_URL = CONFLUENCE_URLS[0]` and extract `PAGE_ID` from that URL's classified result.

## Step 1.6 - MCP availability checks (fail loud)

Check MCP availability by inspecting the active tool set in this Claude Code session. These checks fail loud: a pasted link of a kind whose MCP is absent stops the run with remediation guidance. The source is never silently skipped or degraded.

**Figma check** - only when `FIGMA_URLS` is non-empty:

Determine whether a Figma Dev Mode MCP tool is available by checking the active tool set for tools whose names match `mcp__figma*` or are otherwise clearly from a Figma Dev Mode MCP server.

If the Figma Dev Mode MCP is NOT available, stop with:

```
Figma Dev Mode MCP not connected.
Figma links were provided but the Figma Dev Mode MCP is not available in this session.
Run /unic-spec-review:spec-doctor to check all prerequisites.
Remediation: Enable the Figma Dev Mode MCP in your Claude Code MCP settings.
See https://help.figma.com/hc/en-us/articles/32132100888087 for setup instructions.
```

**Playwright check** - only when `LIVE_URLS` is non-empty:

Determine whether a Playwright MCP tool is available by checking the active tool set for tools whose names match `mcp__playwright*` or are otherwise clearly from a Playwright MCP server.

If the Playwright MCP is NOT available, stop with:

```
Playwright MCP not connected.
Live URLs were provided but the Playwright MCP is not available in this session.
Run /unic-spec-review:spec-doctor to check all prerequisites.
Remediation: Enable the Playwright MCP in your Claude Code MCP settings.
Example config: https://github.com/microsoft/playwright-mcp
```

## Step 2 - Set the primary Confluence target

`TARGET_URL` and `PAGE_ID` were set in Step 1.5 from the first Confluence URL. No additional classification is needed here.

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
- `SEED_ITEM` = `items[0]` (keep the whole item; you need its `id` and `linkedUrls` for traversal)

## Step 3b - Discover and confirm the page set

The pasted page is only the seed. A spec is usually a parent page with child pages plus cross-linked pages, so discover them and let the reviewer decide what to fetch. **No bulk fetch happens before the reviewer confirms.** The whole step is read-only.

1. **Fetch the seed's child pages** (GET-only):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/atlassian-fetch.mjs" --child-pages "$TARGET_URL"
   ```

   Parse the JSON: `{ childPages: [{ id, title, url }], truncated, errors }`. If `errors` is non-empty, warn with the first entry's `kind` and `message` but continue with whatever children were returned. Record `truncated` as `CHILDREN_TRUNCATED`; when `true`, warn `Child page list may be incomplete (hit API limit).` and carry the flag into the confirmation prompt (sub-step 4) so the reviewer knows the discovered total is a lower bound.

2. **Build the planner input.** Use the **Write tool** to write `.spec-review/.traversal-input.json`:

   ```json
   {
     "seeds": ["<SEED_ITEM.id>"],
     "pageMeta": [
       {
         "id": "<SEED_ITEM.id>",
         "url": "<SEED_ITEM.url>",
         "title": "<PAGE_TITLE>",
         "linkedUrls": <SEED_ITEM.linkedUrls>,
         "childPages": <childPages from step 1>
       }
     ]
   }
   ```

3. **Run the traversal planner** (pure, no I/O):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/traversal-planner.mjs" --plan-file ".spec-review/.traversal-input.json"
   ```

   Parse the JSON `TraversalPlan`: `{ pages: [{ pageId, url, title, source }], needsConfirmation, total }`. Pages are ordered seeds first, then `child`, then `linked`, deduplicated by `pageId`. If the planner exits non-zero or prints no JSON, warn `Traversal planning failed; reviewing the seed page alone.` and fall back to `CONFIRMED_PAGES = [the seed]`, then continue at sub-step 6 (do not abort the review).

4. **Decide whether to confirm.** If `needsConfirmation` is `false` (only the seed, no expansion), set `CONFIRMED_PAGES = plan.pages` and continue at sub-step 6 to assemble the seed-only `PAGE_CONTENT` (skip the confirmation prompt and the non-seed fetch in sub-step 5).

   If `needsConfirmation` is `true`, print the discovered set grouped by source and ask the reviewer. When `CHILDREN_TRUNCATED` is `true`, render the total as `<total>+` and add the line `(child page list incomplete - hit API limit; more pages may exist)`:

   ```
   Discovered <total> pages for this spec:
   Seeds (already fetched):
     1. <title> - <url>
   Child pages:
     2. <title> - <url>
   Linked pages:
     N. <title> - <url>

   Fetch all <total> pages for review? [Y]es / [n]o / enter numbers to exclude (e.g. 2,5):
   ```

   - Empty input or `Y`/`y`: confirm the full set.
   - `n`/`N`/`0`: print `Review cancelled.` and stop. Nothing is fetched.
   - Comma-separated numbers: remove those entries (seeds cannot be removed; ignore a number that points at a seed). Then print the trimmed set and `Confirmed: <M> pages. Proceeding to fetch and review.`

   Set `CONFIRMED_PAGES` to the confirmed list.

5. **Fetch the confirmed non-seed pages.** Collect the `url` of every `CONFIRMED_PAGES` entry whose `source` is not `seed` into a comma-separated list and fetch them:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/atlassian-fetch.mjs" --urls "<comma-separated confirmed non-seed urls>"
   ```

   Parse the `items` array. If any page errors, warn with its `kind`/`message` but do not abort the whole review - review the pages that did fetch. After fetching, print an aggregate summary line `Fetched <M> of <N> confirmed non-seed pages (<K> failed).` so a partial fetch is never silent. If every non-seed page failed (`M === 0`), warn `All additional pages failed to fetch; reviewing the seed page alone.` before continuing - so a wholesale failure does not masquerade as a complete multi-page review.

6. **Assemble the multi-page content.** Build `PAGE_CONTENT` by concatenating the seed item plus every successfully fetched page, each block prefixed with a header line so agents can attribute findings to a page:

   ```
   --- <title> (<url>) ---
   <excerpt>
   ```

   Join blocks with a blank line. When only the seed is in `CONFIRMED_PAGES`, `PAGE_CONTENT` is just the seed's `excerpt` with its header line.

## Step 3.5 - Gather Figma context (only when FIGMA_URLS is non-empty)

Skip this step if `FIGMA_URLS` is empty: set `FIGMA_CONTEXT = null` and continue. Figma is a read-only source; only read tools are used and nothing is written back to Figma.

For each URL in `FIGMA_URLS`, use the available Figma Dev Mode MCP tools to read the design:

- `figma-frame` URLs (a `node-id` is present): use the frame-level tool to read the specific frame and its annotations.
- `figma-page` URLs: use the file/page-level tool to read the page with its frames and annotations.

Collect the raw MCP results into a JSON array of `{ "url": "<url>", "data": <raw-mcp-result> }`. Use the **Write tool** to write this array to `.spec-review/.figma-data.json` (exactly one `JSON.stringify` level; do not double-stringify the raw `data`).

Then format it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/figma-gatherer.mjs" --input ".spec-review/.figma-data.json"
```

Store stdout as `FIGMA_CONTEXT`. If the script exits non-zero or produces no output, print `Warning: figma-gatherer failed; Spec-versus-Design will run without Figma context.` and set `FIGMA_CONTEXT = null`. Do not abort the review.

## Step 3.6 - Gather live context (only when LIVE_URLS is non-empty)

Skip this step if `LIVE_URLS` is empty: set `LIVE_CONTEXT = null` and continue. The live system is a read-only source; only navigation and read tools are used and nothing is submitted to it.

For each URL in `LIVE_URLS`, use the available Playwright MCP tools to:

1. Navigate to the URL.
2. Collect the page title and the visible text content of the page.

Collect results into a JSON array of `{ "url": "<url>", "title": "<title or null>", "content": "<text or null>" }`. Use the **Write tool** to write this array to `.spec-review/.live-data.json`.

Then format it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/live-gatherer.mjs" --input ".spec-review/.live-data.json"
```

Store stdout as `LIVE_CONTEXT`. If the script exits non-zero or produces no output, print `Warning: live-gatherer failed; Spec-versus-Live will run without live context.` and set `LIVE_CONTEXT = null`. Do not abort the review.

## Step 4 - Detect technology landscape

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/landscape-detector.mjs" "."
```

Parse the JSON output into `LANDSCAPE_BRIEF`. If the command fails or returns invalid JSON, set `LANDSCAPE_BRIEF = null` and continue - landscape injection is optional.

## Step 5 - Fan out all eleven agents in parallel

Use the Agent tool to spawn all eleven agents **simultaneously** (in the same turn, as parallel tool calls). Do not wait for one before spawning the next.

**Agents that receive only page context** (no landscape, no extra source):

- `unic-spec-review:gaps-agent`
- `unic-spec-review:ambiguity-agent`
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

**Spec-versus-Design** receives the Figma context (`FIGMA_CONTEXT`, which is `null` when no Figma links were provided):

- `unic-spec-review:spec-versus-design-agent`

```json
{
  "pageTitle": "<PAGE_TITLE>",
  "pageUrl": "<TARGET_URL>",
  "pageContent": "<PAGE_CONTENT>",
  "figmaContext": "<FIGMA_CONTEXT or null>"
}
```

**Agents that also receive the Landscape Brief** (inject when `LANDSCAPE_BRIEF` is not null):

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

**Spec-versus-Live** receives both the Landscape Brief and the live context (`LIVE_CONTEXT`, which is `null` when no live URLs were provided):

- `unic-spec-review:spec-versus-live-agent`

```json
{
  "pageTitle": "<PAGE_TITLE>",
  "pageUrl": "<TARGET_URL>",
  "pageContent": "<PAGE_CONTENT>",
  "landscapeBrief": <LANDSCAPE_BRIEF or null>,
  "liveContext": "<LIVE_CONTEXT or null>"
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

## Step 10 - Approval Loop (only when --post is active)

Skip this step entirely if `IS_POST` is false. This keeps bare `/review-spec` strictly read-only.

If there are no findings, print `No findings to post.` and stop.

### 10a - Fetch existing comments for deduplication

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atlassian-fetch.mjs" --comments "$TARGET_URL"
```

Parse the JSON output. Store it as `COMMENTS_RESULT`.

- If `errors` contains an entry where `kind === 'auth-error'` AND `url === ''`, stop with:

  ```
  Confluence credentials not configured - cannot de-duplicate safely.
  Run /unic-spec-review:setup-confluence to add them.
  ```

- If `errors` is non-empty (but not the global auth error above), warn `Warning: could not fully read existing comments (<kind>: <message>).` and continue with whatever comments were returned (`comments` may be empty). (The incompleteness signal now drives `COMPARISON_INCOMPLETE` and is surfaced structurally in 10c/10d, not just as advisory prose.)

Record `COMMENTS_TRUNCATED` from `truncated`.

Compute `COMPARISON_INCOMPLETE`:

```
COMPARISON_INCOMPLETE = COMMENTS_TRUNCATED OR (errors non-empty after the auth-stop check above)
```

Both truncation and partial read errors mean the same thing to the reviewer: the comparison ran against a partial comment set. The specific cause will be named in the preamble printed in Step 10c.

### 10b - Run dedup-matcher

Use the **Write tool** to write all ranked findings as a JSON array to `.spec-review/.all-findings.json` (include all fields per finding: `title`, `body`, `severity`, `confidence`, `dimension`, `hat`, `anchor`).

Use the **Write tool** to write `COMMENTS_RESULT` as JSON to `.spec-review/.existing-comments.json` (the full object: `{ comments: [...], truncated: ... }`).

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/dedup-matcher.mjs" \
  --findings-file ".spec-review/.all-findings.json" \
  --comments-file ".spec-review/.existing-comments.json"
```

Parse the JSON object from stdout. Set `DEDUP_RESULTS = parsed.results` - one `DedupResult` per finding, in the same ranked order. Each entry has `decision` (`'post'`, `'skip'`, or `'flag'`) and `nearDuplicates` (sorted by similarity descending). The envelope also carries `truncated`, but `COMPARISON_INCOMPLETE` was already computed in Step 10a from the comments fetch result - do not re-read it from the envelope here.

If the command fails (non-zero exit, parse error, or `parsed.results` is not an array), warn `Warning: dedup-matcher failed - posting without deduplication.` and treat every finding's decision as `'post'` (proceed without dedup rather than blocking the entire post flow). The `COMPARISON_INCOMPLETE` flag computed in 10a remains in effect even on failure.

### 10c - Present the annotated Findings list

Print:

```
Existing page comments checked for near-duplicates. <N> findings ready for review.
```

When `COMPARISON_INCOMPLETE` is true, print a warning block before the numbered list:

```
⚠ Comparison incomplete - the existing comment set was [truncated (pagination cap hit) | partially unreadable (<kind>: <message>)].
  Clean posts are marked [?incomplete]: the comparison could not rule out duplicates beyond what was loaded.
```

Use "truncated (pagination cap hit)" when `COMMENTS_TRUNCATED`, otherwise "partially unreadable (<kind>: <message>)" with the first non-auth error's details.

Present a numbered list of all findings in ranked order. For each:

```
0. Cancel (post nothing)
N. [<severity>] <title> (dimension: <dimension>, confidence: <X>%, anchor: <anchor or "none">)<dedup_badge>
```

Where `<dedup_badge>` is:

- ``(empty) - decision is `'post'`AND`COMPARISON_INCOMPLETE` is false (complete run, no duplicate found)
- `  [?incomplete]` - decision is `'post'` AND `COMPARISON_INCOMPLETE` is true (comparison was partial; no duplicate found in what was checked)
- `  [~near-dup]` - decision is `'flag'` (borderline; tiebreak required)
- `  [~likely-dup]` - decision is `'skip'` (likely duplicate; override required)

Ask the user:

```
Select Finding numbers to post (comma-separated, e.g. 1,3), or 0 to cancel:
```

If the user enters `0` or an empty/blank response, print `Nothing posted.` and stop. No writes are performed.

### 10d - Process each selected Finding (selection is not commitment)

**Run-level confirmation (incomplete runs only):** Before processing any selected Finding, when `COMPARISON_INCOMPLETE` is true AND the user selected at least one Finding whose `decision` is `'post'`, ask:

```
Comparison incomplete - post the selected [?incomplete] Findings anyway? [y/N]:
```

- If the user answers `y` or `Y`: proceed normally. All selected clean-post Findings will be written.
- If the user answers anything else: set `SKIP_CLEAN_POSTS = true`. Clean-post Findings will be skipped during processing below; `skip` and `flag` Findings keep their existing per-Finding gates and are unaffected.

This confirmation is asked **once** (run-level), not once per Finding. The reviewer already exercised per-Finding judgement at selection.

For each selected number, in ranked order, look up its `DedupResult`:

#### If decision is `'skip'`:

Print the top near-duplicate's excerpt and score:

```
[~likely-dup] <title>
Closest existing comment (similarity: <XX>%):
  "<first 120 chars of matching comment body>…"

Override and post anyway? [y/N]:
```

If the user answers anything other than `y` or `Y`, print `Skipped (likely duplicate).` and move to the next selected Finding.

#### If decision is `'flag'`:

Print the top near-duplicate's excerpt and score:

```
[~near-dup] <title>
Near-duplicate found (similarity: <XX>%):
  "<first 120 chars of matching comment body>…"

Post anyway? [y/N]:
```

If the user answers anything other than `y` or `Y`, print `Skipped.` and move to the next selected Finding.

#### If an override was approved above (skip or flag, user said y):

Post the Finding using steps 1–3 below. The run-level `SKIP_CLEAN_POSTS` flag does not apply — the reviewer explicitly consented to post despite the near-duplicate.

#### If decision is `'post'` (clean post, no duplicate found):

When `SKIP_CLEAN_POSTS` is true (run-level confirm was declined), print `Skipped (incomplete comparison).` and move to the next selected Finding.

Otherwise:

1. Write the Finding object as JSON to `.spec-review/.post-finding.json` using the Write tool. Include all fields: `title`, `body`, `severity`, `confidence`, `dimension`, `hat`, `anchor`.

2. Run the confluence-writer:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/confluence-writer.mjs" --page-url "$TARGET_URL" --finding-file ".spec-review/.post-finding.json"
   ```

3. Parse the JSON from stdout. On success, report (always state the anchoring outcome so a degrade from inline to a page-level footer is never silent):

   ```
   Posted comment <id> to <TARGET_URL>
   Anchoring: inline-anchored   (when type is "inline")
   Anchoring: footer fallback (<reason>)   (when type is "footer")
   ```

   On error (non-zero exit or error JSON on stderr), report the error message and continue to the next selected Finding without retrying.

### 10e - Final summary

After processing all selected Findings:

```
Done. Posted <X> of <Y> selected Findings.
```

Where `Y` is the count of numbers the user selected and `X` is those actually posted (not skipped at a tiebreak and not failed at write). If the "Nothing posted." exit in 10c was taken, this line is not printed.
