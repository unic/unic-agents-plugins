# 10. Doc Context Enrichment — work items + Confluence pages

**Status: done — 2026-05-06**

- Priority: P1
- Effort: M
- Version impact: minor (new user-visible capability; no breaking changes)
- Depends on: —
- Touches: `commands/review-pr.md`, new `scripts/confluence-client.mjs`,
  `docs/adr/0010-inline-confluence-client.md` (already written),
  `CONTEXT.md` (already updated), `docs/plans/README.md`, `CHANGELOG.md`

## Context

Review agents currently receive only the diff and changed file contents. They have no
visibility into *why* a PR exists — what the ticket asked for, what design decisions
were made, or what constraints were documented in Confluence.

This spec adds a **Doc Context** phase that runs before the review agents and injects
structured, diff-aware summaries of the PR's linked ADO work items and any Confluence
pages referenced in those work items. The summaries are internal context only — no new
comments are posted to the PR.

Decisions recorded in ADR-0010: the Confluence fetch logic lives as a self-contained
`.mjs` script inside `pr-review/` (not a shared package, not a dependency on
`unic-confluence`), using the same credential lookup convention as `unic-confluence`
(env vars first, `~/.unic-confluence.json` fallback).

Extensibility approach recorded in ADR-0011: new work item sources and doc sources are
added as parallel paths alongside the ADO/Confluence path — no plugin registry until a
third distinct source type is introduced.

## Current behaviour

Steps 1–12 in `commands/review-pr.md` pass the PR title, description, diff, and key
file contents to review agents. No work item or Confluence data is fetched or injected.

## Target behaviour

After step 4 (changed files list is known), a new **step 4a** runs:

1. Fetch all work items linked to the PR from the ADO API.
2. If none are linked, skip silently and proceed to step 5.
3. For each linked work item, spawn a **Doc Context Sub-agent** in parallel.
   Each sub-agent receives the work item ID, title, and description, plus the
   changed files list and the local diff (if already available from step 5).
4. Each Doc Context Sub-agent:
   a. Summarises the work item description (diff-aware: focus on what is relevant
      to the changed files).
   b. Extracts any Confluence page URLs from the work item description.
   c. For each Confluence URL, spawns a nested **Doc Context Sub-agent** (parallel)
      that fetches the page and returns a diff-aware summary.
5. Credential check for Confluence fetching:
   - Env vars (`CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`) take
     precedence; `~/.unic-confluence.json` is the fallback.
   - If credentials are absent **and** at least one Confluence URL was found: emit
     a console warning (never post to the PR):
     ```
     ⚠ Confluence pages not fetched — set CONFLUENCE_URL, CONFLUENCE_USER,
       CONFLUENCE_TOKEN (or run `node scripts/push-to-confluence.mjs --setup`)
       to enable doc-aware review.
     ```
   - If credentials are absent and no Confluence URLs were found: skip silently.
6. If a Confluence page fetch fails (network error, 401, 403, etc.): skip that page,
   emit a console warning (`⚠ Could not fetch Confluence page <url> — <reason>`),
   continue with whatever other context was gathered.
7. Steps 5–7 (local diff, read key files, determine aspects) run **in parallel** with
   step 4a. Step 8 waits for all of step 4a to complete before launching review agents.
8. Collected summaries are assembled into a **Doc Context block** (see format below)
   and injected as a preamble into every review agent's prompt in step 8.

Doc Context block format:

```markdown
## Business context for this PR

### Work item: [{ID}] {Title}
{diff-aware summary of work item description}

### Confluence — {Page Title} ({URL})
{diff-aware summary of page content}
```

If only work items are available (no Confluence links or credentials absent), the block
contains only the work item sections. If no Doc Context is gathered at all, the preamble
is omitted and review agents receive the same prompt as today.

## Affected files

| File | Change |
|---|---|
| `commands/review-pr.md` | Add step 4a; inject Doc Context block into step 8 agent prompts |
| `scripts/confluence-client.mjs` | New — credential loading + Confluence v2 page fetch |
| `docs/adr/0010-inline-confluence-client.md` | Already written (2026-05) |
| `CONTEXT.md` | Already updated — Doc Context and Doc Context Sub-agent terms |
| `docs/plans/README.md` | Add spec 10 row |
| `CHANGELOG.md` | New `[Unreleased]` entry |

## Implementation steps

### 1. Create `scripts/confluence-client.mjs`

A standalone Node.js script (`// @ts-check`, ESM, zero external deps) that:

- Exports a `loadCredentials()` function: checks env vars first, falls back to
  `~/.unic-confluence.json` (same logic as `unic-confluence/scripts/push-to-confluence.mjs`
  `loadCredentials()`). Throws a descriptive error if neither source yields valid creds.
- Exports a `fetchPageText(pageUrl, credentials)` function:
  - Extracts the numeric page ID from the Confluence URL
    (pattern: `/pages/{id}/` or `/pages/{id}`).
  - Calls `GET {CONFLUENCE_URL}/wiki/api/v2/pages/{pageId}?body-format=storage`
    with Basic auth (`username:token` base64-encoded).
  - Returns the `body.storage.value` string (Confluence storage XML). The calling
    agent reads through the XML directly — no dedicated parser needed.
  - Throws on non-2xx response or network error (caller handles the warning).
- CLI entry point (when called directly):
  ```
  node scripts/confluence-client.mjs <confluence-page-url>
  ```
  Prints the storage-format body to stdout; exits non-zero on error.

### 2. Add step 4a to `commands/review-pr.md`

Insert after the step 4 heading block, before step 5:

```markdown
## Step 4a — Gather Doc Context (work items + Confluence pages)

Fetch work items linked to the PR:

\```bash
az devops invoke \
  --area git \
  --resource pullRequestWorkItems \
  --route-parameters "repositoryId={REPO_ID}" "pullRequestId={PR_ID}" \
  --org {ORG_URL} \
  --api-version "7.1" \
  --output json
\```

If the `value` array is empty, skip to step 5.

For each work item ID returned, fetch its details:

\```bash
az boards work-item show --id {WI_ID} --org {ORG_URL} --output json
\```

Capture `fields.System.Title` and `fields.System.Description`.

Spawn one **Doc Context Sub-agent** per work item in parallel (single message).
Each sub-agent receives:
- Work item ID, title, and description (HTML — read through the markup)
- The changed files list from step 4
- The local diff from step 5 (pass it if already available; otherwise omit)

Each Doc Context Sub-agent must:
1. Summarise the work item description, focusing only on what is relevant to the
   changed files. Ignore sections that have no bearing on the diff.
2. Extract all Confluence URLs from the description.
3. Attempt to load Confluence credentials via
   `node scripts/confluence-client.mjs --check-creds` (exit 0 = creds available).
4. If creds available: spawn one nested Doc Context Sub-agent per Confluence URL
   (parallel), each running:
   `node scripts/confluence-client.mjs <url>`
   Pass the storage-format output plus the changed files list to a sub-agent that
   returns a diff-aware plain-text summary of the page.
5. If creds absent and Confluence URLs were found: emit the console warning (see
   Target behaviour §5). Do not spawn Confluence sub-agents.
6. Return a structured Doc Context block (work item section + any Confluence
   sections) using the format defined in Target behaviour.

Collect all sub-agent outputs. Concatenate into a single Doc Context block.
Store as `DOC_CONTEXT` for injection in step 8.
```

### 3. Inject Doc Context into step 8

In the step 8 agent prompt template, prepend `DOC_CONTEXT` before the diff content:

```
{DOC_CONTEXT if non-empty}

## Diff
{diff content}

## Changed files
{file contents}
```

Add `WebFetch` to the `allowed-tools` frontmatter list (needed by the Confluence
page sub-agents).

### 4. Update `docs/plans/README.md`

Add spec 10 row to the status table (no dependency on specs 00–09).

### 5. Add `CHANGELOG.md` entry

Under `[Unreleased]`, add:

```markdown
### Added
- Doc Context enrichment: before review agents run, fetch linked ADO work items and
  any Confluence pages referenced in their descriptions; inject structured,
  diff-aware summaries as business context into every review agent's prompt.
  Requires Confluence credentials (`CONFLUENCE_URL`, `CONFLUENCE_USER`,
  `CONFLUENCE_TOKEN` or `~/.unic-confluence.json`) for Confluence page fetching;
  degrades gracefully when absent or unreachable.
```

### 6. Bump version

Check what version the re-review feature (`docs/issues/pr-review-rereview/09-version-bump-and-release.md`) shipped at before running the bump — this feature must take the next available minor version after re-review.

```bash
pnpm --filter pr-review bump minor
```

## Verification

- PR with ≥1 linked work item, no Confluence links: review agents receive a
  `## Business context` preamble containing the work item summary; no console warning.
- PR with a linked work item whose description contains a Confluence URL, valid creds:
  review agents receive work item summary + Confluence page summary in the preamble.
- PR with no linked work items: step 4a exits silently; review agent prompts unchanged.
- Confluence credentials absent + Confluence URLs found: console warning printed;
  review continues with work item summaries only.
- Confluence credentials absent + no Confluence URLs: no warning; no change in output.
- Confluence page fetch returns 403: that page skipped with console warning; other
  pages and work items still included in Doc Context.
- No new threads or comments posted to the PR as a result of this spec.
- `pnpm --filter pr-review verify:changelog` passes.
- `node scripts/confluence-client.mjs --help` (or with a valid URL) runs without error.

## Acceptance criteria

- All changes land in a single conventional commit:
  `feat(pr-review): add doc context enrichment from work items and Confluence pages`
- Version bumped to the next available minor version after the re-review feature ships
  (check `docs/issues/pr-review-rereview/09-version-bump-and-release.md` first).
- `plugin.json` and `marketplace.json` versions match.
- `CHANGELOG.md` has a dated entry for the new version when the bump is finalised.
- `scripts/confluence-client.mjs` has zero external runtime dependencies.
- Doc Context is never posted to the PR — it is internal agent context only.
- Degradation is graceful at every tier: no work items → skip; no creds → warn + skip
  Confluence; fetch error → warn + skip that page; local diff unavailable → sub-agents
  work from changed files list only.

## Out of scope

- GitHub PR support (separate future spec).
- Fetching Confluence pages linked from the PR description directly (not via a work
  item) — a follow-up if demand exists.
- Caching Confluence page content across runs.
- Any changes to comment posting, thread management, or the Bot Signature.
- Re-review integration (specs 00–09 own that).
