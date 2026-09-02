# unic-archon-dlc

A **Harness** for an AI development lifecycle. It owns the _what_ (the box set — main line
`/specs` → `/tickets` → `/build` → `/pr-review` → `/qa`; on-ramps `/triage` and `/qa` findings;
off-line `/setup`, `/explore`, `/improve-architecture`, `/cleanup`, `/archon-upgrade`; + `/handoff` — Matt's,
referenced) and **composes the
team's system-skills for the _how_**. Procedure belongs to the **Methods** it hosts, not to the
Harness. Each box's container follows its structural need: Archon workflows for the AFK-isolated legs,
Claude Code commands/skills for the interactive ones. Configured via the `/unic-archon-dlc:setup`
slash command. See `docs/adr/0016`–`0018` for the two-axis architecture, `docs/adr/0014` for the box
set, and `docs/adr/0030`–`0032` for the Harness/Method division.

Requires the Archon workflow engine (version ≥ 0.7.0) in the target project.

## Language

### Architecture

**Harness**:
What the DLC is to a Method: the owner of everything outside the procedure. See
`docs/adr/0030-harness-hosts-methods.md`.
_Avoid_: thin process layer, framework, integration layer, orchestrator

**Box**:
One step of the lifecycle. See `docs/adr/0030-harness-hosts-methods.md`.
_Avoid_: step, stage, phase

**Method**:
The skill text a Box reads for procedure. See
`docs/adr/0031-methods-bundled-three-tier-resolution.md`.
_Avoid_: skill (a Method is text the repository holds, not an installed skill), prompt, playbook

**Bundle**:
The set of Methods the plugin ships, fixed to one upstream version. See
`docs/adr/0031-methods-bundled-three-tier-resolution.md`.
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
holding the gates, the per-Box knobs, the docs and design system-skills, and the templates. It holds
**no tracker facts**: those are the Tracker contract below. See
`docs/adr/0018-generic-core-config-compose.md`.
_Avoid_: config.json (the retired thin form), tracker config

**Tracker contract**:
The two repo-local prose files a Box reads instead of asking config for a host word:
`docs/agents/issue-tracker.md` (which server serves the tracker, the repository to address, and the
work-item scope every search filters on) and `docs/agents/triage-labels.md` (the seventeen roles, each
row naming the axis that carries it). A Box names a role and a file; it never names an organisation, a
field or a provider. `/unic-archon-dlc:setup` owns both, and `setup-matt-pocock-skills` must never run
over them. A section earns its place there only when it states a fact about this tenant — an MCP server
discovers its own API, so writing operations down freezes a flag table in Markdown. See
`docs/adr/0024-triage-intake-on-ramp.md` (amended 2026-08-18).
_Avoid_: repository derivation (deleted — nothing is derived from a remote), repo pinning, label
mapping (`classification.labels` is gone), tracker config

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

**Canonical role**:
The name a Box uses for a state, type or priority. Owned by the Harness and fixed: the team names the
value and the Axis a role resolves to, never the role itself, because the roles are the protocol the
Boxes share. `/triage`, `/tickets` and `/qa` write states; no Box reads one, so a state signals to a human
rather than routing work — the handoff between Boxes is the Slug. A canonical role is never written to
a tracker: it resolves through the Tracker contract first.
_Avoid_: label (a label is the string, not the role), status, tag, canonical label

**Axis**:
What carries a Canonical role on this tracker — a state field, a tag, a work-item type, or a named
field. `docs/agents/triage-labels.md` gives every role a value **and** an axis, because the axis
belongs to the role and not to its tier: on a real tenant five of the eight state roles cannot be states
at all, because writing a state while the work is still open moves an already-active item backwards on
the board — only the three terminal roles are states there. Two teams may render the same role as
`needs-specs` and `3-Analysis`, on different axes, and no Box can tell the difference.
_Avoid_: tier (the tier groups roles; it does not decide the axis), label string, canonical label,
default label

**Holds**:
Whether an Axis carries one value at a time or many. The third thing every
`docs/agents/triage-labels.md` row states, and the only property a Box reasons about — a Box reads
`holds` and never an axis name, because an axis name is a host word and the next host spells it
differently. It decides what a write means: on `one`, writing a role replaces the previous value; on
`many`, writing adds and the previous value stays. That asymmetry is why a `state`, `type` or
`priority` role is single-valued by rule rather than by the field — a Box retracts the tier's other
roles that sit on a `many` Axis before it writes one.
_Avoid_: cardinality (correct, but not the word in the file), multi-value field, array field, tag axis

### Planning artifacts

**PRD**:
Product Requirements Document produced by the `/specs` command (branch-on-input; via the `to-spec`
Method) and stored at `workflows/<slug>/PRD.md`. Its section shape comes from the config template,
and `/specs` checks the rendered PRD against that template itself before it writes — every heading in
the template must appear. No module validates it; `lib/` is deleted (#381). One section sits outside
the template and no override removes it: **Confirmations**, one entry per in-method halt, carrying the
human's answer verbatim or the word `unanswered`. The PRD gate reads it and refuses on an absent or
unanswered entry. See `docs/adr/0020-specs-branch-on-input.md`.
_Avoid_: spec, requirements doc

**Design contract**:
The **derived** half of what a project knows about one component: what the design file says, read
mechanically, plus the code shape that follows from it. `/specs` writes one per component a feature
names, and every run rewrites it whole, so it rots when the design changes and the cure is another run.
The **authored** half — which states apply, what the thing is for — lives on the component's docs page,
is written by a person, and is never touched by this Plugin. A contract's provenance is a **visible
list**, where an installed Box carries its provenance as a **Generated header** comment: a Box YAML has
no reader but an agent, while a contract has a human standing at the PRD gate, and hidden provenance is
provenance nobody checks. `commands/specs.md` holds its section shape and every rule about writing one.
_Avoid_: design spec, component spec (the authored half is the spec; this is the derived half)

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
The validation `/tickets` runs itself, in conversation, to ensure every issue in Issues JSON has a
`test_command` before `/build` consumes it. No module runs it; `lib/` is deleted (#381). Named after the Nyquist sampling theorem analogy:
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

**red/green fresh-context**:
The anti-cheating separation in `/build`: RED and GREEN run as SEPARATE fresh loop
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
to track every slice's phase (`pending → red-done → green-done`). It is the on-disk memory that lets
fresh, memoryless iterations compute the next `(slice, phase)`. A slice with `test_command_planned`
also carries a `seam chosen: …` line in its `notes`, recording the seam an agent picked where no human
approved one (ADR-0023 §7).
_Avoid_: progress file, checkpoint

**Evidence gate**:
The workflow-level `evidence_policy: { required: true }` on `/build` that refuses terminal
`completed` unless `$ARTIFACTS_DIR/evidence.json` exists. The engine checks file presence only;
producing valid evidence is the `evidence` node's contract, never a prompt's. See
`docs/adr/0034-evidence-gate-deterministic-writer.md`.
_Avoid_: verification gate, quality gate

**Evidence set**:
The Session-artifact mirror of the evidence gate's content, at `<artifacts_dir>/<slug>/evidence.json`
— written by the same `evidence` node that satisfies the engine's presence check at
`$ARTIFACTS_DIR/evidence.json`, so a reviewer (and `open-pr`, which stages it) can see what the gate
saw after `/cleanup` prunes the worktree.
_Avoid_: evidence.json (ambiguous — two files share the name at two different paths), evidence file

**Sub-run**:
Archon 0.7.0's `workflow:` node — a child workflow run with its own row, artifacts, gates, and cost
line, whose terminal output threads back as `$nodeId.output`. Deferred for this Harness
(`docs/adr/0033-archon-070-schema-target.md`): the wanted use, one child run per `/build` slice, is
blocked because slice count is runtime data and 0.7.0's sub-run fan-out rejects it fail-fast.
_Avoid_: child workflow, nested workflow, sub-workflow

### Plugin entry points

**Setup**:
The installation of unic-archon-dlc into a target project, invoked as `/unic-archon-dlc:setup`. Six
actions: copy the Boxes into `.archon/workflows/`, copy the Methods into `.archon/methods/`, write
`.archon/unic-dlc.config.yaml`, write the tracker contract (`docs/agents/issue-tracker.md` and
`docs/agents/triage-labels.md`), patch the `## unic-archon-dlc` block in `CLAUDE.md`, and patch the
exclusions that keep this project's formatters off the two installed trees. Prose end to end — it imports
no module. **Ownership decides the treatment**: a tree this Plugin owns is **replaced** on every run; a
tenant-owned file is written once and thereafter **reported** on; a marked block inside a tenant file is
**patched** in place, everything outside the markers verbatim. Pass `reconfigure` to be offered a rewrite
of a tenant-owned file, or free-form intent (e.g. "change branching to github-flow") for a targeted tweak.
_Avoid_: install, init, install hook

**Claude Code slash command**:
A markdown file under `commands/` at the plugin root, invoked as `/<plugin-name>:<command>`.
Rendered by Claude at user-invocation time. `commands/setup.md` becomes `/unic-archon-dlc:setup`.
_Avoid_: command, command template (which means something else here)

**Archon workflow command template**:
A markdown file under `.archon/commands/`, resolved by a workflow's own `command:` node — Archon's
own doctrine: "Commands are referenced by name (without `.md`) in workflow YAML files." Rendered by
the Archon workflow engine inside a workflow node, not by Claude directly. Same file extension as a
slash command, completely different runtime. None of this Plugin's shipped Boxes currently
reference one — see Box operator doc below — but a Box that adds a `command:` node later costs one
entry in `/setup`'s install set, not a new concept.
_Avoid_: slash command, workflow command (ambiguous)

**Box operator doc**:
A markdown file under `docs/boxes/` (e.g. `unic-dlc-build.md`) documenting one Box for a human
operator — usage, prerequisites, what the workflow does, its `archon workflow run <name> "<slug>"`
invocation. Never installed by `/setup`: it is read in this Plugin's own repo, not shipped into a
Consumer. Not an Archon workflow command template — no `command:` node resolves it.
_Avoid_: command stub, command doc (both suggest the runtime template above)

**Install set**:
The six things `/setup` writes into a Consumer, and the rule by which each is replaced: the Boxes, the
Methods, the config, the two tracker-contract files, the `CLAUDE.md` block, and the formatter exclusions.
Three treatments, decided by ownership — see the **Setup** entry above. Inside **replace**, two shapes: a
**directory entry**, which owns its whole destination (`.archon/methods/`), and a **named entry**, which
owns only the names its pattern matches inside a directory it shares with the Consumer
(`unic-dlc-*.yaml` inside `.archon/workflows/`). The engine that once held this is deleted with the rest of
`lib/` (#381), and nothing iterates a declared set: each entry is written by the step that owns it. Read [ADR-0036](docs/adr/0036-setup-owns-a-named-install-set.md) D1's "one declared
install set" as one shared rule, never as a single enumeration something iterates.
_Avoid_: install manifest, artefact list

**Generated header**:
The one comment line `/setup` stamps onto every installed Box YAML, naming this Plugin and the version
that wrote the file and stating that the next run replaces it. `/setup` writes it in its install step and
reads it back as the previous version by matching a **prefix of the first line**. No Method file carries
one — the Bundle is upstream text pinned to a tag, and a line at the top would fork it. This is where a
Consumer's install provenance lives — per Box, and in no separate record. It never decides ownership: the stale sweep retires a name whether or not the
file carries the header ([ADR-0036](docs/adr/0036-setup-owns-a-named-install-set.md) D3).
_Avoid_: provenance file, install record (neither exists)

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
an Intent Check + "What's good"), plus an **inline comment** per finding that names a changed file and a
diff line, where the tracker supports threads. A finding no line of the diff owns is **scoped** — to the
pull request, a work item, or the repository — and the summary is the only surface it reaches.
It is keyed by a hidden `<!-- unic-dlc-pr-review:iteration=N -->` marker so a re-run **updates in place**
(and increments the iteration) rather than duplicating. Distinct from **Findings** (the `/explore`
research doc at `workflows/<slug>/findings.md`) and from **arch-review** (the `/improve-architecture`
architecture-drift report) — this is diff-level PR feedback.
_Avoid_: review report, findings.md (the /explore artifact), code review (the arch-review sense)

**Intent Brief**:
The single narrative + numbered Acceptance Criteria that `/pr-review`'s `prep` node composes once from the
linked work items, Confluence/MD docs, the PR description, and `PRD.md`, then injects into both review
axes so each judges the diff against intended behaviour. Contradictions across sources are surfaced, not
silently resolved.
_Avoid_: spec, PRD (which is one input source, not the brief)

**Review axis**:
One of the two lenses `/pr-review`'s single `review` node spawns as parallel sub-agents, reading the
`code-review` Method: **Standards** (this repo's documented standards plus the twelve-item Fowler smell
baseline — where refactoring lives, having left `/build`'s loop) and **Spec** (does the diff implement
what the originating issue asked for). The two are reported side by side and never merged or reranked;
each finding is scored on the confidence→severity rubric. Replaced the seven hand-written review aspects
(ADR-0026 §8).
_Avoid_: review aspect, reviewer, agent, check

## Relationships

- The **Harness** hosts **Methods**: a **Box** reads a Method for procedure, and a Box exists only for what no Method can supply (ADR-0030)
- A **Method** is read at `.archon/methods/<name>/SKILL.md`, the one path **Setup** installs the **Bundle** into (ADR-0031, amended)
- **Configuration** carries parameters and a **Method** carries procedure, so wanting different method text means forking the Method rather than adding a config key (ADR-0032)
- A **Session** is scoped by a **Slug** and produces **Findings**, a **PRD**, **Issues JSON**, `build-state.json`, and a build **report**, all under `<artifacts_dir>/<slug>/` (default `workflows/<slug>/`)
- The **Nyquist map** gate — every issue carrying a `test_command` — runs in `/tickets` before `/build` consumes the build-ready `issues.json` (ADR-0022)
- `/build` runs a generic **red → green** loop over each issue in `issues.json`; RED and GREEN run in **fresh-context** isolation so GREEN never sees RED's reasoning (ADR-0012 / ADR-0023 — no per-slice DAG codegen; `dag-builder` / `yaml-gen` are dissolved)
- Refactoring is **not** in that loop: the `tdd` Method puts it in the review stage, so it reaches the code as `/pr-review`'s Standards **Review axis** and its Fowler smell baseline (ADR-0023 §7 / ADR-0026 §8)
- A **Method** is read at one path, `.archon/methods/<name>/SKILL.md`, by every Box and every command alike — the team-source and Local-Method tiers are retired (#381), so there is no resolution order and no tier to report (ADR-0023 §5 / ADR-0031, amended)
- Within an issue, **green** depends on **red**; the loop processes issues in order on the current linear path
- **adr-consolidation** (in `/improve-architecture`) sources candidates from the "Decisions Made" section of `report.md` and "Accept as ADR" items from **arch-review**
- The **issue tracker** is the single source of truth for project state; there is no `HANDOFF.md`/`ROADMAP.md`
- The **Setup** slash command writes `.archon/unic-dlc.config.yaml`, registers the team's system-skills, and refreshes the `## unic-archon-dlc` block in `CLAUDE.md` in the target project
