# Refining `unic-archon-dlc` into a Matt-Pocock-aligned workflow set

> Durable in-repo copy of the approved umbrella plan (grilled + approved 2026-06-23).
> Original drafted at `~/.claude/plans/functional-wishing-shannon.md`. This copy is the canonical reference for the redesign handoff sessions in this directory.

## Context

`unic-archon-dlc` already ships 7 Archon workflows (`explore, plan, build, qa, cleanup, triage, review`). They were scaffolded but the design has drifted from two reference points the maintainer wants to honour:

1. **Matt Pocock's skills** (installed in this repo under `.agents/skills/`) — the "idea → ship" methodology: grill → PRD → vertical-slice issues → test-first build → review, with durable artifacts as the contract between phases.
2. **The Unic-DLC vision diagram** (`../Unic-dlc.mmd`) — a per-command pipeline with HITL/AFK gates, written using Prism (a Figma→React design-system pipeline) as the worked example.

The driver is **both**: workflows are too *coarse* (the `plan` workflow alone bundles grill + PRD + gate + issue-decomposition + test-mapping + validation + a second gate) **and** their internals don't faithfully implement Matt's discipline. The fix for coarseness — splitting into separate, independently-runnable, gated commands — is *also* what makes Matt-fidelity natural, because each fresh command IS the fresh context Matt's discipline relies on.

**North-star constraint:** the workflows must stay **generic, installable, and tweakable per project** (web-first is an acceptable initial constraint). Prism is a *consumer*, not the spec — no Prism/Figma/Storybook/design-system specifics may leak into the generic workflows.

---

## Locked decisions

| # | Decision |
|---|----------|
| 1 | **One Archon workflow per box.** Each is independently runnable + resumable; the written artifact is the baton handed to the next box. |
| 2 | **Box set** (below) reconciles the diagram, Matt, and the existing 7 workflows. |
| 3 | **`/explore` and `/setup` are OFF the main line.** Setup is one-time (+ re-run after plugin updates). Explore is optional research/prototype; its findings *may* feed `/specs` but it is never required. (Corrects the diagram, which marked research/prototype "out of scope.") |
| 4 | **`/triage` = Matt's on-ramp** (raw incoming work → agent-ready issues). It is *not* a stage between specs and tickets (diagram was wrong there). |
| 5 | **Tickets are a convergence point**: agent-ready issues are produced by PRD-slicing (`/tickets`), the `/triage` on-ramp, `/qa` findings, AND humans. `/build` consumes them regardless of producer. |
| 6 | **The old `triage` workflow is dropped entirely.** Its only job was generating `HANDOFF.md`/`ROADMAP.md`; those are **dropped** — the **issue tracker is the single source of truth** for "where are we." The doctrine "HANDOFF.md/ROADMAP.md written exclusively by triage" is retired. |
| 7 | **`/handoff` is ADDED** as a new standalone — Matt's per-thread conversation→throwaway-file session bridge. |
| 8 | **`cleanup` splits into two**: **`/improve-architecture`** (Matt's arch-health: drift review + deepening + ADR consolidation incl. *superseding* old ADRs) and a new **`/cleanup`** (operational janitor: prune merged/stale worktrees, branches, PRs — `archon isolation cleanup --merged`, `archon complete`, gh/az). |
| 9 | **The "Component Assets → deterministic output" loop needs NO new workflow.** Emergent: each fresh slice/session reads the *committed repo state* (the baton on disk), so prior slices' output is automatically context for later ones. Documented as the stakeholder explanation; not built. |
| 10 | **Gates: HITL by default, AFK opt-in** via `/setup` config, per workflow. |
| 11 | **Build red/green = anti-cheating fresh-context separation** (contract B). Faithful to Matt on *slicing* and the *red→green→refactor rhythm*; deliberately stricter on *context isolation* because the loop can run unattended (AFK). |
| 12 | **Integration contract** (C): intent in the tracker, artifacts in slug-scoped `workflows/<slug>/` (NOT under `docs/`), code in the worktree; nothing relies on conversation memory. |

---

## Target architecture

```
MAIN LINE   /specs ──► /tickets ──► /build ──► /pr-review ──► /qa
                          ▲
ON-RAMPS    /triage ──────┤   (raw bugs/requests → agent-ready issues)
            /qa findings ─┤
            humans ───────┘
OFF-LINE    /setup · /explore · /improve-architecture · /cleanup · /handoff
```

### Mapping from the existing 7

| Existing | → Target | Disposition |
|----------|----------|-------------|
| `setup` (command) | `/setup` | keep; add config flags (gates, red/green, model profile); re-runnable after plugin updates |
| `explore` | `/explore` | keep, **moved off-line**; optional; emits `findings.md` that may feed `/specs` |
| `plan` | **split** → `/specs` + `/tickets` | `/specs` = grill→PRD (load-context, specs-loop, to-prd, prd-gate). `/tickets` = decompose→issues (to-issues, nyquist-map, plan-checker, yaml-gen, plan-pr-gate) |
| `triage` | **dropped** | state-snapshot concept retired (decision #6) |
| (new) | `/triage` | Matt's intake on-ramp → agent-ready issues |
| `build` | `/build` | keep; rework to enforce anti-cheating red/green + intent injection (contract B) |
| `review` | `/pr-review` | rename; keep 4-aspect review |
| `qa` | `/qa` | keep; also recognised as an issue-producing on-ramp |
| `cleanup` | **split** → `/improve-architecture` + `/cleanup` | arch-health (incl. ADR consolidation/superseding) vs operational janitor (decision #8) |
| (new) | `/handoff` | Matt's per-thread session bridge |

---

## Cross-cutting contracts

### A. Gates (HITL/AFK)
Every baton handoff is a **HITL approval gate by default**; flippable to AFK per-workflow in `/setup` config (`gates.<workflow>: hitl|afk`). Default HITL points: `/specs`→PRD, `/tickets`→issues, `/build`→(tests-OK, then code AFK), `/build`→build-PR, `/qa`→UAT+merge, `/triage`→classification. `/pr-review` posts findings (AFK post is fine; the merge gate is the human point).

### B. Build — anti-cheating red/green (the core fidelity decision)
```
SLICE = vertical tracer bullet (Matt-faithful; may carry several assertions for ONE demoable behavior)
  │
  ▼ RED node   (fresh ctx)  input: slice INTENT (acceptance criteria, from tracker/issues.json)
                            write failing test(s) → RUN → assert RED → commit
  │ baton = (1) slice intent  +  (2) committed failing test  (NOT red's reasoning/session)
  ▼ GREEN node (fresh ctx)  input: slice INTENT + committed test
                            minimum impl → RUN → assert GREEN
  ▼ refactor   (placement = open item for /build session: tail of green vs separate fresh node)
```
- **Why fresh, against Matt's single-session TDD:** a shared test+impl context lets an unattended agent *cheat* (tests written to pass its planned impl, or impl special-cased to its own tests). Matt avoids this with a human watching every cycle; an AFK pipeline must prevent it *structurally*. This is the failure mode `ralph-orchestrator` addressed and Anthropic's ralph-loop ignores.
- **Fresh ≠ blind:** every node, even fresh ones, is fed the slice's *original intent*. The generated `code-red-<id>`/`code-green-<id>` nodes must (a) carry `fresh_context: true` and (b) inject the issue's `acceptance_criteria` into each node's prompt.

### C. Integration contract (baton / resumability)
```
INTENT    → issue tracker (acceptance criteria on each issue) — durable, external, read by every fresh node
ARTIFACTS → workflows/<slug>/  (PRD.md, issues.json, plan-checker-report.md, report.md, findings.md)
            ── MOVED here from today's docs/workflow/<slug>/; keep docs/ for human-facing docs only
CODE      → the worktree on disk (committed tests + impl = the running baton)
SCOPE     → slug keys the worktree/branch AND workflows/<slug>/
RESUME    → re-run the box; all state external (tracker + disk), never conversation memory
PRUNE     → /cleanup removes stale workflows/<slug>/ dirs (alongside worktrees/branches/PRs)
```
Caveat to document: `workflows/<slug>/` (artifacts) must not be confused with `.archon/workflows/` (generated DAG YAMLs).

### D. `/setup` additions
New config keys: `gates.<workflow>: hitl|afk`; `build.fresh_context_red_green: true` (default on); slice-granularity guidance; `model_profile: fast|balanced|max` (exists). Setup remains idempotent and the sole config entry point (ADR-0001); add "re-run after plugin update."

### E. Template enforcement (the diagram's "validation over MD template")
Keep + strengthen existing validators: PRD 7-section (`lib/prd-writer.mjs` `validatePrdSections`), issue schema (`lib/issues-schema.mjs` `validateIssue`/`sortByDependency`), Nyquist `test_command`/`test_command_planned` gate.

### F. Tracker sync (the diagram's "Sync to ADO/GitHub")
Handled by the existing `lib/tracker-adapter.mjs` (github/ado/jira/local-markdown). `/tickets`, `/triage`, `/qa` publish via it. No dedicated sync workflow; ADO is just a `/setup`-selected target.

---

## Open risks / pre-work (do before refactoring workflows)

1. **★ Archon version + YAML-schema reconciliation.** Shipped workflows use `type: prompt|loop|interactive|bash` + `fresh_context`. The live `/archon` CLI (v0.3.12→v0.4.1, archon.diy) documents a *different* schema: node keys `command/prompt/bash/script/loop/approval/cancel`, `interactive: true` at workflow level, dedicated `approval:` nodes with `on_reject`. The plugin's `AGENTS.md` claims "Archon ≥ 0.10" — mismatch. **Verify which schema the target Archon actually runs**, align every workflow. This gates everything else.
2. **Nested `archon workflow run` is fragile.** `/build`'s `run-build` node shells out to `archon workflow run` from *inside* a workflow; the skill warns about `CLAUDECODE=1` nested-Claude hangs.
3. **`docs/workflow/<slug>/` → `workflows/<slug>/` move** touches every workflow's prompts and `lib/` path constants.

---

## ADR candidates (plugin `docs/adr/`)

- **Fresh-context red/green separation for anti-cheating** (keystone for `/build`).
- **Tracker as single source of truth; HANDOFF.md/ROADMAP.md dropped.**
- **`workflows/<slug>/` artifact home** (separate from `docs/`).
- **Workflow-per-box decomposition** (supersedes the bundled `plan` design).

---

## Per-workflow handoff stubs

See the numbered docs in this directory. Recommended order:
`00 pre-work` → `01 foundations` → `02 /handoff` → `03 /setup` → `04 /specs` → `05 /tickets` → `06 /build` → `07 /triage` → `08 /qa` → `09 /pr-review` → `10 /improve-architecture` → `11 /cleanup` → `12 /explore` → `13 finalize diagram + docs`.
