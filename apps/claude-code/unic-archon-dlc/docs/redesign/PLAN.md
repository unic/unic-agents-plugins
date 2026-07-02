# Refining `unic-archon-dlc` into a thin, Matt-aligned, config-driven lifecycle

> Durable in-repo copy of the redesign plan. Grilled + approved 2026-06-23; **two-axis architecture added 2026-07-02** (grill-with-docs). Canonical reference for the redesign handoff sessions in this directory. Decisions are recorded as ADRs 0011–0020 in [`../adr/`](../adr/).

## Context

`unic-archon-dlc` shipped 7 bundled Archon workflows. Two reference points drive the redesign:

1. **Matt Pocock's skills** (`.agents/skills/`) — the "idea → ship" methodology: grill → PRD → vertical-slice issues → test-first build → review, with durable artifacts as the baton between phases.
2. **Pesche's `unic-ticket-specification`** (PR #257) — the config-driven genericity model: generic workflow/command templates, all tracker/tenant/OS specifics in per-project config, MCP-first/CLI-fallback, compose don't reimplement. `unic-pr-review` is the **cautionary tale** (hardcoded ADO, ~830 lines, expensive).

The original driver was coarseness + Matt-fidelity; a second grilling pass (2026-07-02) added the deeper architectural axis: **genericity + composition**.

**North-star:** generic, installable, tweakable per project. Prism/Confluence/ADO are _consumers_, never the spec.

---

## The two axes (the heart of the design)

```
AXIS 1 — CONTAINER follows structural need                                    [ADR-0017, revises 0014]
  ARCHON (AFK, isolated, fresh-context):   /build · /qa(+approval gate) · /pr-review · /explore
  COMMANDS / SKILLS (live conversation):   /specs · /tickets · /triage · /improve-architecture · /handoff · /cleanup · /setup
                                           └─ compose Matt's originals, don't reimplement
  Litmus: needs the live conversation or repo-global state → command/skill; else AFK-isolated → Archon.

AXIS 2 — GENERICITY & COMPOSITION (applies to BOTH containers)                 [ADR-0016, 0018]
  The DLC owns the WHAT (process + artifact shapes). It composes team system-skills for the HOW
  (Confluence / ADO / Jira / GitHub / GitLab / Figma / …). Thin process layer over composable system-skills.
  TESTED LIB (tracker-agnostic, deterministic, no tool to compose):
      dag-builder · slopcheck · stub-detector · issues+PRD schema-validation · thin config validate/merge · archon guard
  COMPOSE + CONFIG (everything else):
      tracker → az/gh/jira + azure-devops-cli skill (prose, no adapter lib) · docs → MCP-first/CLI-fallback · interactive → Matt's skills
  SUBSTRATE:  rich .archon/unic-dlc.config.yaml (converged with #257) — ALL tracker/tenant/OS/template specifics live here.
```

---

## Locked decisions

| #   | Decision                                                                                                                                                                                                                                                                                            | ADR        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **Container follows structural need** — Archon for AFK-isolated legs (`/build`, `/qa`, `/pr-review`, `/explore`); commands/skills for interactive/repo-global (`/specs`, `/tickets`, `/triage`, `/improve-architecture`, `/handoff`, `/cleanup`, `/setup`). Replaces "one Archon workflow per box." | 0017       |
| 2   | **DLC = thin process layer; compose team system-skills for the _how_.** No box hardcodes a tracker/docs/design system.                                                                                                                                                                              | 0016       |
| 3   | **Generic core + per-project config; tested lib only for tracker-agnostic deterministic IP.** Dissolve tracker-adapter, labels-config, prd-writer(templates), install-runner, setup-explorer, agent-docs-writer, handoff-generator, findings-writer, spike-verdicts, config-loader.                 | 0018       |
| 4   | **Config substrate = rich `.archon/unic-dlc.config.yaml`** converged with #257; MCP-first/CLI-fallback; templates in config.                                                                                                                                                                        | 0018       |
| 5   | **`/setup` = conversational + one thin schema lib** (validate/merge); discovers & registers the team's system-skills; supersedes ADR-0001.                                                                                                                                                          | 0019       |
| 6   | **`/specs` = branch-on-input**: raw idea → converse (Matt); existing spec/Figma/UX → ingest+synthesise(+estimate)→review (#257); partial → ingest + grill gaps. One PRD approval gate.                                                                                                              | 0020       |
| 7   | **`/pr-review` = new generic Archon workflow**, #257-style, harvesting `unic-pr-review`'s review-aspect _learnings_ (not its ADO code, not a dependency); its fate deferred.                                                                                                                        | 0017       |
| 8   | **Box set + revised meanings stand** (from 0014): `/triage` = intake on-ramp; `/cleanup` = operational janitor; `/improve-architecture` = arch-health + ADR superseding; `/handoff` added; `/explore` off-line/optional; tickets = convergence point (slicing + triage + qa findings + humans).     | 0014       |
| 9   | **Build red/green = anti-cheating fresh-context separation**; slice intent fed to both fresh nodes.                                                                                                                                                                                                 | 0012       |
| 10  | **Integration contract**: intent → tracker; artifacts → `workflows/<slug>/`; code → worktree; no conversation-memory reliance.                                                                                                                                                                      | 0013, 0015 |
| 11  | **Gates: HITL by default, AFK opt-in** per box via config (Archon boxes); interactive boxes are inherently HITL.                                                                                                                                                                                    | 0017       |
| 12  | **"Component Assets → deterministic output" needs NO new workflow** — emergent from fresh-slice-reads-committed-repo. Stakeholder explanation, not built.                                                                                                                                           | —          |
| 13  | **Archon schema** = key-discriminated, ≥ 0.5.0; the shipped `type:`-style workflows are a **blocking migration**.                                                                                                                                                                                   | 0011       |

---

## Target architecture

```
MAIN LINE   /specs ──► /tickets ──► /build ──► /pr-review ──► /qa
            (skill)     (skill)     (Archon)    (Archon)     (Archon)
                          ▲
ON-RAMPS    /triage ──────┤   (raw bugs/requests → agent-ready issues)   [skill]
            /qa findings ─┤
            humans ───────┘
OFF-LINE    /setup(skill) · /explore(Archon) · /improve-architecture(skill) · /cleanup(skill) · /handoff(skill)
```

### Mapping from the shipped 7

| Shipped        | → Target                             | Container     | Disposition                                                                                                                   |
| -------------- | ------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `setup`        | `/setup`                             | skill         | Conversational + thin schema lib; discovers team system-skills; writes rich YAML config. [0019]                               |
| `explore`      | `/explore`                           | Archon        | Off-line, optional; research/spike AFK → `findings.md`; interactive prototyping stays Matt's `/prototype`.                    |
| `plan`         | `/specs` + `/tickets`                | skill + skill | `/specs` branch-on-input → PRD [0020]; `/tickets` slice → agent-ready issues (dag-builder/slopcheck/nyquist stay tested lib). |
| `triage` (old) | retired                              | —             | State-snapshot dropped. [0013]                                                                                                |
| —              | `/triage`                            | skill         | Intake on-ramp; composes Matt's `triage`.                                                                                     |
| `build`        | `/build`                             | Archon        | Anti-cheat red/green; the keystone AFK box. [0012]                                                                            |
| `review`       | `/pr-review`                         | Archon        | **New** generic workflow; harvest `unic-pr-review` learnings. [0017]                                                          |
| `qa`           | `/qa`                                | Archon        | AFK pipeline + one approval gate; also an issue-producing on-ramp.                                                            |
| `cleanup`      | `/improve-architecture` + `/cleanup` | skill + skill | Arch-health (composes Matt's `improve-codebase-architecture`) vs. repo-global operational janitor.                            |
| —              | `/handoff`                           | skill         | Matt's per-thread session bridge (impossible as Archon — no live conversation).                                               |

---

## Cross-cutting contracts

### A. Gates (HITL/AFK)

Archon boxes gate via config (`gates.<box>: hitl|afk`, HITL default), expressed as `approval:` nodes ([ADR-0011](../adr/0011-archon-schema-target.md)). Interactive skill boxes are inherently HITL.

### B. Build — anti-cheating red/green ([ADR-0012](../adr/0012-fresh-context-red-green-separation.md))

```
SLICE = vertical tracer bullet (one demoable behaviour)
  ▼ RED   node (fresh) ← slice INTENT (acceptance criteria)  → failing test → assert RED → commit
  ▼ GREEN node (fresh) ← slice INTENT + committed test (NOT red's reasoning) → min impl → assert GREEN
  ▼ refactor (placement = /build step open item)
```

Fresh ≠ blind: every node is fed the slice's intent; generated `code-red-<id>`/`code-green-<id>` nodes carry `context: fresh` and inject `acceptance_criteria`.

### C. Integration contract ([ADR-0013](../adr/0013-tracker-single-source-of-truth.md), [ADR-0015](../adr/0015-workflows-slug-artifact-home.md))

Intent → issue tracker · artifacts → `workflows/<slug>/` · code → worktree · resume = re-run the box · `/cleanup` prunes stale slug dirs. Nothing relies on conversation memory. (`workflows/<slug>/` ≠ `.archon/workflows/` DAG YAMLs.)

### D. `/setup` ([ADR-0019](../adr/0019-conversational-setup.md))

Conversational; composes system-skills to detect/register the team's stack; writes rich `.archon/unic-dlc.config.yaml` (`project`, `tracker{type,access:{mcp,cli},coords}`, `docs`, `repos`, `templates`, `classification`, `gates`, `build`). One thin tested lib: schema-validate + idempotent merge. Version check → behavioural `≥ 0.5.0`.

### E. Templates & validation ([ADR-0018](../adr/0018-generic-core-config-compose.md))

PRD/issue/bug **template content lives in config**; a generic structure **validator** stays in tested lib (shared with issue-schema validation + Nyquist `test_command` gate).

### F. Tracker/docs access — compose, don't reimplement ([ADR-0016](../adr/0016-dlc-thin-process-layer.md))

No `tracker-adapter` lib. Command/prompt templates read config and compose the tool: MCP-first, else `az`/`gh`/`jira` CLI or the `azure-devops-cli` skill. ADO/Jira/GitHub/GitLab/Confluence/Figma are per-project config + composed system-skills.

---

## Open risks / pre-work

1. **Archon schema migration — RESOLVED as a decision ([ADR-0011](../adr/0011-archon-schema-target.md)), but a BLOCKING implementation for Archon boxes.** Shipped `type:`-style workflows validate "ok" yet run inert (gates don't pause, loops run once, `fresh_context` ignored, `{{ }}`/`inputs:` never substitute). Port `/build`, `/qa`, `/pr-review`, `/explore` to the key-discriminated schema; confirm gates/loops/fresh-context **behaviourally**, not via `archon validate`.
2. **Nested `archon workflow run`** from inside `/build` is fragile under `CLAUDECODE=1`; decide nested vs inlined vs sibling.
3. **JSON → YAML config migration** handled by the conversational `/setup` (read old → write rich `.yaml` → backup).
4. **Docs sweep — DONE in this PR.** `AGENTS.md`, `CONTEXT.md`, this `README`/step-doc set, and the ADR index are aligned to the two axes. What remains is the per-box **implementation** (workflow YAML / command builds) in each box's own session, plus updating the vision diagram (`../Unic-dlc.mmd`) in step 13.

---

## Recorded decisions (ADRs)

- **0011** Archon schema target · **0012** red/green anti-cheat · **0013** tracker source of truth · **0014** box set (container revised by 0017) · **0015** `workflows/<slug>/` artifact home
- **0016** thin process layer / compose team-skills · **0017** container follows structural need · **0018** generic core + config + lib line · **0019** conversational setup · **0020** `/specs` branch-on-input

---

## Per-workflow handoff stubs

The numbered docs `00`–`13` carry a two-axis banner and a container tag (done in this PR); their full per-box bodies are finalised in each box's own session. Recommended order unchanged:
`00 pre-work` → `01 foundations` → `02 /handoff` → `03 /setup` → `04 /specs` → `05 /tickets` → `06 /build` → `07 /triage` → `08 /qa` → `09 /pr-review` → `10 /improve-architecture` → `11 /cleanup` → `12 /explore` → `13 finalize diagram + docs`.
