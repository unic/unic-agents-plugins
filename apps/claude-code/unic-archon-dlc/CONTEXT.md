# unic-archon-dlc

A **Harness** for an AI development lifecycle. It owns the _what_ (the box set — main line
`/specs` → `/tickets` → `/build` → `/pr-review` → `/qa`; on-ramps `/triage` and `/qa` findings;
off-line `/setup`, `/explore`, `/improve-architecture`, `/cleanup`, `/handoff`) and **composes the
team's system-skills for the _how_**. Procedure belongs to the **Methods** it hosts, not to the
Harness. Each box's container follows its structural need: Archon workflows for the AFK-isolated legs,
Claude Code commands/skills for the interactive ones. Configured via the `/unic-archon-dlc:setup`
slash command. See `docs/adr/0016`–`0018` for the two-axis architecture, `docs/adr/0014` for the box
set, and `docs/adr/0030`–`0032` for the Harness/Method division.

Requires the Archon workflow engine (version ≥ 0.5.0) in the target project.

## Language

### Architecture

**Harness**:
What the DLC is to a Method: the owner of isolation, gates, configuration, red/green integrity,
system-skill composition, artefact durability and posting. It owns the _what_ and never the
procedure. See `docs/adr/0030-harness-hosts-methods.md`.
_Avoid_: thin process layer, framework, integration layer, orchestrator

**Thin process layer**:
The earlier name for the Harness, kept in `docs/adr/0016-dlc-thin-process-layer.md` as the historical
wording. Use **Harness**.
_Avoid_: using it in new prose

**Box**:
One step of the lifecycle — `/specs`, `/tickets`, `/build`, `/pr-review`, `/qa`, `/triage`, `/setup`,
`/explore`, `/improve-architecture`, `/cleanup`. A Box exists only for what no Method can supply.
See `docs/adr/0030-harness-hosts-methods.md`.
_Avoid_: workflow (that is one of a Box's two containers), step, stage, phase

**Method**:
The skill text a Box reads for procedure, from Matt Pocock's skills. A Method owns _how_ the work is
done; configuration owns which, where and whether. See
`docs/adr/0031-methods-bundled-three-tier-resolution.md`.
_Avoid_: skill (a Method is text the repository holds, not an installed skill), prompt, playbook

**Local Method**:
A team's own version of a Method, which takes precedence over the shipped one for that team.
_Avoid_: custom skill, local skill, patch, fork

**Bundle**:
The set of Methods the plugin ships, fixed to one upstream version.
_Avoid_: vendor directory, snapshot, cache

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

**Deterministic output** (emergent — not a workflow):
The stakeholder-facing property that "the same component, fed the same inputs, produces the same
output." The DLC needs **no workflow** for it — it is **emergent** from the
_fresh-slice-reads-committed-repo_ discipline. Each `/build` slice runs in fresh context against the
**committed** repo (`docs/adr/0012-fresh-context-red-green-separation.md`), and every artefact (PRD,
Issues JSON, Findings, code) is durable on disk or in the tracker rather than in conversation memory
(`docs/adr/0013-tracker-single-source-of-truth.md`, `docs/adr/0015-workflows-slug-artifact-home.md`).
So a re-run over the same committed inputs converges on the same result, and feedback from shipped
**Component Assets** flows back into the specs the same way each iteration (the diagram's "deterministic
output" edge). It is a consequence of the architecture, not a feature to build.
_Avoid_: reproducibility workflow, determinism gate, output-caching

### Session lifecycle

**Slug**:
A short identifier chosen at the start of a Session that scopes all session artefacts
(e.g. `workflows/<slug>/findings.md`, `PRD.md`, `issues.json`, `build-state.json`).
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
The `/explore` output at `workflows/<slug>/findings.md`. Its **Integrated Brief** carries three
explicitly-named lenses — **Domain Model**, **Established Decisions**, **Prior Research** — that
`/specs`' load-context reads verbatim (the `/explore` → `/specs` contract), followed by the four
research dimensions (Stack, Features, Architecture, Pitfalls) and a `## Spike verdicts` section. See
`docs/adr/0029-explore-research-spike-onramp.md`.
_Avoid_: research doc, exploration report

**Issues JSON**:
The decomposed vertical slices at `workflows/<slug>/issues.json`.
Each entry carries a `test_command` required for Nyquist validation.
_Avoid_: tickets, tasks list

**Nyquist map**:
The validation the `/tickets` command runs (via tested lib) to ensure every issue in Issues JSON
has a `test_command` before `/build` consumes it. Named after the Nyquist sampling theorem analogy:
you must observe behaviour at twice the frequency to reconstruct it faithfully.
_Avoid_: validation node, test-command check

### Build discipline

**RED phase**:
The build-loop phase that writes failing acceptance test(s) for one slice from its intent, before any
implementation. RED proves failure by running the slice's `test_command` and committing the test ONLY
when it exits non-zero; a test that unexpectedly passes is flagged for human review, never committed.
_Avoid_: failing tests, code-red node

**GREEN phase**:
The build-loop phase that writes the minimum implementation to make the committed failing test pass.
It reads the slice intent + the committed test off disk — never RED's session.
_Avoid_: implementation, code-green node

**REFACTOR phase**:
The build-loop phase that cleans up the committed implementation under a green suite — no behaviour
change, no new features. Re-runs `test_command` to confirm still-green; a no-op when nothing needs
tidying.
_Avoid_: cleanup, tidy phase

**red/green fresh-context**:
The anti-cheating separation in `/build`: RED, GREEN, and REFACTOR run as SEPARATE fresh loop
iterations (`loop.fresh_context: true`), so GREEN inherits only the slice intent and the committed
failing test — never RED's reasoning. Structurally prevents test/impl collusion in unattended (AFK)
runs. See `docs/adr/0012-fresh-context-red-green-separation.md` and
`docs/adr/0023-build-generic-red-green-refactor-loop.md`.
_Avoid_: TDD isolation, context reset

**Slopcheck gate**:
A pre-build verification that every new package in `package.json` exists on the npm registry.
Packages that fail the check are flagged `[ASSUMED]` and require explicit human approval.
_Avoid_: package check, dependency audit

**Build state**:
The `<artifacts_dir>/<slug>/build-state.json` file the `/build` loop reads and updates each iteration
to track every slice's phase (`pending → red-done → green-done → refactor-done`). It is the on-disk
memory that lets fresh, memoryless iterations compute the next `(slice, phase)`.
_Avoid_: progress file, checkpoint

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
A markdown file under `.archon/commands/` (e.g. `unic-dlc-build.md`). Rendered by the Archon
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

### Operational hygiene

**Operational cleanup**:
The git/Archon hygiene the `/cleanup` command performs — pruning merged/stale worktrees, stale
branches/PRs, and stale `workflows/<slug>/` artifact dirs. It composes `archon isolation` /
`archon complete` + the configured tracker; it is report-first and never auto-deletes. Distinct from
**arch-review** (the `/improve-architecture` code-health sense of "cleanup"): operational cleanup
touches no code and writes no ADRs. See `docs/adr/0028-cleanup-operational-janitor.md`.
_Avoid_: cleanup (bare — ambiguous with arch-review), garbage collection

**cleanup config block**:
The `.archon/unic-dlc.config.yaml` `cleanup` keys the `/cleanup` command reads: `stale_days`
(default 7), `dry_run` (default true), `prune_slug_dirs` (default false). Off-line and non-mandatory
— the command degrades to these defaults when config or the tracker is absent.
_Avoid_: cleanup settings, janitor config

### PR-review artifacts

**Review comment**:
The `/pr-review` output — one structured **summary comment** on the open PR (severity-grouped findings +
an Intent Check + "What's good"), plus **inline comments** per finding where the tracker supports threads.
It is keyed by a hidden `<!-- unic-dlc-pr-review:iteration=N -->` marker so a re-run **updates in place**
(and increments the iteration) rather than duplicating. Distinct from **Findings** (the `/explore`
research doc at `workflows/<slug>/findings.md`) and from **arch-review** (the `/improve-architecture`
architecture-drift report) — this is diff-level PR feedback.
_Avoid_: review report, findings.md (the /explore artifact), code review (the arch-review sense)

**Intent Brief**:
The single narrative + numbered Acceptance Criteria that `/pr-review`'s `prep` node composes once from the
linked work items, Confluence/MD docs, the PR description, and `PRD.md`, then injects into every review
aspect so each judges the diff against intended behaviour. Contradictions across sources are surfaced, not
silently resolved.
_Avoid_: spec, PRD (which is one input source, not the brief)

**Review aspect**:
One of the seven parallel fresh nodes `/pr-review` fans out — code-quality, test-coverage, silent-failure,
type-design, comment-rot, code-simplification, and intent/AC-coverage — each conditionally spawned by the
changed-file categories and scoring findings on the confidence→severity rubric.
_Avoid_: reviewer, agent, check

## Relationships

- A **Session** is scoped by a **Slug** and produces **Findings**, a **PRD**, **Issues JSON**, `build-state.json`, and a build **report**, all under `<artifacts_dir>/<slug>/` (default `workflows/<slug>/`)
- The **Nyquist map** gate — every issue carrying a `test_command` — runs in `/tickets` before `/build` consumes the build-ready `issues.json` (ADR-0022)
- `/build` runs a generic **red → green → refactor** loop over each issue in `issues.json`; RED and GREEN run in **fresh-context** isolation so GREEN never sees RED's reasoning (ADR-0012 / ADR-0023 — no per-slice DAG codegen; `dag-builder` / `yaml-gen` are dissolved)
- Within an issue, **green** depends on **red**; the loop processes issues in order on the current linear path
- **adr-consolidation** (in `/improve-architecture`) sources candidates from the "Decisions Made" section of `report.md` and "Accept as ADR" items from **arch-review**
- The **issue tracker** is the single source of truth for project state; there is no `HANDOFF.md`/`ROADMAP.md`
- The **Setup** slash command writes `.archon/unic-dlc.config.yaml`, registers the team's system-skills, and refreshes the `## Agent skills` block in `CLAUDE.md` in the target project
