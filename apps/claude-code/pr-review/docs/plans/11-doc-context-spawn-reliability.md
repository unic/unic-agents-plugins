# 11. Doc Context Spawn Reliability

**Status: done — 2026-05-08**

- Priority: P1
- Effort: S
- Version impact: patch (bug fix; no new user-visible capability)
- Depends on: 10
- Touches: `commands/review-pr.md`, new `.agents/doc-context-orchestrator.md`, new `.agents/doc-context-synthesizer.md`, `docs/adr/0012-plain-text-doc-context-agent-return.md`, `docs/plans/README.md`, `CHANGELOG.md`

## Context

Spec 10 added the Doc Context phase and shipped it as done. In practice the phase is silently skipped on every run — review agents never receive business context. Three defects combine to produce this outcome:

1. **Step 4a has no explicit Agent() spawn template.** The step describes what a Doc Context Sub-agent "must do" in prose bullets. The orchestrator satisfies the intent inline and proceeds to step 5 without spawning any agent.

2. **`confluence-client.mjs` is called with a relative path.** `node scripts/confluence-client.mjs` resolves against the reviewed project's root, not the plugin directory. The path never finds the script.

3. **`DOC_CONTEXT` is never initialised.** There is no `DOC_CONTEXT=''` before step 4a. When the phase is skipped the variable is undefined; step 8's `{DOC_CONTEXT if non-empty}` check produces no error, making the failure invisible.

**Why extraction, not inline fix:** simply adding explicit `Agent()` templates inline in step 4a would fix the spawn defect, but it would cause the main orchestrator to accumulate all work item HTML, Confluence storage-format XML, and per-page summaries in its own context window. Token consumption would grow proportionally to PR complexity. Delegating to a dedicated orchestrator agent isolates that content in a fresh context window.

## Target behaviour

- `DOC_CONTEXT=''` is initialised at the very top of step 4a before any fetch.
- Step 4a pre-fetches work item IDs in bash (to decide whether to spawn at all), then waits for the diff from step 5 before spawning the orchestrator agent.
- The Doc Context Orchestrator agent handles the entire gathering phase in its own context: work item detail fetches, credential check, Confluence page fetches, Work Item Summarizer agents, and final synthesis.
- The Doc Context Synthesizer agent produces a single coherent flat narrative — no work item headings, no redundant content.
- Confluence credential check runs exactly once in the orchestrator agent (not per fetcher).
- All absolute paths to `confluence-client.mjs` are resolved from `${CLAUDE_PLUGIN_ROOT}` in bash and injected into agent prompts as literal strings (agents do not inherit env vars).

## Affected files

| File | Change |
|---|---|
| `commands/review-pr.md` | Rewrite step 4a: init `DOC_CONTEXT=''`, pre-fetch work item IDs, wait for diff, delegate to Doc Context Orchestrator agent via explicit `Agent()` call; update parallelism note |
| `.agents/doc-context-orchestrator.md` | New agent: self-contained orchestrator for the entire Doc Context gathering phase |
| `.agents/doc-context-synthesizer.md` | New agent: produces a single coherent flat Doc Context narrative from all work item and Confluence summaries |
| `docs/adr/0012-plain-text-doc-context-agent-return.md` | New ADR: agent returns plain markdown, not JSON |
| `docs/plans/README.md` | Add spec 11 row |
| `CHANGELOG.md` | Add entry under `[Unreleased]` |

No changes to `scripts/confluence-client.mjs`, tests, or any other file.

## Implementation steps

### 1. Write ADR-0012

Create `docs/adr/0012-plain-text-doc-context-agent-return.md` recording the decision to have the Doc Context Orchestrator agent return plain markdown rather than a JSON wrapper (see ADR format below).

### 2. Create `.agents/doc-context-orchestrator.md`

This agent receives: `ORG_URL`, `PR_ID`, a list of work item IDs, the full diff, the changed files list, and `CONFLUENCE_CLIENT_PATH` (absolute, pre-expanded from `${CLAUDE_PLUGIN_ROOT}`). It does **not** receive the initial work item ID list fetch — that happened in bash.

The agent must:

1. For each work item ID, run:
   ```bash
   az boards work-item show --id {WI_ID} --org {ORG_URL} --output json
   ```
   If the command fails: emit `⚠ Could not fetch work item {WI_ID} — {error}` to console and skip that item.

2. For each work item, extract the relevant description fields based on work item type:
   - `Bug` → `Microsoft.VSTS.TCM.ReproSteps` + `Microsoft.VSTS.TCM.SystemInfo`
   - `User Story`, `Task`, `Feature`, or any unrecognised type → `System.Description`

3. Spawn one **Work Item Summarizer agent** per work item **in parallel** (single message). Each agent receives: work item ID, title, description (HTML), the changed files list, the diff.

   Each Work Item Summarizer agent must:
   - Summarise the description as plain text, focusing only on what is relevant to the changed files and diff. Ignore sections with no bearing on the diff.
   - Extract all Confluence URLs from the description.
   - Return structured output: work item summary text + list of `{url, relevantContext}` pairs (one per Confluence URL found).

4. Run the Confluence credential check **once**:
   ```bash
   node {CONFLUENCE_CLIENT_PATH} --check-creds
   ```
   Exit 0 = creds available. Any other outcome = creds absent.

   If creds are absent and any work item summarizer returned Confluence URLs: emit the following warning to console (never post to the PR) and skip all Confluence fetching:
   ```
   ⚠ Confluence pages not fetched — set CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN (or create ~/.unic-confluence.json with { url, username, token }) to enable doc-aware review.
   ```

5. If creds are available: collect all unique Confluence URLs across all work item summarizer outputs. Spawn one **Confluence Fetcher agent** per unique URL **in parallel** (single message).

   Each Confluence Fetcher agent must:
   - Run: `node {CONFLUENCE_CLIENT_PATH} {URL}`
   - If successful: return a plain-text summary of the page, focused on what is relevant to the changed files.
   - If the fetch fails (network error, 401, 403, etc.): emit `⚠ Could not fetch Confluence page {URL} — {reason}` to console and return nothing.

6. Pass all work item summarizer outputs and all Confluence fetcher outputs to the **Doc Context Synthesizer agent**.

7. Return the Doc Context Synthesizer agent's output verbatim as the agent's final output.

### 3. Create `.agents/doc-context-synthesizer.md`

This agent receives all work item summaries and all Confluence page summaries (potentially overlapping across work items). It must produce a single coherent `## Business context for this PR` section with no redundant content.

Rules:
- Flat narrative — no work item headings, no per-ticket structure.
- Synthesise overlapping content: if multiple work items or Confluence pages describe the same feature, merge them into one coherent description rather than repeating the same information.
- Focus on business intent: what the PR is supposed to accomplish and why, from the specifications' perspective. Omit implementation details already visible in the diff.
- If no meaningful context was gathered (all work items and pages failed or returned empty): return an empty string.

Output format:
```markdown
## Business context for this PR

{synthesised narrative}
```

### 4. Rewrite step 4a in `commands/review-pr.md`

Replace the current step 4a content with:

```
DOC_CONTEXT=''

Fetch work items linked to the PR:

  az devops invoke \
    --area git \
    --resource pullRequestWorkItems \
    --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" \
    --org {ORG_URL} \
    --api-version "7.1" \
    --output json

If the `value` array is empty or the command fails, leave DOC_CONTEXT='' and proceed.

Otherwise, wait for the diff from step 5 to be available (step 4a and step 5 run
concurrently up to this point; only the orchestrator spawn waits for the diff).

Resolve the plugin path:

  CONFLUENCE_CLIENT_PATH="${CLAUDE_PLUGIN_ROOT}/scripts/confluence-client.mjs"

Delegate to the Doc Context Orchestrator agent:

  Agent(
    subagent_type: "pr-review:doc-context-orchestrator",
    prompt: "Orchestrate Doc Context gathering.

    ORG_URL: {ORG_URL}
    PR_ID: {PR_ID}
    Work item IDs: {comma-separated list from value array}
    Confluence client path: {CONFLUENCE_CLIENT_PATH}

    Changed files:
    {CHANGED_FILES_LIST}

    Diff:
    {RAW_DIFF}

    Return the complete Doc Context markdown block, or an empty string if no
    meaningful context could be gathered."
  )

Store the agent's output as DOC_CONTEXT.
```

Also update the parallelism note: "Step 4a pre-fetch (work item IDs) runs in parallel with step 5. The orchestrator agent spawn waits for the diff from step 5. Step 8 waits for the orchestrator agent to complete before launching review agents."

### 5. Update `docs/plans/README.md`

Add spec 11 row to the status table.

### 6. Add `CHANGELOG.md` entry

Under `[Unreleased]`, add a `Fixed` entry describing the three defects and the orchestrator extraction.

## Verification

- PR with ≥1 linked work item (non-Bug), no Confluence links: `DOC_CONTEXT` is non-empty; review agents receive the `## Business context` preamble.
- PR with a Bug work item: `ReproSteps` and `SystemInfo` are extracted; `System.Description` is not used.
- PR with a Confluence-linked work item, valid credentials: preamble includes synthesised content from both the work item and the Confluence page.
- PR with two work items linking the same Confluence page: the page appears once in the output, not twice.
- PR with no linked work items: step 4a exits with `DOC_CONTEXT=''`; agent prompts in step 8 unchanged.
- Credentials absent + Confluence URLs found: console warning printed; `DOC_CONTEXT` contains work item summaries only.
- No new PR threads or comments produced by the Doc Context phase.

## Acceptance criteria

- [ ] `DOC_CONTEXT=''` is the first statement in step 4a.
- [ ] Step 4a contains an explicit `Agent(subagent_type: "pr-review:doc-context-orchestrator", ...)` call with all required context.
- [ ] All paths to `confluence-client.mjs` in agent prompts are absolute strings resolved from `${CLAUDE_PLUGIN_ROOT}`.
- [ ] The orchestrator agent runs the credential check exactly once.
- [ ] Bug work items use `ReproSteps` + `SystemInfo`; all other types use `System.Description`.
- [ ] The Doc Context Synthesizer agent produces a flat narrative with no per-work-item headings.
- [ ] ADR-0012 is committed alongside the implementation.

## Out of scope

- Changes to `scripts/confluence-client.mjs`.
- Changes to thread posting, re-review logic, or Bot Signature.
- GitHub PR support.
- Caching Doc Context across review runs.
- Jira or other work item sources.
- Re-review handling of Doc Context (no change to when/how DOC_CONTEXT is injected in step 8).
