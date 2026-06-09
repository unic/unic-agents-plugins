---
allowed-tools: Agent, Bash(node *), Write
argument-hint: '<confluence-url> [--post]'
description: Adversarial review of web specifications (Confluence). Parallel eleven-agent fan-out, ranked hat-grouped triage. Read-only by default; --post activates the multi-Finding Approval Loop with similarity-based deduplication (inline-anchored comments or footer fallback).
---

# /review-spec (S8 Blue Orchestrator)

Runs a read-only adversarial review of one Confluence spec page using eleven parallel agents (eight Black-hat dimension agents plus Green, Yellow, Red perspective agents), ranks Findings by confidence \* severity, groups them by hat, prints a ranked hat-grouped triage, and writes a durable timestamped report under `.spec-review/`.

> **S8 scope:** Confluence page traversal (seed page plus its child pages and in-body `/wiki/` links, gated behind reviewer confirmation), eleven parallel agents, Landscape Brief injection, and a multi-Finding Approval Loop via `--post` with similarity-based deduplication (inline-anchored comments, footer fallback). No Figma, no live-system - those land in a later slice.

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

- If `errors` is non-empty (but not the global auth error above), warn `Warning: could not fully read existing comments (<kind>: <message>). Near-duplicate detection may be incomplete.` and continue with whatever comments were returned (`comments` may be empty).

Record `COMMENTS_TRUNCATED` from `truncated`. When true, append `(comment list may be incomplete - deduplication is best-effort)` to the summary line in 10c.

### 10b - Run dedup-matcher

Use the **Write tool** to write all ranked findings as a JSON array to `.spec-review/.all-findings.json` (include all fields per finding: `title`, `body`, `severity`, `confidence`, `dimension`, `hat`, `anchor`).

Use the **Write tool** to write `COMMENTS_RESULT` as JSON to `.spec-review/.existing-comments.json` (the full object: `{ comments: [...], truncated: ... }`).

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/dedup-matcher.mjs" \
  --findings-file ".spec-review/.all-findings.json" \
  --comments-file ".spec-review/.existing-comments.json"
```

Parse the JSON array from stdout as `DEDUP_RESULTS` - one `DedupResult` per finding, in the same ranked order. Each entry has `decision` (`'post'`, `'skip'`, or `'flag'`) and `nearDuplicates` (sorted by similarity descending).

If the command fails (non-zero exit or parse error), warn `Warning: dedup-matcher failed - posting without deduplication.` and treat every finding's decision as `'post'` (proceed without dedup rather than blocking the entire post flow).

### 10c - Present the annotated Findings list

Print:

```
Existing page comments checked for near-duplicates. <N> findings ready for review.
```

Present a numbered list of all findings in ranked order. For each:

```
0. Cancel (post nothing)
N. [<severity>] <title> (dimension: <dimension>, confidence: <X>%, anchor: <anchor or "none">)<dedup_badge>
```

Where `<dedup_badge>` is:

- ``(empty) - decision is`'post'`
- `  [~near-dup]` - decision is `'flag'` (borderline; tiebreak required)
- `  [~likely-dup]` - decision is `'skip'` (likely duplicate; override required)

Ask the user:

```
Select Finding numbers to post (comma-separated, e.g. 1,3), or 0 to cancel:
```

If the user enters `0` or an empty/blank response, print `Nothing posted.` and stop. No writes are performed.

### 10d - Process each selected Finding (selection is not commitment)

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

#### If decision is `'post'` (or an override was approved above):

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
