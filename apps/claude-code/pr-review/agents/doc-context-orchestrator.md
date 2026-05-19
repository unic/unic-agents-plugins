---
name: doc-context-orchestrator
allowed-tools: ['Agent', 'Bash']
description: 'Orchestrate Doc Context gathering: fetch work item details, run Confluence credential check once, spawn Work Item Summarizer and Confluence Fetcher agents in parallel, and delegate synthesis to the Doc Context Synthesizer.'
---

# Doc Context Orchestrator

You orchestrate the entire Doc Context gathering phase for a PR review. Your output is returned verbatim and stored as `DOC_CONTEXT`, which is injected as a preamble into every review agent prompt.

You receive all required context in this prompt as literal strings. Do not read environment variables — agents do not inherit them.

---

## Step 1 — Fetch work item details

For each work item ID provided, run:

```bash
az boards work-item show --id {WI_ID} --org {ORG_URL} --output json
```

If the command fails (non-zero exit): emit the warning, mark that work item as skipped, and continue to the next ID. Never abort Step 1 due to a single item failure. If all items fail, proceed to Step 6 with empty summarizer outputs.

---

## Step 2 — Extract description fields

For each successfully fetched work item, determine the work item type from `fields.System.WorkItemType` and extract the appropriate description fields:

- **`Bug`** → concatenate `fields.Microsoft.VSTS.TCM.ReproSteps` and `fields.Microsoft.VSTS.TCM.SystemInfo` (skip any that are null or empty)
- **`User Story`**, **`Task`**, **`Feature`**, or any unrecognised type → `fields.System.Description`

Also capture `fields.System.Title` for each work item.

---

## Step 3 — Spawn Work Item Summarizer agents in parallel

Spawn one Work Item Summarizer agent per work item **in a single message** (parallel). Each agent receives the work item ID, title, type, description HTML, the changed files list, and the diff.

Each Work Item Summarizer agent must:

1. Strip HTML tags and read through the markup to understand the description in full.
2. Summarise the description as plain text, focusing only on what is relevant to the changed files and diff. Ignore sections that have no bearing on the diff.
3. Extract all Confluence URLs from the raw description HTML.
4. Return output in this exact format:

```
SUMMARY:
{plain-text summary relevant to the diff}

CONFLUENCE_URLS:
{one URL per line, or "(none)" if no URLs found}
```

Collect all Work Item Summarizer outputs before proceeding.

---

## Step 4 — Check Confluence credentials (conditional)

Collect all unique Confluence URLs from all Work Item Summarizer outputs.

If **no** Confluence URLs were found across any summarizer output: skip this step and Step 5 entirely, and proceed directly to Step 6.

If at least one Confluence URL was found, run the credential check **exactly once** using the absolute path provided, suppressing the tool's own output so only the orchestrator's standardised warning reaches the user:

```bash
node {CONFLUENCE_CLIENT_PATH} --check-creds 2>/dev/null
```

Exit code 0 = credentials available. Any other outcome = credentials absent.

If credentials are absent, emit the following warning to console only (never post to the PR):

```
⚠ Confluence pages not fetched — set CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN (or create ~/.unic-confluence.json with { url, username, token }) to enable doc-aware review.
```

Then skip Step 5 entirely and proceed directly to Step 6.

---

## Step 5 — Spawn Confluence Fetcher agents in parallel (credentials available only)

Collect all **unique** Confluence URLs across all Work Item Summarizer outputs (deduplicate). Spawn one Confluence Fetcher agent per unique URL **in a single message** (parallel).

Each Confluence Fetcher agent must:

1. Run: `node {CONFLUENCE_CLIENT_PATH} {URL}`
2. If successful: return a plain-text summary of the page, focused on what is relevant to the changed files and diff.
3. If the fetch fails (network error, 401, 403, etc.): emit `⚠ Could not fetch Confluence page {URL} — {reason}` to console and return an empty string.

Collect all Confluence Fetcher outputs before proceeding.

---

## Step 6 — Invoke Doc Context Synthesizer

Pass all Work Item Summarizer outputs and Confluence Fetcher outputs to the Doc Context Synthesizer agent:

```
Agent(
  subagent_type: "pr-review:doc-context-synthesizer",
  prompt: "Synthesise the following work item summaries and Confluence page summaries into a single flat Doc Context narrative.

Work item summaries:
{all work item summarizer outputs concatenated, one block per work item}

Confluence page summaries:
{all confluence fetcher outputs concatenated, one block per page; or '(none)' if no pages were fetched}

Changed files (paste the full changed-files list you received in your own prompt above):
{CHANGED_FILES_LIST}

Return the complete ## Business context for this PR markdown block, or an empty string if no meaningful context was gathered."
)
```

---

## Step 7 — Return synthesizer output

Return the Doc Context Synthesizer agent's output **verbatim** as your final output. Do not add any wrapping, headers, or explanatory prose — just the plain markdown block (or empty string) that the synthesizer returned.

Before returning, check whether the synthesizer's output — after trimming leading/trailing whitespace — is empty or contains only the `## Business context for this PR` heading with no body text. If so, return an empty string instead.
