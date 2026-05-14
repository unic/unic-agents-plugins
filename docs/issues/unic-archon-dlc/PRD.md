Status: ready-for-agent

# PRD: unic-archon-dlc

A Claude Code plugin that ships a complete, Archon-powered AI development lifecycle as an installable DLC pack — taking heavy inspiration from Matt Pocock's skills workflow and GSD, and translating their best patterns into Archon's YAML DAG runtime.

---

## Problem Statement

Development teams using AI coding agents lack a structured, repeatable lifecycle that takes a feature from raw idea all the way to shipped code with human approval gates at every critical decision point. Existing approaches either own the entire process rigidly (GSD, BMAD) or are fully manual sequences of composable skills (Matt Pocock's skills repo). Neither fits teams that want Archon's DAG execution engine — with its parallel nodes, loop primitives, and interactive gates — while preserving deliberate human checkpoints and a clean separation between transient workflow state and persistent project artifacts.

---

## Solution

`unic-archon-dlc` is a Claude Code plugin that installs into any project and scaffolds six Archon workflows covering the full development lifecycle: **explore**, **plan**, **build**, **qa**, **cleanup**, and **triage**. Each workflow is a YAML DAG file consumable by the Archon runtime. Human approval gates (`interactive: true` nodes) are placed at every phase boundary where human judgement adds irreplaceable value. Persistent project artifacts (PRDs, findings, spike verdicts, reports, ADRs) live in the project repo under `docs/workflow/`. Transient workflow state uses Archon's native `$ARTIFACTS_DIR`. Issue tracking is fully configurable at install time — GitHub Issues, Azure DevOps, Jira, or local markdown — and the plugin writes both machine-readable config (`.archon/unic-dlc.config.json`) and human-readable agent docs (`docs/agents/`) that any agent working in the repo can consume.

---

## User Stories

### Setup

1. As a developer onboarding to `unic-archon-dlc`, I want an idempotent install hook that explores the project before asking questions, so that I'm not asked about things that are already configured.
2. As a developer, I want the install hook to auto-detect the issue tracker from `git remote`, so that the most common case requires no manual input.
3. As a developer, I want to skip the e2e test command during install and configure it later, so that I can set up the plugin on day one before the test suite exists.
4. As a developer, I want to re-run the install hook at any time to fill in missing config, so that setup is accumulative rather than all-or-nothing.
5. As a developer, I want the install hook to detect whether the repo is single-context or multi-context (via `CONTEXT-MAP.md`), so that the `specs` node reads domain docs from the right location.
6. As a developer, I want configurable triage state labels mapped to my tracker's actual strings, so that the workflows apply labels that already exist in my project.
7. As a developer, I want configurable issue type labels (feature, bug, spike, tech-debt, docs) and priority labels (p0–p3) mapped to my tracker's strings, so that created issues are consistent with my team's conventions.
8. As a developer, I want to choose between Gitflow and GitHub Flow at install time, with Gitflow as the default, so that the branch strategy matches my team's convention without extra config.
9. As a developer, I want the install hook to write a human-readable `docs/agents/` directory, so that any AI agent working in the repo understands the workflow context automatically.
10. As a developer, I want an `## Agent skills` block added to `CLAUDE.md` pointing to the `docs/agents/` files, so that the config is discoverable from the project's main AI instruction file.

### Explore Workflow

11. As a developer starting on an unfamiliar integration, I want four parallel research agents (stack, features, architecture, pitfalls) to run simultaneously, so that I get broad coverage without waiting for sequential passes.
12. As a developer, I want a synthesize node that combines parallel research findings with my stated intent into a coherent brief, so that the prototype and the grilling session are informed by everything discovered.
13. As a developer, I want a prototype node that produces a spike with a structured VALIDATED / INVALIDATED / PARTIAL verdict per experiment, so that technical feasibility is documented before any planning begins.
14. As a developer, I want an optional interactive gate that asks whether the prototype produced code worth preserving on a branch, so that valuable spike work is not lost.
15. As a developer, I want `explore` to produce a `findings.md` committed to `docs/workflow/<slug>/`, so that the findings survive session boundaries and are available to the `plan` workflow.
16. As a developer, I want `explore` to create a spike ticket in the configured issue tracker, so that the exploration work is visible and traceable.

### Plan Workflow

17. As a developer, I want the `specs` node to load `CONTEXT.md`, `CONTEXT-MAP.md`, and existing ADRs before interviewing me, so that the grilling session is informed by the project's domain model and past decisions.
18. As a developer, I want the `specs` node to conduct an adversarial grill-with-docs interview — one question at a time — that challenges terminology against the domain model and proposes ADR entries for non-obvious decisions as they crystallise, so that the PRD captures everything I know without my having to write it from scratch.
19. As a developer, I want ADRs proposed during the `specs` session to be written live into `docs/adr/`, so that decisions are recorded at the moment they are made.
20. As a developer, I want a `to-prd` node that synthesises the grilling session into a structured PRD (problem, solution, user stories, implementation decisions, acceptance criteria), so that there is a single source of truth for the feature.
21. As a developer, I want a first human PR gate after `to-prd`, so that I can review and approve the PRD before issue decomposition begins.
22. As a developer, I want a `to-issues` node that decomposes the PRD into vertically-sliced, independently-grabbable issues with `blocked_by` dependency notes, so that the dependency tree is explicit and parallelisation opportunities are visible.
23. As a developer, I want a `to-issues` node that prompts me to validate the issue breakdown before publishing, so that I can correct misclassifications before they reach the tracker.
24. As a developer, I want a `nyquist-map` node that maps every issue to a specific test command before any code is written, so that the test infrastructure is planned as first-class work.
25. As a developer, I want a `plan-checker` loop node that validates the issue breakdown for consistency, completeness (all mandatory fields), decision coverage (every CONTEXT.md decision appears in at least one issue), and Nyquist compliance, so that the second PR gate approves a validated plan, not raw output.
26. As a developer, I want the `plan-checker` to detect stalls — when the issue count doesn't decrease between consecutive iterations — and escalate to a human gate rather than exhausting all retries on a stuck loop, so that I'm not surprised by a 3-iteration burn with no improvement.
27. As a developer, I want a `yaml-gen` bash node that reads the `issues.json` dependency tree and generates a runtime `.archon/workflows/build-<slug>.yaml` with correct parallel and serial groupings, so that the `build` workflow respects actual dependencies without a static pre-defined DAG.
28. As a developer, I want a second human PR gate after `plan-checker` passes, so that I approve a complete, validated, dependency-mapped issue plan before any code is written.

### Build Workflow

29. As a developer, I want the generated `build-<slug>.yaml` to run `code-red` (write failing acceptance tests) before `code-green` (write implementation), so that the TDD red-green-refactor discipline is enforced by the DAG, not by convention.
30. As a developer, I want parallel `code-red` and `code-green` nodes for issues that have no `blocked_by` dependencies, so that independent issues are implemented concurrently and the overall build is faster.
31. As a developer, I want a `slopcheck` bash node that checks any newly introduced package names for AI-hallucinated dependencies before they are installed, so that supply-chain risk is caught before `code-green` runs.
32. As a developer, I want a `slopcheck` node that creates `checkpoint:human-verify` tasks inline for `[ASSUMED]` packages, so that I explicitly approve any package whose registry existence was not verified.
33. As a developer, I want a `verification` node that runs the test suite, checks coverage thresholds, detects stub patterns (TODO/FIXME, empty returns, hardcoded values), and audits wiring (component→API, API→DB, form→handler), so that low-quality implementations are caught before the human review gate.
34. As a developer, I want a `goals-check` node that reads the original PRD and produces a coverage matrix mapping each acceptance criterion to implementation evidence, so that I can confirm the feature delivers what was intended before raising a PR.
35. As a developer, I want a `report` node that produces `docs/workflow/<slug>/report.md` consolidating: what was built, goals-check matrix, test outcomes, decisions made during implementation, and tech debt flagged, so that the PR gate reviewer has a structured summary rather than raw diffs.
36. As a developer, I want a human PR gate after `report`, so that I review the report and approve before the automated PR review runs.
37. As a developer, I want a self-contained `review` command that performs a multi-aspect PR review (code quality, test coverage, silent failure patterns, type design) as an AFK Archon node, so that the review runs without requiring the `pr-review-toolkit` plugin to be installed.

### QA Workflow

38. As a developer, I want a `qa` workflow that runs the e2e suite first, so that the human UAT gate only opens for runs where automated tests already pass.
39. As a developer, I want a `coverage-gate` bash node that enforces coverage thresholds and fails fast if they are not met, so that the human never reviews a build with insufficient test coverage.
40. As a developer, I want a `uat-gate` interactive node that presents the e2e results alongside the UAT checklist from the PRD, so that human sign-off is informed by automated evidence.
41. As a developer, I want the `qa` workflow to merge the PR via the configured tracker's CLI after `uat-gate` approves, so that the merge step is deterministic and does not require manual terminal commands.

### Cleanup Workflow

42. As a developer, after a feature is merged, I want an `arch-review` node that reads both `PRD.md` and `report.md` alongside the codebase, so that the review catches both technical drift and intent drift.
43. As a developer, I want `arch-review` to identify modules that became too shallow or tightly coupled during implementation and propose deepening opportunities, so that software entropy is addressed before the next sprint.
44. As a developer, I want an `adr-consolidation` interactive node that proposes new or updated ADRs based on decisions logged during `build`, with a per-ADR approval gate, so that only validated decisions become permanent architectural records.
45. As a developer, I want the cleanup workflow to end with a `triage` node that reconciles all issue states in the configured tracker and updates `docs/workflow/ROADMAP.md`, so that the project state is accurate after the feature ships.

### Triage Workflow

46. As a developer, I want a standalone `triage` workflow callable at any point in the lifecycle, so that I can get a status snapshot without running a full cleanup cycle.
47. As a developer, I want `triage` to produce a `HANDOFF.md` document capturing current phase, open issues, blockers, and recent decisions, so that AFK sessions can resume cleanly in a fresh context window.

### Documentation

48. As a developer reading the plugin README, I want a Mermaid architecture diagram showing all six workflows, their nodes, and human gate positions, so that I understand the full lifecycle at a glance without reading YAML.
49. As a developer, I want a node reference table in the README listing every workflow, every node, its type (prompt / loop / bash / interactive), and whether it is a human gate, so that I can quickly find any node and understand its role.
50. As a developer, I want a quick-start section in the README covering install + first run in three steps, so that onboarding is fast.
51. As a developer, I want a configuration reference in the README documenting every key in `.archon/unic-dlc.config.json` with defaults and valid values, so that I can customise without reading source YAML.
52. As a developer, I want a `docs/workflow/` layout section in the README explaining what gets created where and who owns each artifact, so that the separation between transient Archon state and committed project artifacts is clear.

---

## Implementation Decisions

### Plugin structure

- Plugin lives at `apps/claude-code/unic-archon-dlc/` in this monorepo, following the existing plugin convention (`auto-format`, `pr-review`, `unic-confluence`).
- Plugin manifest at `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
- Archon workflow YAML files ship under `.archon/workflows/` inside the plugin directory and are scaffolded into the target project by the install hook.
- Archon command markdown files ship under `.archon/commands/` inside the plugin directory and are scaffolded similarly.

### Archon hard dependency

- Archon is a hard runtime dependency. The README and install hook make this explicit. Target projects must have Archon installed before running any workflow.
- The install hook verifies `archon` is available on `PATH` and surfaces a clear error if not.

### State separation (three layers)

- **Transient workflow state** (current node, loop iteration, last node output) → `$ARTIFACTS_DIR` (Archon native, not committed).
- **Persistent project artifacts** (PRD, findings, spike verdicts, arch-review, report, ROADMAP) → `docs/workflow/<feature-slug>/` (committed to repo).
- **Issue/ticket tracking** → configured tracker (GitHub Issues, ADO, Jira, or local markdown).

### Persistent artifact layout

```
docs/workflow/
├── ROADMAP.md                        # project-level phase tracker
└── <feature-slug>/
    ├── findings.md                   # output of explore/synthesize
    ├── PRD.md                        # output of plan/to-prd
    ├── issues.json                   # dependency tree from plan/to-issues
    ├── report.md                     # output of build/report
    └── arch-review.md                # output of cleanup/arch-review
```

### Dynamic parallelisation

- `to-issues` outputs `docs/workflow/<slug>/issues.json` with a `blocked_by` dependency array per issue.
- A `yaml-gen` bash node reads this file and generates `.archon/workflows/build-<slug>.yaml` at runtime, producing a DAG with correct `depends_on` edges and grouping independent issues as parallel nodes.
- This avoids static DAG limitations — the execution graph is derived from the actual dependency tree, not pre-defined.

### Install hook design

- The install hook is an idempotent Node.js script (`.mjs`, ESM, no external deps) triggered by Claude Code's plugin install mechanism.
- It explores the project first (reads `git remote`, `CLAUDE.md`, `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/`, existing `.archon/`) before asking any questions.
- Questions are presented one at a time with short explainers. Already-configured values are shown and skippable.
- Mandatory first tier (asked on every fresh install): issue tracker → PR strategy (auto-deduced from tracker) → branching strategy (Gitflow default).
- Skippable: e2e test command (can be set later).
- Defaulted: model profile (`balanced`), TDD mode (`on`), Nyquist validation (`on`), slopsquatting gate (`on`).
- Dual output: `.archon/unic-dlc.config.json` (machine-readable) + `docs/agents/` files (human/agent-readable).

### Configuration files written to `docs/agents/`

Six files are written or updated by the install hook:

- `issue-tracker.md` — tracker backend, CLI commands, create/update conventions
- `labels.md` — three-tier label taxonomy: state (needs-triage → closed), type (feature/bug/spike/tech-debt/docs), priority (p0–p3), all mapped to actual tracker strings
- `branching.md` — chosen strategy (Gitflow / GitHub Flow), default branch names, PR target conventions
- `domain.md` — single-context vs multi-context layout, where CONTEXT.md and ADRs live
- `workflow.md` — maps each workflow phase to its artifact outputs and the `docs/workflow/` paths

### `specs` node — grill-with-docs style

- The `specs` node loads CONTEXT.md, CONTEXT-MAP.md (if present), and relevant ADRs before the interview.
- It conducts an adversarial interview — one question at a time — challenging terminology against the domain glossary.
- ADR entries are proposed and written live for non-obvious decisions only (not every answer).
- GSD's assumptions-first mode is available as a configuration flag (`workflow.discuss_mode: assumptions`) for experienced developers in established codebases.

### `plan-checker` loop

- Maximum 3 iterations before escalation to a human gate.
- Stall detection: if the issue count does not decrease between consecutive iterations, escalate immediately rather than burning the remaining retries.
- Validates four dimensions: consistency (no orphaned dependencies, all PRD acceptance criteria covered), completeness (mandatory fields present), decision coverage (every trackable CONTEXT.md decision appears in at least one issue), Nyquist compliance (every issue maps to a test command).

### `review` command — self-contained

- The `review` Archon command is self-contained within `unic-archon-dlc`. It does not shell out to `pr-review-toolkit`.
- It covers: code quality, test coverage adequacy, silent failure patterns, type design quality.
- It is inspired by `pr-review-toolkit` patterns but has no runtime dependency on it.

### Branching strategy

- Default: Gitflow (`main` + `develop`, feature branches from `develop`).
- Alternative: GitHub Flow (`main` only, feature branches from `main`).
- Branch names and PR targets are derived automatically from the chosen strategy — no separate prompt.

### Triage label vocabulary

- Three tiers: state labels, type labels, priority labels.
- Each tier provides canonical role names internally; the `docs/agents/labels.md` file maps them to actual tracker strings.
- The `to-issues` and `triage` workflow nodes always use canonical names; a tracker adapter translates at write time.

### README deliverables

The plugin README must include:

1. A Mermaid flowchart showing all six workflows, phase nodes, and human gate markers.
2. A node reference table: workflow · node · type (prompt/loop/bash/interactive) · human gate (✓ / —).
3. Quick-start: install + first run in three steps.
4. Configuration reference: every `.archon/unic-dlc.config.json` key with defaults.
5. `docs/workflow/` layout diagram.
6. Dependency map: Archon version requirement, no required peer plugins.

---

## Testing Decisions

### What makes a good test

Tests verify external behaviour — inputs and outputs — not implementation details. A good test for this plugin exercises a module through its public interface and asserts on the observable result without caring how the result was produced internally. Tests should not mock internal collaborators; they should use real inputs and assert on real outputs.

### Modules with tests

**Config loader/validator** — reads `.archon/unic-dlc.config.json`, validates all fields, returns a typed config object or a structured error. Deep module: all config concerns behind a simple `loadConfig(path)` interface. Test: valid config parses correctly; missing mandatory fields return structured errors; unknown keys are ignored.

**Issue tracker adapter** — translates canonical label names to tracker-specific strings and generates create/update CLI commands for each configured backend. Deep module: all tracker-specific knowledge encapsulated. Test: for each backend (GitHub, ADO, Jira, local markdown), canonical label input produces the correct CLI command string.

**Dependency tree builder + YAML generator** — reads `issues.json`, builds the dependency DAG, detects parallel groups, generates a valid Archon YAML file. Deep module: pure data transformation. Test: linear dependency chain produces serial nodes; independent issues produce parallel nodes; circular dependencies are detected and reported; output YAML is valid Archon syntax.

**Setup explorer** — reads project state (git remote, `CLAUDE.md`, `CONTEXT.md`, existing `.archon/`) and returns a structured snapshot of what is already configured. Deep module: all exploration logic isolated. Test: given a mock project directory, returns correct snapshot; missing files are reported as absent, not errored.

### Prior art

- Existing test patterns in this repo use `node:test` built-in runner with `.mjs` test files.
- See `packages/release-tools/` for examples of pure function tests over file-system utilities.

---

## Out of Scope

- A visual Archon workflow builder UI for `unic-archon-dlc` — YAML files are the authoring format.
- Integration with Linear — GitHub Issues, ADO, Jira, and local markdown are the supported backends for v1.
- A managed/hosted version of the workflows — the plugin is self-hosted in the target project.
- Automatic promotion of issues through states without human approval at gate nodes.
- A `ralph`-style loop runner for this plugin — the Archon runtime is the execution engine.
- Translations of the command file prompts into languages other than English.
- Any UI design contract phase (GSD's 6-pillar UI contract) — out of scope for v1, can be added as a separate command.
- Cross-AI execution delegation (running `code-green` on a different AI agent than `code-red`).

---

## Further Notes

- The plugin name `unic-archon-dlc` signals both ownership (Unic) and the relationship to Archon (this is an expansion pack, not a standalone tool). The DLC metaphor is intentional.
- The `explore` workflow is explicitly optional and pre-plan — it can be skipped entirely for well-understood features. Its output feeds `plan` as an optional input; `plan` works without it.
- Dynamic parallelisation via runtime-generated YAML (`yaml-gen`) means the `build` workflow is never a static file shipped with the plugin — it is always generated fresh per feature. This is a deliberate design: the execution graph reflects the actual dependency tree, not a generic template.
- GSD's slopsquatting gate requires `slopcheck` (Python tool) to be available on `PATH`. If not installed, the `slopcheck` node defaults to marking every new package as `[ASSUMED]` and creating a human checkpoint — intentionally stricter, not silently permissive.
- The `triage` workflow doubles as both a standalone on-demand status check and the final node of the `cleanup` workflow. Both invocations produce the same `HANDOFF.md` output.
- This plugin does not create, copy, or manage `LICENSE` files. The maintainer adds those manually per the monorepo convention.
