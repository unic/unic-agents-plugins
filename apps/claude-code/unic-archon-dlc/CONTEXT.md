# unic-archon-dlc

A **thin process layer** for an AI development lifecycle. It owns the _what_ (the box set — main line
`/specs` → `/tickets` → `/build` → `/pr-review` → `/qa`; on-ramps `/triage` and `/qa` findings;
off-line `/setup`, `/explore`, `/improve-architecture`, `/cleanup`, `/handoff`) and **composes the
team's system-skills for the _how_**. Each box's container follows its structural need: Archon
workflows for the AFK-isolated legs, Claude Code commands/skills for the interactive ones.
Configured via the `/unic-archon-dlc:setup` slash command. See `docs/adr/0016`–`0018` for the
two-axis architecture and `docs/adr/0014` for the box set.

Requires the Archon workflow engine (version ≥ 0.5.0) in the target project.

## Language

### Architecture

**Thin process layer**:
The DLC owns the _what_ (the lifecycle and artefact shapes) and composes the team's system-skills
for the _how_. See `docs/adr/0016-dlc-thin-process-layer.md`.
_Avoid_: framework, integration layer

**System-skill**:
A team-provided capability that talks to one of their systems (a Confluence skill, the
`azure-devops-cli` skill, the Figma MCP, `gh`/`az`/`jira`). Boxes compose these; the plugin never
reimplements them.
_Avoid_: integration, adapter, provider

**Container**:
How a box is packaged — an **Archon workflow** (AFK-isolated: `/build`, `/qa`, `/pr-review`,
`/explore`) or a **Claude Code command/skill** (interactive/repo-global: the rest). Container
follows structural need. See `docs/adr/0017-container-follows-structural-need.md`.
_Avoid_: using "workflow" as a synonym for a box

**config.yaml**:
The rich per-project `.archon/unic-dlc.config.yaml` (converged with `unic-ticket-specification`)
holding all tracker/tenant/OS/template specifics; boxes read it and compose accordingly (MCP-first,
CLI-fallback). See `docs/adr/0018-generic-core-config-compose.md`.
_Avoid_: config.json (the retired thin form)

### Session lifecycle

**Slug**:
A short identifier chosen at the start of a Session that scopes all session artefacts
(e.g. `workflows/<slug>/`, `.archon/workflows/build-<slug>.yaml`).
_Avoid_: session name, run id, job id

**Session**:
One pass along the main line — `/specs` → `/tickets` → `/build` → `/pr-review` → `/qa` — tied to a
single Slug. Artefacts live under `workflows/<slug>/`; state lives in the tracker and on disk, never
in conversation memory.
_Avoid_: run, job, sprint (which has a specific meaning here)

**agent-ready issue**:
An issue carrying acceptance criteria (in the tracker, not conversation memory) suitable for `/build`
to consume. Produced by the `/triage` intake on-ramp, `/tickets` slicing, `/qa` findings, or humans.
See `docs/adr/0014-workflow-per-box-decomposition.md`.
_Avoid_: ticket, ready ticket, groomed issue

### Planning artifacts

**PRD**:
Product Requirements Document produced by the `/specs` command (branch-on-input; via Matt's
`to-prd`) and stored at `workflows/<slug>/PRD.md`. Its section shape comes from the config template
and is enforced by a generic validator. See `docs/adr/0020-specs-branch-on-input.md`.
_Avoid_: spec, requirements doc

**Findings**:
The `/explore` output at `workflows/<slug>/findings.md` — five sections: Stack, Features,
Architecture, Pitfalls, Integrated Brief.
_Avoid_: research doc, exploration report

**Issues JSON**:
The decomposed vertical slices at `workflows/<slug>/issues.json`.
Each entry carries a `test_command` required for Nyquist validation.
_Avoid_: tickets, tasks list

**Nyquist map**:
The validation the `/tickets` command runs (via tested lib) to ensure every issue in Issues JSON
has a `test_command` before `dag-builder` generates the build DAG. Named after the Nyquist sampling
theorem analogy: you must observe behaviour at twice the frequency to reconstruct it faithfully.
_Avoid_: validation node, test-command check

### Build discipline

**code-red**:
The TDD node that writes failing acceptance tests for one issue before any implementation.
The `code-red-<id>` Archon node depends on the `code-green` nodes of all blocked-by issues.
_Avoid_: failing tests, red phase

**code-green**:
The TDD node that writes minimum implementation to make the acceptance tests pass.
The `code-green-<id>` Archon node depends on `code-red-<id>` for the same issue.
_Avoid_: implementation, green phase

**red/green fresh-context**:
The anti-cheating separation in `/build`: `code-red-<id>` and `code-green-<id>` run in separate
fresh-context nodes (`context: fresh`), so green inherits only the slice intent and the committed
failing test — never red's reasoning. Structurally prevents test/impl collusion in unattended (AFK)
runs. See `docs/adr/0012-fresh-context-red-green-separation.md`.
_Avoid_: TDD isolation, context reset

**Slopcheck gate**:
A pre-build verification that every new package in `package.json` exists on the npm registry.
Packages that fail the check are flagged `[ASSUMED]` and require explicit human approval.
_Avoid_: package check, dependency audit

**yaml-gen**:
The tested `dag-builder` lib step the `/tickets` command runs to generate
`.archon/workflows/build-<slug>.yaml` — a DAG of `code-red` and `code-green` nodes for every issue,
with `depends_on` edges derived from the `blocked_by` fields in Issues JSON.
_Avoid_: build generator, workflow generator

### Plugin entry points

**Setup**:
The one-time conversational configuration of unic-archon-dlc in a target project, invoked as
`/unic-archon-dlc:setup`. Writes `.archon/unic-dlc.config.yaml`, discovers and registers the team's system-skills,
and refreshes the marker-delimited `## Agent skills` block in `CLAUDE.md`. Idempotent (a thin tested
lib does schema-validate + merge): re-running
with no arguments prints the current config when fully populated, asks only for missing fields
when partial, and prompts for everything on a fresh project. Pass `reconfigure` to force a full
re-prompt; pass free-form intent (e.g. "change branching to github-flow") for targeted tweaks.
_Avoid_: install, init, install hook

**Claude Code slash command**:
A markdown file under `commands/` at the plugin root, invoked as `/<plugin-name>:<command>`.
Rendered by Claude at user-invocation time. `commands/setup.md` becomes `/unic-archon-dlc:setup`.
_Avoid_: command, command template (which means something else here)

**Archon workflow command template**:
A markdown file under `.archon/commands/` (e.g. `unic-dlc-plan.md`). Rendered by the Archon
workflow engine inside a workflow node, not by Claude directly. Same file extension as a slash
command, completely different runtime.
_Avoid_: slash command, workflow command (ambiguous)

### Architecture-health artifacts

**arch-review**:
The architecture review output at `workflows/<slug>/arch-review.md`, produced by the
`/improve-architecture` command/skill (which composes Matt's `improve-codebase-architecture`).
Identifies technical drift, intent drift, and deepening opportunities.
_Avoid_: architecture report, code review

**ADR**:
Architecture Decision Record. Written to `docs/adr/NNNN-*.md` only after explicit human
approval in the `/improve-architecture` command/skill (which also supersedes stale ADRs).
_Avoid_: decision doc, architecture note

## Relationships

- A **Session** is scoped by a **Slug** and produces **Findings**, a **PRD**, **Issues JSON**, and a `build-<slug>.yaml`, all under `workflows/<slug>/`
- **yaml-gen** depends on **Nyquist map** completing without errors
- Every issue in **yaml-gen** output gets exactly one **code-red** node and one **code-green** node, run in **red/green fresh-context** isolation
- **code-green** depends on **code-red** within the same issue; independent issues run in parallel
- **adr-consolidation** (in `/improve-architecture`) sources candidates from the "Decisions Made" section of `report.md` and "Accept as ADR" items from **arch-review**
- The **issue tracker** is the single source of truth for project state; there is no `HANDOFF.md`/`ROADMAP.md`
- The **Setup** slash command writes `.archon/unic-dlc.config.yaml`, registers the team's system-skills, and refreshes the `## Agent skills` block in `CLAUDE.md` in the target project
