# PRD: pr-review — Orchestrator Split

**Status:** ready-for-agent
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`

---

## Problem Statement

The `review-pr` command has grown into a ~1000-line monolith that conflates three distinct concerns: orchestration (which operating mode?), ADO platform integration (fetch metadata, post comments), and re-review state management (classify threads, match findings, reply). As a result, every invocation loads the full command file into context, combined with parallel review-agent results flowing back, pushing average PR reviews past 100 K parent-context tokens. Adding the pre-PR mode that developers are requesting would push the file to ~1300 lines and compound the problem further.

## Solution

Refactor `review-pr.md` into a thin orchestrator of ~200 lines that detects the operating mode and immediately delegates to focused agents. The three focused agents — ADO Fetcher, Re-review Coordinator, and ADO Writer — live in the plugin's own agent directory and only load when their mode is active. Pre-PR runs never touch ADO at all. Review aspect agents are also asked to return compact structured findings rather than prose, keeping what flows back into the parent context small.

## User Stories

1. As a developer running `/pr-review:review-pr` on a first-review PR, I want the command to execute without loading re-review state-machine logic, so that the parent context is not burdened by code paths that do not apply.

2. As a developer running `/pr-review:review-pr` on a re-review PR, I want the Re-review Coordinator to own all prior-thread detection and classification, so that the orchestrator stays short and readable.

3. As a developer who wants to review code before opening a PR, I want to run `/pr-review:review-pr` without a PR URL and receive findings in the Claude interface, so that I can catch issues before the PR is even created.

4. As a developer running a pre-PR Review, I want no comments posted to ADO, so that draft feedback does not pollute the eventual PR conversation.

5. As a developer, I want the orchestrator to tell me clearly which mode it is entering (Pre-PR, First-review, or Re-review), so that I can understand what will happen before it starts.

6. As a developer on a large PR, I want review-agent findings returned as compact structured records rather than prose with embedded code quotes, so that the parent context stays within budget.

7. As a developer, I want the structured finding to include severity, file path, line range, a short title, and one-paragraph comment body, so that the ADO Writer has everything it needs to post the Inline Comment without re-querying the agent.

8. As a developer, I want the ADO Fetcher to encapsulate all ADO API calls needed to retrieve PR metadata, iterations, changed files, and the raw diff, so that the orchestrator does not contain any platform-specific shell commands.

9. As a developer, I want the ADO Writer to encapsulate all ADO write-back operations — posting Inline Comments, patching Thread status, and posting the Review Summary or delta reply — so that those operations are not scattered across the orchestrator.

10. As a developer, I want the Re-review Coordinator to own the partial-run check, so that the orchestrator does not need to know about completion markers or fallback logic.

11. As a developer on a re-review PR with no new commits, I want the Re-review Coordinator to exit early and list outstanding pending threads in the console, so that no ADO comments are posted unnecessarily.

12. As a developer, I want adding a future operating mode (e.g. post-merge audit) to require only a new agent and a small branch in the orchestrator, so that the monolith problem does not recur.

13. As a plugin operator, I want all four re-review Node.js modules (detect-prior-review, classify-thread, match-finding, parse-signature) to remain in the plugin's scripts directory unchanged, so that the split does not alter tested behaviour.

14. As a plugin operator, I want the orchestrator to validate prerequisites (Azure CLI, `azure-devops` extension, `pr-review-toolkit` availability) before entering any mode, so that failures are surfaced early and consistently.

15. As a plugin operator, I want the Bot Signature format and detection prefix to remain unchanged after the split, so that existing Review Threads on live PRs are still recognised correctly.

16. As a developer reading the codebase, I want each agent to have a single clearly named responsibility, so that I know exactly which file to open when debugging an ADO write error versus a thread-classification error.

17. As a developer running a first-review, I want the ADO Fetcher and the Doc Context Orchestrator to run concurrently as before, so that the split does not increase wall-clock time.

18. As a developer, I want the guidance for compact review-agent output to live in the orchestrator's Step 8 prompt rather than in the `pr-review-toolkit` agent definitions, so that the toolkit remains an unmodified read-only dependency.

19. As a plugin operator, I want the existing test suite for the four re-review modules to continue passing after the split with no changes, so that I have confidence the refactor is behaviour-preserving.

20. As a developer, I want the pre-PR mode to use the same `pr-review-toolkit` review aspect agents as the ADO modes, so that review quality is consistent regardless of whether a PR URL is provided.

## Implementation Decisions

### Operating modes

The orchestrator detects one of three modes on startup:

- **Pre-PR mode** — no PR URL provided; targets the local branch diff; no ADO write-back.
- **First-review mode** — PR URL provided; no prior Bot Signature found in the PR's threads.
- **Re-review mode** — PR URL provided; prior Bot Signature detected.

Mode detection happens within the first ~50 lines of the orchestrator. Once detected, the orchestrator delegates entirely.

### Focused agents

Three new agents live in the plugin's `.agents/` directory:

**ADO Fetcher** — encapsulates all ADO read operations: PR metadata, iterations, changed files list, and raw diff. Returns a structured context block consumed by the orchestrator for passing to review agents and the writer. Used by first-review and re-review modes only.

**Re-review Coordinator** — owns everything in the current re-review path: prior thread detection (calling `detect-prior-review`), partial-run check, early exit for no new commits, Thread Classification (calling `classify-thread`), finding matching (calling `match-finding`), and reply posting to classified threads. The four Node.js modules remain in `scripts/re-review/` and are called from this agent, not inlined. Used only in re-review mode.

**ADO Writer** — owns all ADO write-back: posting new Inline Comment threads for fresh findings, patching Thread status to fixed for addressed findings, posting reply comments for disputed and pending findings with new evidence, posting the Review Summary on first-review, posting the delta reply on re-review, and posting the completion marker. Used by first-review and re-review modes.

### Compact sub-agent output contract

Review aspect agents (`pr-review-toolkit:code-reviewer`, `silent-failure-hunter`, etc.) are instructed via the orchestrator's prompt to return findings as a structured list. Each finding carries: severity, file path, start line, end line, title (one line), and body (one paragraph — the text posted as the ADO comment). No prose reasoning, no code quotes in the return value. This guidance is in the orchestrator's prompt only; the toolkit agent definitions are not modified.

### pr-review-toolkit as read-only dependency

No files in `pr-review-toolkit` are created or modified. All new agents live in the `pr-review` plugin's own `.agents/` directory.

### Re-review module ownership

The four Node.js modules in `scripts/re-review/` remain in the plugin. Lifting them to `pr-review-toolkit` as a shared library is deferred until a second write-back platform (GitHub) is built, at which point a canonical thread shape can be defined from real constraints. This is documented in ADR 0013 (`apps/claude-code/pr-review/docs/adr/0013-orchestrator-split-for-review-pr.md`).

### Doc Context integration

The Doc Context Orchestrator agent and its pipeline (ADO Fetcher fetches work-item IDs, Orchestrator spawns sub-agents, Synthesizer produces `DOC_CONTEXT`) are unchanged. The ADO Fetcher agent absorbs the work-item ID fetch that currently lives inline in Step 4a.

## Testing Decisions

### What makes a good test

Tests assert the external behaviour of each module given controlled inputs — no implementation detail inspection, no internal branching tests. Inputs are plain JavaScript objects or JSON fixtures. A test reads as a sentence: "given a findings list with two items, the writer posts two inline threads."

### Modules under test

The four existing re-review modules (`detect-prior-review`, `classify-thread`, `match-finding`, `parse-signature`) already have a test suite and must continue passing unchanged. No new unit tests are required for the three new agents — their behaviour is best verified by integration against a real ADO PR (smoke test). If a new pure function is extracted during the refactor (e.g. mode detection logic), a unit test for that function is appropriate.

### Prior art

The existing test structure mirrors `packages/release-tools/scripts/verify-changelog.test.mjs` and `bump-version.test.mjs` — `node:test` built-in, no external deps, fixtures as imported JSON, assertions via `node:assert/strict`.

## Out of Scope

- GitHub write-back support (separate future feature).
- Normalising re-review modules to a canonical cross-platform thread shape (deferred
  until GitHub write-back is built — see ADR 0013).
- Changes to `pr-review-toolkit` agent definitions.
- Token-budget monitoring or automatic truncation of large diffs.
- Any change to the Bot Signature format or detection prefix.
- Changes to the four re-review Node.js module interfaces.
- Automated performance benchmarking of parent context token usage.

## Further Notes

**ADR 0013** (`apps/claude-code/pr-review/docs/adr/0013-orchestrator-split-for-review-pr.md`) records the full rationale and alternatives considered for this decision.

**CONTEXT.md** has already been updated with the three operating modes, three orchestration agent terms, and their relationships.

**GitHub prompt as reference.** The `.claude/prompts/pr-review-workflow.prompt.md` file is the model for what the thin orchestrator should look like — it coordinates review activities in ~80 lines by staying a pure coordinator. The refactored `review-pr.md` should be structurally similar.

---

## Agent Brief

> _This was generated by AI during triage._

**Category:** enhancement
**Summary:** Refactor the `review-pr` command into a thin orchestrator that delegates to three focused agents — ADO Fetcher, Re-review Coordinator, and ADO Writer — and add a pre-PR operating mode.

**Current behavior:**
`review-pr.md` is a ~1000-line monolith that handles orchestration, ADO platform integration, and re-review state management in a single command file. Every invocation loads the full file into context, and parallel review-agent results flowing back push average PR reviews past 100 K parent-context tokens. There is no mode for reviewing code before a PR exists.

**Desired behavior:**
`review-pr.md` becomes a thin orchestrator of approximately 200 lines. On startup it detects one of three operating modes:

- **Pre-PR mode** (no PR URL): diffs the local branch, runs review aspect agents from `pr-review-toolkit`, and presents findings in the Claude interface. No ADO calls are made.
- **First-review mode** (PR URL, no prior Bot Signature detected): delegates ADO reads to the ADO Fetcher agent, runs review aspect agents, delegates all ADO writes to the ADO Writer agent.
- **Re-review mode** (PR URL, prior Bot Signature detected): same as first-review, but additionally invokes the Re-review Coordinator agent to handle prior-thread classification, finding matching, and reply posting to classified threads before the ADO Writer runs.

Each of the three new agents lives in the plugin's own `.agents/` directory. `pr-review-toolkit` is not modified (it is a read-only dependency). The four existing re-review Node.js modules (`detect-prior-review`, `classify-thread`, `match-finding`, `parse-signature`) remain in the plugin's `scripts/re-review/` directory and are called from the Re-review Coordinator agent.

Review aspect agents are instructed via the orchestrator's Step 8 prompt to return compact structured findings (severity, file path, start line, end line, one-line title, one-paragraph body) rather than prose with embedded code quotes. This guidance lives in the orchestrator prompt only.

**Key interfaces:**

- `review-pr` command orchestrator — validates prerequisites, detects mode within first ~50 lines, delegates entirely; carries no ADO shell commands
- ADO Fetcher agent — returns a structured context block: PR metadata, latest iteration ID, prior commit ID (re-review only), changed files list, raw diff, and work-item IDs for Doc Context
- Re-review Coordinator agent — receives the ADO Fetcher context and prior-threads data; produces classified thread list and executes reply/resolution actions; delegates to `detect-prior-review`, `classify-thread`, and `match-finding` modules
- ADO Writer agent — receives the findings list and PR context; posts all Inline Comment threads, patches thread statuses, posts the Review Summary or delta reply, posts the completion marker
- Compact finding schema: `{ severity, filePath, startLine, endLine, title, body }`
- Bot Signature constant: `🤖 *Reviewed by Claude Code*` prefix — must remain unchanged

**Acceptance criteria:**

- [ ] The `review-pr` command file is ≤ 200 lines and contains no `az devops invoke` calls
- [ ] Running the command without a URL enters Pre-PR mode; findings appear in the Claude interface; no ADO threads are posted
- [ ] Running with a URL where no prior Bot Signature exists enters First-review mode and posts a full Review Summary and Inline Comments to ADO
- [ ] Running with a URL where prior Bot Signature exists enters Re-review mode; the Re-review Coordinator correctly classifies threads and posts replies
- [ ] The orchestrator logs the detected mode (Pre-PR / First-review / Re-review) before delegating
- [ ] The four existing re-review module unit tests pass unchanged after the refactor
- [ ] The ADO Fetcher and Doc Context Orchestrator still run concurrently (no wall-clock regression for first-review)
- [ ] The Bot Signature format and detection prefix are unchanged
- [ ] `pnpm test` passes; `pnpm format` produces no diff

**Out of scope:**

- GitHub write-back support
- Normalising re-review modules to a canonical cross-platform shape (deferred per ADR 0013)
- Any changes to `pr-review-toolkit` agent definitions
- Token-budget monitoring or automatic diff truncation
- Changing the Bot Signature format or detection prefix
- Changing the four re-review Node.js module interfaces
