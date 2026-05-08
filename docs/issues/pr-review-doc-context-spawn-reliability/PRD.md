# PRD: pr-review — Doc Context Spawn Reliability

**Status:** ready-for-agent
**Category:** bug
**Plugin:** `apps/claude-code/pr-review`
**Specs:** `apps/claude-code/pr-review/docs/plans/11-doc-context-spawn-reliability.md`

---

## Problem Statement

Spec 10 shipped the Doc Context phase — a pre-review step that gathers work item descriptions and Confluence page summaries and injects them as business context into every Review Aspect agent's prompt. The phase was marked done, but in practice it is silently skipped on every run. Review agents never receive business context. Three defects combine to produce this outcome:

1. Step 4a describes what a Doc Context Sub-agent "must do" in prose bullets but provides no explicit `Agent()` spawn call. The orchestrator satisfies the intent inline and proceeds to step 5 without spawning any sub-agent.
2. `confluence-client.mjs` is called with a relative path (`node scripts/confluence-client.mjs`). The shell's working directory during a review is the reviewed project's root, not the plugin directory. The path never resolves.
3. `DOC_CONTEXT` is never initialised before step 4a. When the phase is skipped the variable is undefined; step 8's guard produces no error, making the failure invisible.

The result is that the Doc Context feature, which was the primary deliverable of spec 10, has never functioned since it shipped.

## Solution

Step 4a is restructured into a clear two-phase delegation:

1. A short bash pre-fetch checks whether the PR has any linked work items. If not, `DOC_CONTEXT` remains `''` and the phase exits silently.
2. If work items are found, the step waits for the diff and delegates everything else to a dedicated **Doc Context Orchestrator** agent via an explicit `Agent()` call. The orchestrator runs in its own context window, handling work item detail fetches, credential checking, Confluence page fetching, and synthesis — keeping the main orchestrator's context window clean.

A **Doc Context Synthesizer** agent takes all gathered summaries (work items and Confluence pages, potentially overlapping) and produces a single coherent flat narrative focused on business intent — what the PR is supposed to accomplish and why, from the specifications' perspective.

All absolute paths to `confluence-client.mjs` are resolved from `${CLAUDE_PLUGIN_ROOT}` in bash before agent spawning and injected as literal strings into agent prompts, since agents do not inherit environment variables.

## User Stories

1. As a developer triggering a PR review against a PR with linked work items, I want the review agents to receive a business context preamble so that findings reflect whether the implementation matches the intent, not just whether the code is well-written.
2. As a developer triggering a PR review, I want the Doc Context phase to actually spawn agents rather than proceeding silently, so that the feature I believe is configured actually functions.
3. As a developer triggering a PR review, I want `DOC_CONTEXT` to be initialised to an empty string at the start of step 4a so that the review never fails silently due to an uninitialised variable.
4. As a developer triggering a PR review on a project where the plugin directory differs from the reviewed project's root, I want the Confluence client to be called with its absolute path so that the script is always found regardless of working directory.
5. As a developer triggering a PR review against a PR with no linked work items, I want step 4a to exit silently and leave `DOC_CONTEXT` as an empty string so that the review proceeds exactly as before.
6. As a developer triggering a PR review with a Bug work item linked, I want the orchestrator to extract `ReproSteps` and `SystemInfo` fields (not just `System.Description`) so that the Doc Context reflects the actual content of Bug tickets, which is often empty in the description field.
7. As a developer triggering a PR review with a User Story, Task, or Feature linked, I want the orchestrator to extract `System.Description` so that the standard field is used for non-Bug work item types.
8. As a developer triggering a PR review with an unrecognised work item type, I want the orchestrator to fall back to `System.Description` and continue so that custom or unexpected work item types do not abort the phase.
9. As a developer triggering a PR review with multiple work items all linking to the same Confluence page, I want the Doc Context to contain that page's content only once so that the review preamble is not cluttered with duplicated information.
10. As a developer triggering a PR review where work items and Confluence pages partially overlap in content, I want the Doc Context Synthesizer to produce a single coherent narrative rather than a concatenation of redundant summaries.
11. As a developer reading the Doc Context preamble, I want it to be a flat synthesised narrative rather than a list grouped by work item so that review agents receive a coherent picture of the feature intent, not a structured report.
12. As a developer triggering a PR review without Confluence credentials, I want a single console warning naming the missing environment variables or file so that I know exactly what to configure, without that warning being repeated for every Confluence URL found.
13. As a developer triggering a PR review with Confluence credentials, I want the credential check to run exactly once in the orchestrator agent before any page fetching begins so that N work items do not produce N redundant credential checks.
14. As a developer triggering a PR review where a Confluence page is unreachable, I want the orchestrator to skip that page, emit a console warning, and include whatever other context was gathered so that a single failed fetch does not silently discard all business context.
15. As a developer triggering a PR review, I want the Doc Context phase to wait for the diff before spawning Work Item Summarizer agents so that summaries are diff-aware and focus only on sections relevant to the actual changes.
16. As a developer reading `commands/review-pr.md`, I want the Doc Context spawn to be as explicit as the review-agent spawn in step 8 so that the orchestrator cannot satisfy the intent inline and silently skip it again.
17. As a developer whose Confluence credential check hangs on a broken network, I want to know that `--check-creds` is a local-only operation so that I understand it cannot hang regardless of network state.
18. As a developer with no new PR comments after a review run, I want to confirm that the Doc Context phase never posts anything to the PR, so that business context remains internal to the tool.

## Implementation Decisions

### Modules

**Doc Context Orchestrator agent** (new)
Self-contained agent that handles the entire gathering phase in its own context window. Receives: organisation URL, PR ID, list of work item IDs, the full diff, the changed files list, and the absolute path to `confluence-client.mjs`. Orchestrates work item detail fetching, type-aware field extraction, parallel Work Item Summarizer agents, a single credential check, parallel Confluence Fetcher agents, and final delegation to the Doc Context Synthesizer. Returns the Synthesizer's output verbatim as plain markdown — no JSON wrapper.

**Doc Context Synthesizer agent** (new)
Receives all Work Item Summarizer outputs and all Confluence Fetcher outputs. Produces a single `## Business context for this PR` section as a flat, non-redundant narrative. No per-work-item headings. Focuses on business intent — what the PR should accomplish and why — not implementation details already visible in the diff. Returns an empty string if no meaningful context was gathered.

**Step 4a in `commands/review-pr.md`** (modified)
Rewritten to: (1) initialise `DOC_CONTEXT=''` unconditionally; (2) pre-fetch work item IDs in bash; (3) exit silently if none; (4) wait for the diff from step 5; (5) resolve `CONFLUENCE_CLIENT_PATH` from `${CLAUDE_PLUGIN_ROOT}` in bash; (6) spawn the Doc Context Orchestrator agent via an explicit `Agent()` call with all required context; (7) store the agent's plain-text output as `DOC_CONTEXT`.

### Key interface contracts

- The orchestrator agent returns **plain markdown** (the final `## Business context` block), not a JSON object. Rationale: JSON wrappers are fragile when produced by LLM agents under long-context conditions — markdown fences, explanatory prose, and malformed output all cause silent extraction failures. See ADR-0012.
- Work Item Summarizer agents are spawned inline (anonymous), not as named plugin agent types.
- The orchestrator agent performs the credential check once before spawning any Confluence Fetcher agents. If creds are absent, no fetchers are spawned.
- Confluence Fetcher agents are spawned per unique URL across all work items (deduplicating at the URL level before fetching, in addition to the Synthesizer's semantic deduplication).
- All paths to `confluence-client.mjs` passed to agents are absolute literal strings expanded from `${CLAUDE_PLUGIN_ROOT}` in the bash step, not env-var references.

### Execution model

- The bash pre-fetch of work item IDs (step 4a) runs in parallel with step 5 (diff generation) and steps 6–7.
- The orchestrator agent spawn waits for the diff from step 5 before being invoked.
- Step 8 waits for the orchestrator agent to complete before launching Review Aspect agents.

### Work item type branching

| Work item type | Fields extracted |
|---|---|
| `Bug` | `Microsoft.VSTS.TCM.ReproSteps` + `Microsoft.VSTS.TCM.SystemInfo` |
| All other types (including unrecognised) | `System.Description` |

## Testing Decisions

The Confluence client (`scripts/confluence-client.mjs`) already has full `node:test` coverage in `tests/confluence-client.test.mjs`. The client is not changed in this spec, so no new test module is required.

The new agent files (orchestrator, synthesizer) are prompt-driven agents whose behaviour is verified through manual end-to-end runs against real PRs. Automated unit tests are not applicable to agent prompt files.

**Good tests for this feature verify external behaviour, not implementation details:**
- `DOC_CONTEXT` is non-empty after a review run against a PR with linked work items
- `DOC_CONTEXT` is empty after a review run against a PR with no linked work items
- No new threads or comments are posted to the PR by the Doc Context phase
- Console warnings appear when credentials are absent and Confluence URLs were found

**Manual verification checklist** (mirrors spec 11's verification section):
- PR with ≥1 linked work item (non-Bug), no Confluence links: `DOC_CONTEXT` non-empty; review agents receive the preamble.
- PR with a Bug work item: `ReproSteps` and `SystemInfo` extracted; `System.Description` not used.
- PR with a Confluence-linked work item and valid credentials: preamble includes synthesised content from both work item and Confluence page.
- PR with two work items linking the same Confluence page: page appears once in the output.
- PR with no linked work items: step 4a silent; `DOC_CONTEXT=''`; step 8 unchanged.
- Credentials absent + Confluence URLs found: one console warning; `DOC_CONTEXT` contains work item summaries only.
- No new PR threads or comments produced.

## Out of Scope

- Changes to `scripts/confluence-client.mjs` or its test suite.
- Changes to thread posting, re-review logic, Thread Classification, or Bot Signature behaviour.
- GitHub PR support.
- Caching Doc Context across review runs.
- Jira, GitHub Issues, or other work item sources.
- Re-review handling of Doc Context (no change to when or how `DOC_CONTEXT` is injected in step 8).
- Semantic deduplication across Confluence pages with different URLs but overlapping content (the Synthesizer handles this naturally as part of synthesis; it is not a separate deduplication pass).

## Further Notes

The `--check-creds` flag in `confluence-client.mjs` is a purely local operation — it reads environment variables and a credentials file. It makes no network call and cannot hang. The 10-second timeout specified in spec 10 for the credential check was incorrect and has been removed. The actual network calls (page fetches) are already covered by a 30-second timeout built into the HTTP layer of `confluence-client.mjs`.

ADR-0012 records the decision to use plain markdown (not JSON) as the return format for the Doc Context Orchestrator agent.

---

## Agent Brief

> *This was generated by AI during triage.*

**Category:** bug
**Summary:** Doc Context phase is silently skipped on every review run — three defects prevent the orchestrator from ever spawning an agent

**Current behavior:**

Step 4a in the `review-pr` command describes what a Doc Context Sub-agent "must do" in prose bullets but contains no explicit `Agent()` spawn call. The orchestrator satisfies the doc-context intent inline and proceeds to the next step without spawning any agent. Additionally, `confluence-client.mjs` is called with a relative path (`node scripts/confluence-client.mjs`), which fails when the shell working directory is the reviewed project's root rather than the plugin directory. `DOC_CONTEXT` is also never initialised before step 4a, so when the phase is skipped the variable is undefined and step 8's guard produces no preamble and no error — the failure is invisible.

The result: the Doc Context feature has never functioned since it shipped in spec 10.

**Desired behavior:**

- `DOC_CONTEXT=''` is initialised unconditionally at the start of step 4a.
- Step 4a pre-fetches linked work item IDs in bash; if none are found, it exits silently with `DOC_CONTEXT=''`.
- If work items are found, step 4a delegates the entire gathering phase to a **Doc Context Orchestrator agent** via an explicit `Agent(subagent_type: "pr-review:doc-context-orchestrator", ...)` call — never satisfied inline.
- The orchestrator agent (new file) handles: work item detail fetches, work-item-type-aware field extraction, parallel Work Item Summarizer agents, a single credential check, parallel Confluence Fetcher agents, and final delegation to the Doc Context Synthesizer agent.
- The **Doc Context Synthesizer agent** (new file) produces a single `## Business context for this PR` flat narrative — no per-work-item headings, no redundant content. Returns an empty string if nothing meaningful was gathered.
- All paths to `confluence-client.mjs` passed into agent prompts are absolute literal strings resolved from `${CLAUDE_PLUGIN_ROOT}` in bash before the spawn (agents do not inherit environment variables).
- The orchestrator runs the Confluence credential check exactly once before spawning any page-fetching agents.
- Bug work items use `Microsoft.VSTS.TCM.ReproSteps` + `Microsoft.VSTS.TCM.SystemInfo`; all other types (including unrecognised) use `System.Description`.
- Warnings (missing creds, failed fetches) are printed to console only — never posted to the PR.
- The orchestrator agent returns its output as plain markdown, not a JSON wrapper. ADR-0012 records this decision.

**Key interfaces:**

- `review-pr` command step 4a — must contain an explicit `Agent(subagent_type: "pr-review:doc-context-orchestrator", ...)` call with `ORG_URL`, `PR_ID`, work item ID list, `CONFLUENCE_CLIENT_PATH`, changed files list, and diff.
- `doc-context-orchestrator` agent — new plugin agent; receives the inputs above; returns the synthesizer's output verbatim as plain markdown.
- `doc-context-synthesizer` agent — new plugin agent; receives all work item and Confluence page summaries; returns a single `## Business context for this PR` section or an empty string.
- ADR-0012 — records the plain-markdown (not JSON) return format for the orchestrator agent.

**Acceptance criteria:**

- [ ] `DOC_CONTEXT=''` is the first statement in step 4a.
- [ ] Step 4a contains an explicit `Agent(subagent_type: "pr-review:doc-context-orchestrator", ...)` call with all required context variables.
- [ ] All `confluence-client.mjs` paths in agent prompts are absolute strings resolved from `${CLAUDE_PLUGIN_ROOT}` — no relative paths anywhere.
- [ ] The orchestrator agent runs the Confluence credential check exactly once.
- [ ] Bug work items extract `ReproSteps` + `SystemInfo`; all other types extract `System.Description`.
- [ ] The synthesizer agent produces a flat narrative with no per-work-item headings.
- [ ] ADR-0012 is committed alongside the implementation.
- [ ] PR with ≥1 linked work item (non-Bug), no Confluence links: `DOC_CONTEXT` is non-empty after a review run; review agents receive the preamble.
- [ ] PR with no linked work items: step 4a exits silently; `DOC_CONTEXT=''`; step 8 unchanged.
- [ ] No new PR threads or comments produced by the Doc Context phase.

**Out of scope:**

- Changes to `confluence-client.mjs` or its test suite.
- Changes to thread posting, re-review logic, Thread Classification, or Bot Signature.
- GitHub PR support.
- Caching Doc Context across review runs.
- Jira or other work item sources.
- Re-review handling of Doc Context (no change to when/how `DOC_CONTEXT` is injected in step 8).
