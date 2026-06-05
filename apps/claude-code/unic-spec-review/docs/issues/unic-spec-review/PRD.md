---
title: 'unic-spec-review plugin: adversarial review of web specifications'
created: 2026-06-05
---

# PRD: unic-spec-review plugin

**Status:** ready-for-agent
**Category:** feature
**Scope:** app:unic-spec-review
**GitHub:** [#200](https://github.com/unic/unic-agents-plugins/issues/200)

---

## Problem Statement

Web specifications at Unic live in Confluence, usually split across a parent page and several child pages, with design intent in Figma (heavily annotated by UX designers) and a current behaviour visible on the live production system. Specs are written by different people, reviewed by different people, and frequently drift from the designs, from the live system, and from what the implementing stack can actually deliver.

Today that review is manual and inconsistent. A reviewer must open every Confluence page, read every comment, cross-check every Figma frame and its annotations, compare against production, and reason about feasibility against a codebase they may not know well. Nothing enforces completeness, nothing captures the reasoning, and two reviewers (or the same reviewer on a later pass) routinely raise the same point twice because there is no memory of what was already said. The result is shallow, duplicated, and unrepeatable spec review.

## Solution

A standalone Claude Code plugin, `unic-spec-review`, that runs an adversarial, multi-perspective review of a web specification and surfaces Confidence-scored Findings for the reviewer to triage. The reviewer pastes whatever links they have (Confluence, Figma, live URLs); the plugin classifies them, gathers context across all four sources (Confluence pages and their comments, Figma designs and annotations, the live system, and the local repo), and runs a fan-out of review agents. Each agent inspects one dimension of the spec and emits Findings tagged with a Six-Thinking-Hats perspective and a Confidence Score.

Findings are presented for triage first, ranked and grouped, with any near-duplicate of an existing Confluence comment flagged. The default run is read-only and produces a durable markdown report. Only when the reviewer passes `--post` does an interactive Approval Loop open, letting them select which Findings to publish as Confluence comments. Posting is anchored to the exact spec text where possible, falls back to a page-level comment otherwise, and carries a visible attribution footer so later runs (by anyone) can recognise prior Findings and avoid piling up duplicates.

## User Stories

1. As a spec reviewer, I want to paste a mix of Confluence, Figma, and live-system links in one go, so that I do not have to sort them by type myself.
2. As a spec reviewer, I want the plugin to classify each pasted link by its URL, so that the right gathering strategy runs for each source.
3. As a spec reviewer, I want the plugin to fetch the parent Confluence page and discover its child pages, so that I review the whole spec, not just the page I happened to paste.
4. As a spec reviewer, I want the plugin to surface in-body links to other Confluence pages, so that related pages outside the parent-child tree are not missed.
5. As a spec reviewer, I want to confirm or trim the discovered page set before a large fetch, so that the review stays bounded and I control the cost.
6. As a spec reviewer, I want existing Confluence comments read and taken into account, so that the review reflects the discussion already on the page.
7. As a spec reviewer, I want the plugin to read Figma designs and their annotations, so that spec-versus-design inconsistencies are caught.
8. As a spec reviewer, I want the plugin to inspect the live production system, so that the spec is checked against how the system behaves today.
9. As a spec reviewer, I want the plugin to detect the technology landscape from the repo at runtime, so that feasibility and testability are judged against the actual stack, not assumptions.
10. As a spec reviewer working across repos, I want to declare adjacent systems that live in other repos (for example .NET services or the CMS), so that cross-system feasibility is not blind.
11. As a spec reviewer, I want each review dimension handled by a dedicated agent, so that coverage is broad and no single context juggles everything shallowly.
12. As a spec reviewer, I want gaps and completeness checked (missing states, undefined behaviour, missing acceptance criteria), so that under-specified flows are caught early.
13. As a spec reviewer, I want ambiguity and unmeasurable language flagged, so that the spec is testable and unambiguous.
14. As a spec reviewer, I want spec-versus-design and spec-versus-live consistency checked, so that the three sources of truth agree.
15. As a spec reviewer, I want internal consistency checked across parent and child pages and against unresolved comments, so that the spec does not contradict itself.
16. As a spec reviewer, I want testability assessed against the repo's actual test setup, so that I know whether requirements can be verified (and whether an E2E harness even exists).
17. As a spec reviewer, I want feasibility and constraints assessed against the detected stack, so that the spec does not demand something the platform cannot deliver cheaply.
18. As a spec reviewer, I want non-functional concerns (accessibility, i18n, performance, SEO, responsive behaviour, error handling) checked, so that they are not forgotten.
19. As a spec reviewer, I want alternatives the spec ignored surfaced (Green hat), so that the design space is considered, not just the chosen path.
20. As a spec reviewer, I want the spec's stated value and justification challenged (Yellow hat), so that we know the work is worth building.
21. As a spec reviewer, I want likely points of user confusion flagged (Red hat), so that UX risk is visible.
22. As a spec reviewer, I want every Finding tagged with its hat and dimension and given a Confidence Score, so that I can triage by perspective and certainty.
23. As a spec reviewer, I want Findings ranked by confidence and severity, so that the most important issues are at the top.
24. As a spec reviewer, I want a durable markdown report written for every run, so that the review survives the session and can be diffed across runs.
25. As a spec reviewer, I want a bare run to be strictly read-only, so that I can review freely without any risk of writing to a shared page.
26. As a spec reviewer, I want to opt into posting with an explicit flag, so that publishing is always a deliberate act.
27. As a spec reviewer, I want each candidate Finding compared against all existing comments, so that I am warned when it duplicates something already said by me, a colleague, or a prior run.
28. As a spec reviewer, I want to break the tie on borderline duplicates myself, so that the non-deterministic similarity check never silently drops or re-raises a Finding.
29. As a spec reviewer, I want approved Findings anchored to the exact spec text where possible, so that the comment lands where the issue is.
30. As a spec reviewer, I want a page-level fallback when text cannot be anchored, so that cross-cutting Findings are not lost.
31. As a spec reviewer, I want every posted comment to carry a visible attribution footer, so that anyone can see it came from this command and which category it belongs to.
32. As a spec reviewer, I want to abort the Approval Loop at any point, including posting nothing after selecting, so that selection never commits me to publishing.
33. As a spec reviewer, I want a preflight command that checks credentials and required MCPs, so that I find out about missing access before a review, not during it.
34. As a spec reviewer, I want a clear, loud failure when the Figma or Playwright MCP is not connected, so that the review never silently skips a source.
35. As a new user who installed only this plugin, I want its own setup command to configure Confluence credentials, so that I never have to install or set up another plugin first.
36. As a user who already uses unic-pr-review, I want this plugin to read the same Confluence credentials convention, so that I do not configure Confluence twice.
37. As a maintainer, I want this plugin to have no runtime or setup dependency on any other plugin, so that it can be installed, versioned, and shipped on its own even at the cost of duplicated code.
38. As a maintainer, I want the plugin's pure logic isolated in tested modules, so that the behaviour is verifiable without driving live services.

## Implementation Decisions

### Plugin shape and self-containment

- Standalone plugin `unic-spec-review` under `apps/claude-code/`. Three commands: `/review-spec` (main), `/spec-doctor` (preflight), and `/setup-confluence` (credential wizard). Command-based plugin orchestrating agents plus pure-function script libraries, mirroring `unic-pr-review`.
- **Self-containment is a hard requirement.** The plugin must be installable and fully usable on its own, with no runtime or setup dependency on any other plugin (`unic-pr-review`, `unic-confluence`). It therefore ships its own `/setup-confluence` command and its own vendored credential handling. Shared code from `unic-pr-review` (`atlassian-fetch`, `credentials`, the `setup-confluence` wizard) is vendored (copied), not cross-imported. Duplication across plugins is accepted as the price of self-containment.
- Credentials live in `~/.unic-confluence.json` (or `CONFLUENCE_*` env vars), the same convention `unic-pr-review` uses. This is a shared credential store keyed by a conventional filename, not a coupling between plugins: each plugin can create and read it independently via its own setup command, and a user who runs only `unic-spec-review` configures Confluence through this plugin's own wizard. A user who has both plugins configures Confluence once.

### Sources and access

- Four sources in scope: Confluence (pages and comments), Figma (designs and annotations), live production, local repo.
- Figma access is via the Figma Dev Mode MCP; live-system access is via the Playwright MCP. Both are discovered at runtime. Confluence access is via the vendored `atlassian-fetch` over the Atlassian REST API using built-in `fetch` and Basic auth (no runtime dependencies), consistent with `unic-pr-review` and its ADRs.
- Required MCPs and credentials are not bundled. If a required MCP is absent, the run fails loudly for that source rather than silently degrading. `/spec-doctor` checks all prerequisites up front.

### Intake and traversal

- `link-classifier` (deep module): routes each pasted URL to confluence / figma-page / figma-frame / live / unknown and extracts identifiers (Confluence page id, Figma file and node keys). Args are optional; a pasted block is accepted and classified. The reviewer can declare out-of-repo adjacent systems during intake.
- `traversal-planner` (deep module): given seed pages plus fetched page metadata (child pages, in-body `/wiki/` links), produces an expansion plan and a budget-gate decision. Before a large or expanding fetch, the command shows the discovered page set and count and asks the reviewer to confirm or trim.

### Review engine

- Parallel multi-agent fan-out. Black-hat core is eight dimension agents: Gaps/Completeness, Ambiguity/Clarity, Spec-versus-Design, Spec-versus-Live, Internal-consistency, Testability, Feasibility/Constraints, Non-functional. Plus three Six-Hats perspective agents: Green (alternatives), Yellow (value/justification), Red (UX reaction). White is folded into Gaps and Testability. Blue is the orchestrator/synthesiser.
- Every Finding is tagged with its hat and dimension and carries a Confidence Score and a severity. `finding` defines the schema; `finding-ranker` sorts by confidence and severity; `hat-mapper` maps dimension to hat and groups Findings by hat for the report.

### Landscape Brief

- `landscape-detector` (deep module): from repo manifests and file listing plus declared adjacent systems, produces a single Landscape Brief (detected stack, test setup and frameworks, available tooling, reachable-prod flag, declared adjacent systems). The technology landscape is never hardcoded.
- The Landscape Brief is computed once during preflight and injected into the Testability, Feasibility, Spec-versus-Live, and Non-functional agents, mirroring how `unic-pr-review` computes Doc Context once and injects it into review agents.

### Output and posting

- Every run writes a timestamped markdown report to `.spec-review/` (gitignored), grouped by hat, and presents the ranked Findings conversationally for triage (confidence times severity, anchor target, near-duplicate flag). `report-renderer` builds the report.
- Bare `/review-spec` is read-only: review plus report, no writes. `--post` enables the Approval Loop. Invariant: `--post` makes posting possible, never automatic; the loop is cancellable at every step, including a final "post none" exit. Selection is not commitment.
- `inline-anchor-resolver` (deep module): resolves a Finding's anchor text against the page body into a `textSelection` and `matchCount` for the Confluence v2 inline-comment API, or decides a footer fallback when the text cannot be uniquely matched.
- `atlassian-fetch` is extended with Confluence comment read (footer and inline) and comment write (footer and inline). `attribution-footer` renders the visible provenance footer on every posted comment and recognises command-authored comments by it.

### De-duplication

- `dedup-matcher` (deep module): compares a candidate Finding against all existing comments (the reviewer's own prior runs, other reviewers' runs of this command, and human comments) and returns near-duplicate candidates plus a post / skip / flag-for-tiebreak decision. There is no hidden marker and no local state file; de-duplication is multi-user and multi-run safe because it reads the shared page. Borderline matches are surfaced in the Approval Loop for a human tiebreak so non-determinism cannot silently accumulate duplicates.

### Argument parsing

- `args` (deep module): parses `/review-spec` arguments (URLs and `--post`), mirroring `unic-pr-review`'s `args` library.

## Testing Decisions

- Good tests assert external behaviour through a module's public interface, not its internals. They use injected dependencies (for example the injectable `fetch` already supported by `atlassian-fetch`, and the injectable `homedir`/`env` supported by `credentials`) so no live Confluence, Figma, or browser is touched. Prior art: the `node:test` suites in `apps/claude-code/unic-pr-review/tests/` and `scripts/lib/*.test.mjs` (for example `atlassian-fetch.test.mjs`, `credentials.test.mjs`, `setup-confluence.test.mjs`, `signature.mjs` tests, `args.test.mjs`).
- Unit tests will be written for every pure `scripts/lib/` module: `link-classifier`, `traversal-planner`, `landscape-detector`, `finding-ranker`, `hat-mapper`, `dedup-matcher`, `inline-anchor-resolver`, `attribution-footer`, `report-renderer`, `args`, the vendored `credentials` loader, the vendored `setup-confluence` wizard, and the extended `atlassian-fetch` comment read/write paths (with injected `fetch`).
- The agent prompt files (eight dimension agents, Green/Yellow/Red, Blue orchestrator), the confluence-writer, and the Approval Loop driver are not unit-tested; their behaviour is exercised through the modules they call and through manual review runs.
- When the first `.mjs` script is vendored, restore the `test` and `typecheck` scripts, `tsconfig.json`, and the `scripts/`/`tests/` directories to `package.json` (the scaffold is command-only until then).

## Out of Scope

- Editing or rewriting the spec itself. The plugin reviews and comments; it does not author spec content.
- Resolving or replying to existing Confluence comment threads beyond posting new comments.
- Posting to Figma or to the live system. Figma and the live system are read-only inputs.
- Jira or Azure Boards work-item intent checking (that is `unic-pr-review`'s concern).
- A non-Confluence specification backend.
- Automatic, human-free de-duplication that posts without a tiebreak on borderline matches.

## Further Notes

- The locked design from the grilling session is recorded in `apps/claude-code/unic-spec-review/AGENTS.md`.
- Follow-up before implementation: slice this PRD into tracer-bullet issues (intake and classification, Confluence read plus comments, traversal, Landscape Brief, review engine, report, posting plus dedup, preflight) so each slice is independently shippable.
