# unic-archon-dlc

An Archon-powered AI development lifecycle DLC that scaffolds six workflow DAGs (explore, plan,
build, qa, cleanup, triage) plus agent-skill docs into any target project via an install hook.

Requires the Archon workflow engine (version ≥ 0.10) in the target project.

## Language

### Session lifecycle

**Slug**:
A short identifier chosen at explore time that scopes all session artefacts
(e.g. `docs/workflow/<slug>/`, `.archon/workflows/build-<slug>.yaml`).
_Avoid_: session name, run id, job id

**Session**:
One complete explore → plan → build → qa → cleanup cycle tied to a single Slug.
_Avoid_: run, job, sprint (which has a specific meaning here)

**HANDOFF.md**:
A persistent snapshot of project state refreshed by every triage run. Lives at the repo root.
_Avoid_: status doc, handoff note

**ROADMAP.md**:
Persistent roadmap under `docs/workflow/ROADMAP.md`; human-written content outside
`<!-- unic-archon-dlc:begin/end -->` markers is never overwritten.
_Avoid_: roadmap file, project roadmap

### Planning artifacts

**PRD**:
Product Requirements Document produced by the `to-prd` node in the plan workflow and stored at
`docs/workflow/<slug>/PRD.md`. Must contain exactly the seven mandatory sections.
_Avoid_: spec, requirements doc

**Findings**:
The explore output at `docs/workflow/<slug>/findings.md` — five sections: Stack, Features,
Architecture, Pitfalls, Integrated Brief.
_Avoid_: research doc, exploration report

**Issues JSON**:
The decomposed vertical slices at `docs/workflow/<slug>/issues.json`.
Each entry carries a `test_command` required for Nyquist validation.
_Avoid_: tickets, tasks list

**Nyquist map**:
The node in the plan workflow that validates every issue in Issues JSON has a `test_command`
before yaml-gen runs. Named after the Nyquist sampling theorem analogy: you must observe
behaviour at twice the frequency to reconstruct it faithfully.
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

**Slopcheck gate**:
A pre-build verification that every new package in `package.json` exists on the npm registry.
Packages that fail the check are flagged `[ASSUMED]` and require explicit human approval.
_Avoid_: package check, dependency audit

**yaml-gen**:
The bash node in the plan workflow that generates `.archon/workflows/build-<slug>.yaml` — a DAG
of `code-red` and `code-green` nodes for every issue, with correct `depends_on` edges derived
from the `blocked_by` fields in Issues JSON.
_Avoid_: build generator, workflow generator

### Plugin entry points

**Setup**:
The one-time conversational configuration of unic-archon-dlc in a target project, invoked as
`/unic-archon-dlc:setup`. Writes `.archon/unic-dlc.config.json`, generates `docs/agents/*.md`,
and refreshes the marker-delimited `## Agent skills` block in `CLAUDE.md`. Idempotent: re-running
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

### Cleanup artifacts

**arch-review**:
The architecture review output at `docs/workflow/<slug>/arch-review.md`, produced by the
`arch-review` node in the cleanup workflow. Identifies technical drift, intent drift, and
deepening opportunities.
_Avoid_: architecture report, code review

**ADR**:
Architecture Decision Record. Written to `docs/adr/NNNN-*.md` only after explicit human
approval in the `adr-consolidation` interactive node of the cleanup workflow.
_Avoid_: decision doc, architecture note

## Relationships

- A **Session** is scoped by a **Slug** and produces **Findings**, a **PRD**, **Issues JSON**, and a `build-<slug>.yaml`
- **yaml-gen** depends on **Nyquist map** completing without errors
- Every issue in **yaml-gen** output gets exactly one **code-red** node and one **code-green** node
- **code-green** depends on **code-red** within the same issue; independent issues run in parallel
- **adr-consolidation** sources candidates from the "Decisions Made" section of `report.md` and "Accept as ADR" items from **arch-review**
- **HANDOFF.md** and **ROADMAP.md** are written exclusively by the **triage** workflow
- The **Setup** slash command writes `.archon/unic-dlc.config.json`, `docs/agents/*.md`, and the `## Agent skills` block in `CLAUDE.md` into the target project
