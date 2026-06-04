# unic-pr-review — Plugin PRD

## Problem Statement

When I review PRs at Unic, I need to check not just whether the code is correct in isolation but whether it actually implements the intent captured in the linked Work Item — a User Story's Acceptance Criteria, a Bug's Repro Steps, or a Confluence page the Work Item references. Today this means context-switching between Azure DevOps, Azure Boards or Jira (different projects use different trackers), and Confluence, then keeping the intent in my head while I read the diff. The existing `pr-review` Plugin reviews the code well but doesn't pull intent in a way that's usable across both Azure Boards and Jira projects, doesn't filter Findings by confidence, and posts everything without giving me a per-Finding say in what lands on the PR.

## Solution

A standalone Claude Code Plugin, `unic-pr-review`, that:

1. Detects whether I'm reviewing a real ADO PR (URL given) or my local branch (Pre-PR mode).
2. Pulls every linked Work Item from Azure Boards or Jira (Atlassian Cloud, same credentials as Confluence), extracts and fetches every Confluence link inside each Work Item, and synthesises a labelled Intent Brief.
3. Fans out to six Review Aspect sub-agents in parallel (the Intent Checker runs first as a separate non-aspect agent), each aspect agent seeded with the Intent Brief, each emitting Findings with a 0-100 Confidence Score.
4. Surfaces an Intent Check block at the top of the Review Summary listing per-Acceptance-Criterion verdicts (addressed / partially addressed / unaddressed), never blocking.
5. Previews everything in my terminal by default. When I pass `--post`, walks me through each Finding one at a time with accept / edit / skip choices, then posts only what I approved as ADO Threads in Active status. `--yes` bulk-accepts.
6. On Re-review, computes a delta diff from the prior reviewed Revision (state read from the Bot Signature in the PR — no local cache), classifies existing Review Threads into addressed / disputed / pending / obsolete, and replies or resolves instead of duplicating.

Ships at v2.0.0 to mark a clean break from the existing `pr-review` Plugin, which will be retired after acceptance testing.

## User Stories

1. As a Unic reviewer working on an ADO project, I want to run `/unic-pr-review:review-pr <ADO PR URL>` and have all linked Azure Boards Work Items fetched automatically, so that the Review reflects the actual business intent.
2. As a Unic reviewer working on a Jira-tracked project, I want the same command to pull Jira issues from URLs my agent extracted from the PR description or that I pasted in Pre-PR mode, so that I'm not blocked by the project's choice of tracker.
3. As a Unic reviewer, I want both Jira and Confluence to authenticate with my single Atlassian email and API token via `~/.unic-confluence.json`, so that I don't have to maintain two near-identical credential files.
4. As a Unic reviewer reviewing a PR linked to a User Story, I want the Intent Brief to break the Story into its description and its Acceptance Criteria, so that the Intent Check block can give me a per-AC verdict.
5. As a Unic reviewer reviewing a PR linked to a Bug, I want the Intent Brief to surface Repro Steps and Expected vs Actual Behavior instead, so that the Review can check whether the fix actually changes the observable behaviour the bug described.
6. As a Unic reviewer, I want a top-of-summary Intent Check block listing each Work Item with `AC 1: addressed`, `AC 2: partially addressed`, `AC 3: unaddressed`, so that I see intent gaps at a glance.
7. As a Unic reviewer, I want the Intent Check to never block the Review — only flag — so that I retain final judgment.
8. As a Unic reviewer, I want every Finding tagged with a 0-100 Confidence Score and bucketed into Critical (90-100), Important (80-89), or Minor (60-79), so that low-confidence Findings don't pollute the Summary.
9. As a Unic reviewer, I want Findings below 60 confidence dropped entirely, so that I don't read agent noise.
10. As a Unic reviewer, I want the Review Summary structured as Notices block, Intent Check, Critical, Important, Minor, What's Good — so that I can skim consistently across PRs.
11. As a Unic reviewer, I want each summary Finding rendered as `**[filePath:startLine]** title`, so that I can click straight to the code.
12. As a Unic reviewer, I want Inline Comments rendered as `severity emoji + title`, then prose diagnosis with `Either X if Y, or Z` options, then the Bot Signature footer, so that comments read consistently.
13. As a Unic reviewer, I want a GitHub-style ` ```suggestion ` block included ONLY when the fix is a clean drop-in (mechanical, no judgment call), so that ADO's apply-suggestion UI actually works without me checking each one.
14. As a Unic reviewer, I want the default run to write nothing — just print the preview in the terminal — so that running the Plugin is always safe.
15. As a Unic reviewer, I want `--post` to enter an interactive Approval Loop that walks me through every Finding with accept / edit / skip choices, so that I have a per-Finding say.
16. As a Unic reviewer, I want `--post --yes` to bulk-accept and post everything without prompts, so that batch posting is one command.
17. As a Unic reviewer, I want a clear error when `--post` is given in a non-interactive context without `--yes`, so that the Plugin never silently posts unreviewed Findings in CI.
18. As a Unic reviewer, I want to run the Plugin without a PR URL on a local feature branch (Pre-PR mode) and have it compute the diff against `origin/HEAD` (falling back to `develop`, `main`, `master`), so that I can review my own work before opening a PR.
19. As a Unic reviewer in Pre-PR mode, I want the Plugin to prompt me for optional Work Item URLs (comma-separated, Jira or ADO Boards) and Confluence URLs, so that intent is checked even before a PR exists.
20. As a Unic reviewer in Pre-PR mode, I want pressing Enter at the prompt to skip intent gathering, so that quick lint-style reviews stay quick.
21. As a Unic reviewer, I want the Plugin to route pasted URLs by path — `/browse/KEY-123` to Jira, `/wiki/` to Confluence — so that I don't have to declare which kind each URL is.
22. As a Unic reviewer doing a re-review on a PR I've already reviewed, I want the Plugin to detect this from the prior `🤖 Reviewed by Claude Code — Iteration N` Bot Signature, so that I never need to track state myself.
23. As a Unic reviewer doing a re-review, I want the Plugin to analyse only the diff between the prior reviewed Revision and the current Revision, so that re-review cost scales with the delta.
24. As a Unic reviewer doing a re-review, I want each existing Review Thread classified as addressed, disputed, pending, or obsolete, so that the Plugin can auto-resolve `addressed` threads, leave `disputed` alone, and reply on `pending`.
25. As a Unic reviewer doing a re-review, I want the Plugin to post Replies to existing Threads instead of opening duplicates, so that the PR conversation history stays coherent.
26. As a Unic reviewer doing a re-review, I want the Review Summary General Comment rewritten in place (not appended), so that a PR has exactly one Summary at any time.
27. As a Unic reviewer doing a re-review, I want Findings unaddressed across 2+ Iterations escalated to a top-of-Summary "Persistent unaddressed findings" notice with Thread links, so that long-running PRs don't quietly accumulate ignored issues.
28. As a Unic reviewer, I want the Plugin to identify its prior comments by the authenticated `az devops` user ID, cached at startup — so that human comments can never be mistaken for prior reviews.
29. As a Unic reviewer, I want the Plugin to hard-stop with a clear message if a Work Item links to a Confluence page and Confluence is unreachable, so that an incomplete Intent Brief never silently corrupts a Review.
30. As a Unic reviewer, I want empty intent (no Work Items linked, none pasted) to proceed without a hard stop — just an omitted Intent Check block — so that the absence of intent is a legitimate state.
31. As a Unic reviewer, I want a `setup-confluence` Slash Command that walks me through writing `~/.unic-confluence.json` (URL, username, token) interactively with chmod 600, so that first-time setup needs no manual file editing.
32. As a Unic reviewer, I want a `setup-jira` Slash Command that adds an optional `jiraUrl` field to the same file (defaulting to my Confluence tenant URL), so that Jira fetching works without a second credential file.
33. As a Unic reviewer, I want a `setup-azure` Slash Command that writes `~/.unic-azure.json` with my ADO PAT, so that the Plugin works without me hand-editing JSON.
34. As a Unic reviewer, I want a `doctor` Slash Command that verifies `az` CLI presence, the `azure-devops` extension, `az devops login` status, that `az devops user show --user me` resolves (so identity caching will succeed at review time), Confluence reachability, and (only when `jiraUrl` is configured) Jira reachability, so that I can debug setup issues without running a Review.
    > **Superseded by [ADR-0006](../../adr/0006-iteration-state-in-pr.md) (2026-06):** the `az devops user show --user me` check was removed — that surface 404s for non-admin reviewers. `doctor` now runs five checks and re-review detection keys on the hidden Iteration Marker, not identity.
35. As a Unic reviewer on a project without Jira, I want `doctor` to stay silent about Jira, so that project-irrelevant warnings don't appear.
36. As a Unic reviewer, I want env vars `CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`, `JIRA_URL`, `AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PAT` to override the Credential Files, so that CI runs without writing to home directories.
37. As a maintainer, I want the Plugin to live at `apps/claude-code/unic-pr-review/` in the existing monorepo, with the standard `bump` / `sync-version` / `tag` / `verify:changelog` scripts wired up, so that release management follows the established workflow.
38. As a maintainer, I want the Plugin's first release to be v2.0.0, so that the version reflects the lineage from `pr-review` v1.x and clearly signals "next-generation" to existing users.
39. As a maintainer, I want a CHANGELOG.md present from v2.0.0 with the initial entry, so that `verify:changelog` passes on the first PR.
40. As a maintainer, I want a `providers/` abstraction prepared as a folder-bundle layout (`providers/<name>/{provider.mjs, manifest.json, README.md, fixtures/, tests/}`, even if only `providers/azure_devops/` is implemented in v2), so that adding GitHub or GitLab support later is a drop-in PR with co-located fixtures and tests.
41. As a maintainer, I want each Source Platform Provider to own its work-item discovery contract (`provider.discoverWorkItems(prMetadata) → [{ id, type, url, raw }]`) — for ADO this reads the PR's native Work Item field, for GitHub/GitLab future Providers it will use their native linking mechanisms — so that the Intent Checker stays Source-Platform-agnostic and consumes one normalised list.
42. As a Unic reviewer, I want the Approval Loop's resumable state to live under `<cwd>/.unic-pr-review/<key>/state.json` (with a sibling `.gitignore` containing `*` written on first use so the directory self-ignores), deleted on a successful Writer run and preserved on Ctrl-C, so that I can resume an interrupted review without re-running the agents and without polluting the host repo's tracked files.
43. As a maintainer, I want the Bot Signature wording `🤖 Reviewed by Claude Code — Iteration N` to live in exactly one module (`scripts/lib/signature.mjs`), with both the parser and the renderer footer importing from it, so that detection and rendering can never drift apart.
44. As a Unic reviewer, I want each of the six aspect sub-agents to have a distinctive name and colour in Claude Code's UI, so that when the fan-out runs I can tell them apart at a glance.

## Implementation Decisions

### Modules

All modules are designed and built from scratch for this Plugin. The Plugin takes **no code, no prompts, no fixtures, and no soft dependency** on the prior `pr-review` Plugin. Where responsibility happens to overlap with something the prior Plugin did, the module is re-derived from first principles against this PRD and the ADRs.

- **Orchestrator (`commands/review-pr.md`)** — argument parsing, mode detection (URL → ADO-mode, no URL → Pre-PR), Doctor-style preflight, provider dispatch, sub-agent fan-out, terminal preview rendering, Approval Loop, dispatch to ADO Writer. Stays thin (≤ 200 lines).
- **ADO Fetcher (`agents/ado-fetcher.md`)** — every ADO read via `az devops invoke`: PR metadata, Revisions, Threads, changed files, raw diff. Reads the PR's linked Work Items from the PR's own Work Item field (not by regex-scraping the description). Owns Mode detection from the thread data.
- **ADO Writer (`agents/ado-writer.md`)** — every ADO write via `az devops invoke`: opening Review Threads in Active status, posting Replies, patching Thread status, posting and rewriting the Review Summary General Comment. Consumes the structured plan from the Re-review Coordinator (in Re-review mode) and the approved-Findings JSON from the Approval Loop (in `--post` mode).
- **Intent Checker (`agents/intent-checker.md`)** — first sub-agent to run. Receives the normalised work-item list from the active Provider plus any URLs pasted in Pre-PR, routes each Atlassian URL by path (Jira `/browse/` vs Confluence `/wiki/`), invokes the Atlassian Fetcher script for those, branches Work Items by type (Story → description + ACs; Bug → repro + expected/actual), and is trusted to self-deduplicate and consolidate across sources. Emits a structured Intent Brief plus per-AC verdicts. No Bot Signature footer (rendering is centralised — see Schemas).
- **Review Aspect agents (`agents/*.md`)** — six sub-agents written from scratch in this Plugin's own voice, each with a distinctive name and colour for in-terminal disambiguation, each embedding the Confidence-Score rubric verbatim, each consuming the Intent Brief as a preamble: `code-reviewer`, `silent-failure-hunter`, `type-design-analyzer`, `pr-test-analyzer`, `comment-analyzer`, `code-simplifier`. Conditional spawning by changed-file analysis (`code-reviewer` always; the others conditionally). In Re-review mode each receives prior Findings as context and emits a per-prior-Finding `priorVerdict` (`fixed` / `partial` / `ignored`) alongside any new Findings.
- **Re-review Coordinator (`agents/re-review-coordinator.md`)** — LLM agent invoked only when the ADO Fetcher reports a prior Bot Signature found. Trusted to merge aspect-agent verdicts, ADO Thread status, and human-Reply signals into the four Thread Classifications (`addressed` / `disputed` / `pending` / `obsolete`), decide reply-vs-new-Thread per Finding, and produce a structured plan `{ threadActions: [...], persistentUnaddressed: [...], freshFindings: [...] }` that the ADO Writer consumes mechanically. No deterministic rule table, no drift constants — by design (motto: get out of the models' way).
- **Providers (`providers/<name>/`)** — folder bundle per Source Platform. Each bundle exports a `provider.mjs` exposing `name`, `label`, `prUrlPattern`, `parsePrUrl(url)`, `agents.{fetcher, writer}`, and `discoverWorkItems(prMetadata) → [{ id, type, url, raw }]`. v2 ships `providers/azure_devops/` only; `providers/index.mjs` exposes `detectProvider(url)`. Work-item discovery is platform-specific (ADO uses the PR's Work Item field; GitHub/GitLab will use their respective native linkages when added).
- **Atlassian Fetcher (`scripts/atlassian-fetch.mjs`)** — Node script using Node's built-in global `fetch` (Node 22+), reads `~/.unic-confluence.json`, fetches Confluence pages or Jira issues via their REST APIs. Distinguishes by URL path (`/browse/` → Jira, `/wiki/` → Confluence). Self-contained; called by the Intent Checker via Bash.
- **Approval Loop (`scripts/approval-loop.mjs`)** — Node script that reads a JSON Findings file, walks each Finding interactively (accept / edit / skip), and writes an approved-Findings JSON file for the ADO Writer to consume. Detects non-TTY stdin and aborts cleanly when `--post` is given without `--yes`. Resumable across Ctrl-C: state persisted in `<cwd>/.unic-pr-review/<key>/state.json`, where the directory self-ignores via a `<cwd>/.unic-pr-review/.gitignore` containing `*`. Key is `sha16(pr-url)` in ADO modes, `sha16(cwd + ' ' + branch)` in Pre-PR. State directory is deleted on successful Writer run; preserved on interruption. `--yes` writes state too (one code path; the flag just auto-fills decisions and skips prompting).
- **Setup Wizards (`scripts/setup-confluence.mjs`, `scripts/setup-jira.mjs`, `scripts/setup-azure.mjs`)** — Interactive credential writers, `chmod 600` on output where the platform supports it (Windows behaviour: warn but don't fail).
- **Doctor (`scripts/doctor.mjs`)** — Verifies `az` CLI, `azure-devops` extension, `az devops login` status, Confluence reachability, Jira reachability (only if configured). Used both as a Slash Command and as preflight inside `review-pr`.
- **Pure-function library (`scripts/lib/`)** — `signature.mjs` (single source of truth for the load-bearing wording `🤖 Reviewed by Claude Code — Iteration N` — both the parser and the renderer footer import from here), `severity-bucketer.mjs`, `mode-detector.mjs`, `changed-file-analyser.mjs`, `review-summary-renderer.mjs`, `inline-comment-renderer.mjs`, `credentials.mjs`, `cache-paths.mjs`, `notices.mjs`. Renderers own the Review Summary and Inline Comment templates and append the Bot Signature footer — agents never emit the footer themselves.

### Interfaces

- **Slash Commands**: `/unic-pr-review:review-pr [URL]`, `/unic-pr-review:doctor`, `/unic-pr-review:setup-confluence`, `/unic-pr-review:setup-jira`, `/unic-pr-review:setup-azure`.
- **Flags on `review-pr`**: `--post` (enter Approval Loop), `--yes` (bulk-accept; requires `--post`).
- **Credential Files**: `~/.unic-confluence.json` (`{ url, username, token, jiraUrl? }`, chmod 600), `~/.unic-azure.json` (`{ orgUrl, pat }`, chmod 600). Env-var overrides per CONTEXT.md.

### Architectural decisions

The load-bearing decisions are captured as ADRs in [`apps/claude-code/unic-pr-review/docs/adr/`](../../adr/):

- ADR-0001 — Multi-source intent gathering with shared Atlassian credentials
- ADR-0002 — Confidence-scored Findings with explicit Severity thresholds
- ADR-0003 — Interactive Approval Loop as the default write path
- ADR-0004 — Hard-stop when intent sources are unreachable
- ADR-0005 — `az` CLI for Azure DevOps, custom HTTP for Atlassian
- ADR-0006 — Iteration state lives in the PR, not locally
- ADR-0007 — Re-review uses a delta diff, not a full PR diff
- ADR-0008 — Conditional sub-agent spawning over per-file chunking
- ADR-0009 — Pre-PR mode is a peer operating mode, not a flag
- ADR-0010 — Provider as a folder bundle. Landed with issue #148 (ADO first-review preview).
- ADR-0011 — Intent Assessor for live AC verdicts. Splits intent gathering from intent assessment: the Intent Checker emits an `intentCheck` skeleton with verdicts unset; the new Intent Assessor agent (`agents/intent-assessor.md`) assesses each Acceptance Criterion against the diff; `scripts/lib/intent-check-merger.mjs` overlays the assessor's verdicts onto the skeleton.

ADR-0001 carries an amendment noting that work-item discovery is a Provider contract; the amendment landed with issue #148. Each Provider owns `discoverWorkItems(prMetadata)` and the Intent Checker consumes the normalised list. The Intent Checker stays Source-Platform-agnostic.

The Intent Assessor (per ADR-0011) is **not** a Review Aspect — it is spawned by intent presence (`intentBrief` defined and the skeleton non-empty), never by changed-file categories, and is never added to the aspect `SPAWN_TABLE`. Any future work that touches intent gathering or the orchestrator's spawn fan-out must preserve this separation and the merger flow.

### Schema: Review Summary

```
{NOTICES_BLOCK — prose, optional}

### Intent Check (optional — omitted when no Work Items linked)

- **<Work Item title> (<ID>)**
  - AC 1: addressed
  - AC 2: partially addressed
  - AC 3: unaddressed

### 🔴 Critical (N found)
- **[filePath:startLine]** title

### 🟠 Important (N found)
- **[filePath:startLine]** title

### 🟡 Minor / Suggestions
- title

### ✅ What's good
- positive observation

---
{BOT_SIGNATURE_FOOTER}
```

`{BOT_SIGNATURE_FOOTER}` resolves to the load-bearing wording owned by `scripts/lib/signature.mjs` (see ADR-0006). Renderers must not inline the literal — the placeholder pattern is the tripwire that keeps detection (the Bot Signature parser) and rendering (this schema) from drifting apart.

### Schema: Inline Comment

````
{severity emoji} {title}

{prose diagnosis + fix options}

[OPTIONAL: ```suggestion block — conservative use only]

---
{BOT_SIGNATURE_FOOTER}
````

### Schema: Credentials

```json
// ~/.unic-confluence.json
{
  "url": "https://uniccom.atlassian.net",
  "username": "user@unic.com",
  "token": "ATATT3xFfGF0…",
  "jiraUrl": "https://uniccom.atlassian.net"
}
```

```json
// ~/.unic-azure.json
{
  "orgUrl": "https://dev.azure.com/uniccom",
  "pat": "…"
}
```

### Specific interactions

> All bullets below describe planned behaviour. Nothing in this section ships with this PRD; each interaction lands with the slice that exercises it (see issues #143–#152). Tense remains indicative for readability — when reading post-implementation, treat these as the canonical contract for what the running plugin must do.

- **Identity caching**: the orchestrator runs `az account show` plus `az devops user show --user me` once at startup, caches `{ id, displayName }` for the duration of the run, and the ADO Fetcher uses `id` to filter comments by author when detecting prior Bot Signatures.
  > **Superseded by [ADR-0006](../../adr/0006-iteration-state-in-pr.md) (2026-06):** identity caching was removed entirely. The ADO Fetcher filters prior bot threads by the hidden Iteration Marker (`<!-- unic-pr-review:iteration=N -->`), not author identity.
- **Re-review fallback**: if the Bot Signature parser finds a prior reviewed Revision that no longer exists in the PR's Revision history (force-push), the Plugin emits a warning Notice and falls back to First-review mode for this run.
- **Intent Checker order**: spawned first, run to completion, output passed verbatim as a preamble to every aspect agent in the same Task fan-out batch.
- **Approval Loop wire format**: Findings serialised to JSON between sub-agent fan-out and Approval Loop; approved JSON consumed by ADO Writer. Allows the loop to be a thin Node script, not part of the Claude agent loop. State file is repo-local under `<cwd>/.unic-pr-review/<key>/state.json` with stable Finding ordering (severity bucket → file → startLine → stable id) so resume is deterministic.
- **Bot Signature wording is owned in one place**: `scripts/lib/signature.mjs` exports both the parser (for the ADO Fetcher / Re-review Coordinator) and the footer renderer (for the Review Summary and Inline Comment renderers). The load-bearing exact wording `🤖 Reviewed by Claude Code — Iteration N` lives only there. Detection and rendering cannot drift apart.
- **Work-item discovery is a Provider contract**: the active Provider exposes `discoverWorkItems(prMetadata) → [{ id, type, url, raw }]`. For ADO, this reads the PR's Work Item field (not regex-scraping the PR description). The Intent Checker consumes the normalised list and stays Source-Platform-agnostic.
- **Aspect agents emit structured fields, not final-form text**: each Finding carries `{ severity, confidence, filePath, startLine, endLine, title, body, suggestion?, priorVerdict? }` (no footer). The Re-review Coordinator emits `{ threadActions, persistentUnaddressed, freshFindings }` (no footer). The Intent Checker emits structured `intentCheck` (no footer). Renderers assemble final markdown and append the footer.

## Testing Decisions

Tests live under `tests/`, use `node:test`, and follow the pure-function-plus-stubbed-fetch convention used elsewhere in this monorepo (`apps/claude-code/unic-confluence/scripts/`, `packages/release-tools/scripts/*.test.mjs`).

What makes a good test for this Plugin: tests assert observable external behaviour — what gets written to ADO, what gets rendered in the terminal, which sub-agents get spawned, which approval-state transitions are reached — and not how the orchestrator achieves it.

### Modules to test

- **Signature module** (`scripts/lib/signature.mjs`) — single source of truth for the load-bearing wording. Parser: input PR Thread payloads → parsed `{ priorRevisionId, priorAuthorUserId }`; covers no-prior-signature, force-push-broke-the-revision, and CRLF cases. Renderer: emits the exact footer string. Round-trip property test: renderer output parses cleanly back to `{ revisionId }`.
  > **Superseded by [ADR-0006](../../adr/0006-iteration-state-in-pr.md) (2026-06):** `priorAuthorUserId` was dropped from the parsed shape. The parser now returns `{ priorRevisionId, priorIteration }` keyed solely on the Iteration Marker, and the renderer embeds that marker on its own line.
- **Atlassian Fetcher** — URL routing (Jira vs Confluence), credential resolution (file vs env vars), response parsing (Story vs Bug, AC extraction, Confluence excerpt extraction). Tested as a pure-function library with fetch stubbed.
- **Approval Loop** — Finding-state-machine transitions (accept / edit / skip), non-TTY abort, `--yes` bulk-accept, resumability after interruption, head-SHA mismatch prompt on resume, `<cwd>/.unic-pr-review/<key>/` write + `.gitignore` self-ignore, cleanup on Writer success. Tested by piping scripted stdin and asserting output JSON + state-file contents.
- **Mode detector** — input `{ hasUrl, hasPriorSignature, revisionsAvailable }` → mode literal (`pre-pr` / `first-review` / `re-review` / `first-review-fallback`). Pure-function table-driven.
- **Severity bucketer** — input confidence integer → severity bucket name (and the `<60` drop). Pure-function.
- **Changed-file analyser** — input changed-files list + a small content sample → set of aspect agents to spawn. Pure-function table-driven.
- **Renderers** (`review-summary-renderer.mjs`, `inline-comment-renderer.mjs`) — input structured Findings / Coordinator plan → exact markdown blobs including the Bot Signature footer drawn from `signature.mjs`. Snapshot-style fixtures.
- **Setup Wizards** — file writing under `chmod 600` (where supported), idempotent re-runs, env-var override precedence. Tested against a temp HOME. Windows path branches assert "warn but don't fail".
- **Doctor** — preflight predicates (`az` present, extension present, `az devops login` valid, Confluence ping, Jira ping when configured). Tested with each predicate stubbed.
- **Provider module** (`providers/azure_devops/`) — `prUrlPattern` match/non-match, `parsePrUrl` parsing, `discoverWorkItems` against stubbed PR metadata fixtures (with-WI, without-WI, multiple-WI).

### Modules NOT tested in v2

- The Claude Code sub-agent prompts themselves. Their behaviour is validated by running the Plugin against real PRs during acceptance testing; unit-testing prompt text is low value.
- The ADO Writer's `az devops invoke` calls beyond a smoke test that every command path exists in the fixture inventory.
- The Re-review Coordinator's classification logic. It is an LLM agent (motto: get out of the models' way) and is validated by acceptance testing on real PRs.

## Out of Scope

- GitHub and GitLab Platform support. The `providers/` abstraction ships as a folder bundle layout (`providers/<name>/`) but only `providers/azure_devops/` is implemented in v2.
- Jira issue link traversal (following "is blocked by", "relates to"). v2 fetches only the pasted or directly-linked issue.
- Author-side commands (composing PR descriptions, opening PRs, requesting reviewers).
- A standalone web UI or MCP server. The Slash Command and the CLI are the only surfaces.
- A separate `--dry-run` flag. The default (no `--post`) is the dry-run.
- Persistent local state across runs. Iteration tracking is signature-based per ADR-0006.
- Voting on PRs (approve / reject after Review). Out of scope until a concrete use case is filed.
- Multi-tenant Atlassian (different Confluence and Jira hosts). v2 assumes one tenant per `~/.unic-confluence.json`.

## Further Notes

- The Plugin retires the existing `apps/claude-code/pr-review` Plugin after acceptance testing. As of 2026-05 both coexist in the monorepo as **fully independent** Plugins — `unic-pr-review` shares no code, no prompts, no fixtures, and no soft dependency with `pr-review`. The maintainer will delete `pr-review` once `unic-pr-review` proves itself on the two target projects (one ADO, one Jira).
- The six aspect agents are written from scratch in this Plugin's own voice with our Confidence-Score rubric embedded verbatim. The conditional-spawning pattern is loosely inspired by Anthropic's `pr-review-toolkit`, but we take no soft dependency and copy no prompts.
- The root `CONTEXT-MAP.md` must be updated to add this Plugin's `CONTEXT.md` — that update is tracked by issue #143 (plugin scaffold), which also creates the `CONTEXT.md` file itself.
- The Plugin's `plugin.json` keywords include `pr-review`, `azure-devops`, `jira`, `confluence`, `code-review`, `unic`.
