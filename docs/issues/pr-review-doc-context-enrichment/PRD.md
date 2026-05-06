# PRD: pr-review — Doc Context Enrichment

**Status:** closed
**Plugin:** `apps/claude-code/pr-review`
**Specs:** `apps/claude-code/pr-review/docs/plans/10-doc-context-enrichment.md`

---

## Problem Statement

When a developer runs `/pr-review:review-pr` on an Azure DevOps pull request, the review agents receive only the diff and the contents of changed files. They have no visibility into _why_ the PR exists — what the work item asked for, what design constraints were documented, or what the stakeholder intended. This means the agents can only assess _how_ the code was written, not _whether_ it solves the right problem. Mismatches between the specification and the implementation go undetected, and context that would help the reviewer produce sharper, more targeted findings is silently discarded.

## Solution

Before review agents run, the plugin gathers **Doc Context**: structured, diff-aware summaries of the ADO work items linked to the PR and any Confluence pages referenced in those work items. The summaries are assembled by short-lived **Doc Context Sub-agents** that run in parallel and are then injected as a structured preamble into every review agent's prompt. The enrichment is always-on when data is available, degrades gracefully at every tier, and never posts anything to the PR — it is internal context only.

## User Stories

1. As a developer triggering a PR review, I want the review agents to know what the linked work item asked for so that their findings reflect whether the implementation matches the intent, not just whether the code is well-written.
2. As a developer triggering a PR review, I want the review agents to have access to relevant Confluence design documents so that findings can cite specific design decisions rather than generic best practices.
3. As a developer triggering a PR review on a PR with no linked work items, I want the review to proceed exactly as before so that the new feature has no effect on PRs without enrichment data.
4. As a developer triggering a PR review, I want the work item and Confluence context to be summarised rather than dumped verbatim so that review agent prompts remain focused and don't exceed context limits.
5. As a developer triggering a PR review, I want each summary to be diff-aware — focused on what is relevant to the changed files — so that irrelevant sections of a work item or Confluence page don't dilute the signal.
6. As a developer triggering a PR review with multiple linked work items, I want all of them to contribute context so that the review reflects the full scope of the change.
7. As a developer triggering a PR review where a work item links to several Confluence pages, I want all linked pages to be fetched in parallel so that the enrichment phase adds as little latency as possible.
8. As a developer triggering a PR review, I want to see provenance labels on each context section (work item ID + title, Confluence page title + URL) so that review agents can cite their sources in findings.
9. As a developer who has not configured Confluence credentials, I want the review to still run and use work item context only so that Confluence credentials are not a hard prerequisite.
10. As a developer who has not configured Confluence credentials but whose work item links to Confluence pages, I want a console warning explaining what I am missing and how to configure it so that I can opt in when I choose.
11. As a developer with Confluence credentials configured via environment variables, I want the plugin to pick them up automatically so that no additional setup is needed beyond what I have already done.
12. As a developer who has already configured `unic-confluence` credentials in `~/.unic-confluence.json`, I want `pr-review` to honour the same file so that I do not need a second credential setup.
13. As a developer triggering a PR review when a Confluence page is unreachable (network error, expired token, forbidden), I want a console warning for that specific page and for the review to continue with whatever other context was gathered so that a single unreachable page does not block the entire review.
14. As a developer triggering a PR review on a branch that is not checked out locally, I want the Doc Context Sub-agents to work from the changed files list alone so that the absence of a local diff does not prevent enrichment.
15. As a developer reading console output during a review run, I want the Doc Context gathering phase to be clearly distinguishable from the review phase so that I can follow the sequence of operations.
16. As a developer using a project that mixes ADO work items with Confluence pages and GitHub-hosted documents, I want the architecture to support adding new doc sources later without rewriting the existing ADO/Confluence path so that the plugin evolves cleanly.
17. As a code reviewer reading the PR, I want no additional comments posted by the enrichment feature so that the Doc Context remains internal to the tool and does not pollute the PR conversation.
18. As a plugin operator managing credentials, I want the Confluence credential lookup to follow the same precedence as `unic-confluence` (env vars first, `~/.unic-confluence.json` fallback) so that there is one credential convention for all Unic plugins.

## Implementation Decisions

### Modules

**Confluence page client**
A standalone Node.js script (zero external runtime dependencies) responsible for credential loading and Confluence v2 REST API page fetching. Accepts a Confluence page URL, extracts the numeric page ID from the URL path, loads credentials following the shared Unic precedence order (env vars → `~/.unic-confluence.json`), calls `GET /wiki/api/v2/pages/{id}?body-format=storage`, and returns the raw storage-format body. Also exposes a credential-check mode used by the Doc Context Sub-agent before deciding whether to spawn Confluence page fetches. This is the primary deep module of the feature — a simple interface over all HTTP, authentication, and error-handling complexity.

**Doc Context gathering phase (step 4a)**
Orchestration added to `commands/review-pr.md` between the changed-files step (step 4) and the local-diff step (step 5). Fetches the list of work item IDs linked to the PR via the ADO `pullRequestWorkItems` API. If the list is empty, exits silently. Otherwise spawns one Doc Context Sub-agent per work item in parallel, passing each the work item ID, title, description, changed files list, and local diff when already available. Collects the structured outputs and assembles them into a single Doc Context block stored for injection in step 8.

**Work item Doc Context Sub-agent**
A short-lived agent spawned once per linked work item. Reads the work item title and description (HTML), produces a diff-aware summary of the work item, extracts all Confluence URLs from the description, checks Confluence credentials, and — if credentials are present — spawns one nested Confluence page Doc Context Sub-agent per URL in parallel. Returns a structured block with a work item section followed by any Confluence page sections.

**Confluence page Doc Context Sub-agent**
A short-lived agent spawned once per Confluence URL found in a work item description. Invokes the Confluence page client script to fetch the page body, then produces a diff-aware plain-text summary of the page content (reading through Confluence storage-format XML directly). Returns a structured block with a provenance label (page title + URL) and the summary.

**Doc Context block assembler**
The concatenation of all work item and Confluence page blocks into a single structured preamble, injected before the diff content in every review agent's prompt in step 8. Uses the format:

```
## Business context for this PR

### Work item: [{ID}] {Title}
{diff-aware summary}

### Confluence — {Page Title} ({URL})
{diff-aware summary}
```

### Credential precedence

The Confluence page client follows the same lookup order as `unic-confluence`: environment variables (`CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`) take precedence; `~/.unic-confluence.json` is the fallback. This is a deliberate shared convention for the Unic audience — developers who have configured one plugin should not need to configure the other.

### Extensibility

New work item sources (Jira, GitHub Issues) and doc sources (GitHub Wiki, Notion) are added as additional parallel paths in the same Doc Context gathering phase — each with its own client script following the Confluence client pattern. No shared abstraction or registry is introduced until a third distinct source type is needed. This decision is recorded in ADR-0011.

### Parallelism and timing

Doc Context Sub-agents run in parallel with the local-diff step (step 5), the key-file reading step (step 6), and the aspects step (step 7). Step 8 (review agent launch) waits for the Doc Context gathering phase to complete before starting. This amortises the API latency of Doc Context fetching against work that would happen anyway.

### Error and degradation behaviour

- No linked work items → skip silently, no change in review agent prompts
- Confluence credentials absent, no Confluence URLs found → skip silently
- Confluence credentials absent, Confluence URLs found → console warning only (never posted to PR)
- Confluence page fetch fails (any error) → skip that page, console warning, continue with other context
- Local diff not available → Doc Context Sub-agents work from changed files list only

## Testing Decisions

A good test for this feature verifies external behaviour, not internal plumbing: given a certain credential configuration and API response, what does the Confluence page client return or throw? Tests should not assert on private implementation details (URL construction internals, base64 encoding logic) — only on the observable contract.

**Confluence page client** is the primary module to test with `node:test`. Test cases:

- Returns storage-format body on 200 response
- Throws a descriptive error on 401, 403, 404
- Throws a descriptive error on network failure / timeout
- Credential loading: env vars take precedence over `~/.unic-confluence.json`
- Credential loading: throws with actionable message when neither source is configured
- Page ID extraction from various Confluence URL formats (`/pages/{id}/`, `/pages/{id}`, with trailing slug)

Prior art for test structure: `apps/claude-code/pr-review/docs/plans/09-test-harness.md` establishes the pattern for `node:test` with JSON fixtures and no live connections. Follow the same approach — mock the HTTPS layer with a fixture, not a live Confluence instance.

The Doc Context orchestration and Sub-agent logic lives in the `commands/review-pr.md` prompt and is not directly unit-testable. End-to-end correctness is verified via the acceptance criteria in spec 10.

## Out of Scope

- GitHub and GitLab as PR entry points (separate roadmap item; doc context enrichment applies there too when those platforms are supported)
- Alternative work item sources: Jira, GitHub Issues, etc. (captured in `docs/inbox/alternative-work-item-sources-for-doc-context.md`)
- Alternative doc sources: GitHub Wiki, Notion, SharePoint, etc. (captured in `docs/inbox/alternative-doc-sources-for-doc-context.md`)
- Fetching Confluence pages linked directly from the PR description rather than via a work item
- Caching Confluence page content across review runs
- Any new comment types, inline threads, or general comments posted to the PR
- Changes to the Bot Signature, thread classification, or re-review logic (specs 00–09)

## Further Notes

Two ADRs record the architectural decisions made during the design session:

- **ADR-0010** — why Confluence fetch logic is replicated inline rather than extracted to a shared package or depending on `unic-confluence`
- **ADR-0011** — why the extensibility model is additive parallel paths rather than a plugin registry, and what the condition is to revisit that decision (a third distinct source type)

The feature slug for the spec is `10-doc-context-enrichment` under `apps/claude-code/pr-review/docs/plans/`.
