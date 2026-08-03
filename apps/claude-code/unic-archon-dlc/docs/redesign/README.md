# unic-archon-dlc redesign — handoff sessions

This directory drives the refactor of `unic-archon-dlc` into a **thin, Matt-aligned, config-driven lifecycle** (two-axis architecture). Read **[PLAN.md](./PLAN.md)** first — it is the canonical spec, alongside ADRs **0011–0021**. Each numbered file below is a **self-contained prompt** for one fresh Claude Code session. Do them **in order**; each commits durable artifacts (workflow YAML or command/skill, ADRs, lib changes) that later steps read from the repo, so a cold session always picks up cleanly.

> **Two-axis update (2026-07-02):** the step-doc bodies below were written before the two-axis pivot. Where a body still says "one Archon workflow per box", **PLAN.md + ADRs 0016–0021 win.** Each step's **container** (Archon workflow vs Claude Code command/skill) is shown in the table.

## Progress — update after each step

> **✅ Redesign complete (2026-07-03).** All 12 build steps + finalize are shipped to `develop`. This directory is kept as the historical record; the canonical architecture now lives in the [ADRs](../adr/) (0011–0029), [`../../CONTEXT.md`](../../CONTEXT.md), [`../../AGENTS.md`](../../AGENTS.md), and the vision diagram [`../20260703-Unic-dlc.mmd`](../20260703-Unic-dlc.mmd).

> **Every step's Definition of Done includes updating this table** (Status + PR) **with the maintainer**, before the step's PR is opened. This table is the single source of truth for progress; the invocation table below is only _how to launch_.
>
> Legend: ✅ done · ⏭️ skip (not a build) · ▶️ next · ⬜ todo

| #   | Step                    | Container   | Status  | PR / notes                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------- | ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | Archon schema pre-work  | —           | ✅ done | ADR-0011 (#262)                                                                                                                                                                                                                                                                                                                                                                        |
| 01  | Foundations             | —           | ✅ done | ADRs 0012–0021 + AGENTS/CONTEXT sweep (#262)                                                                                                                                                                                                                                                                                                                                           |
| 02  | `/handoff`              | Matt's, ref | ⏭️ skip | referenced verbatim, not shipped; dependency declared in `/setup`                                                                                                                                                                                                                                                                                                                      |
| 03  | `/setup`                | skill       | ✅ done | conversational skill + `config-schema` lib; rich YAML config (#263)                                                                                                                                                                                                                                                                                                                    |
| 04  | `/specs`                | skill       | ✅ done | branch-on-input command; template → `templates.prd`; `specs.{discuss_mode,gate}` (#264)                                                                                                                                                                                                                                                                                                |
| 05  | `/tickets`              | skill       | ✅ done | command; stops at build-ready `issues.json` (no DAG gen); `tickets` config; ADR-0022 (#265)                                                                                                                                                                                                                                                                                            |
| 06  | `/build`                | Archon      | ✅ done | keystone — ported to key-discriminated schema as one generic red/green/refactor loop over `issues.json`; dag-builder dissolved; ADR-0023 (PR #266)                                                                                                                                                                                                                                     |
| 07  | `/triage`               | skill       | ✅ done | thin wrapper over Matt's `triage` method; single-source label binding (DLC config); retires old triage workflow; ADR-0024 (PR #267)                                                                                                                                                                                                                                                    |
| 08  | `/qa`                   | Archon      | ✅ done | ported to key-discriminated schema; e2e → coverage → UAT + merge gates (`gates.qa`, `all_done` AFK auto-merge, fail-closed merge); UAT-reject files agent-ready issues; `qa` config block; ADR-0025 (PR #268)                                                                                                                                                                          |
| 09  | `/pr-review`            | Archon      | ✅ done | new generic fan-out workflow (7 intent-grounded aspects → synthesize → reconcile → gate → post); harvests unic-pr-review learnings, no dependency; iteration-aware re-review; `pr-review` config; ADR-0026 (PR #269)                                                                                                                                                                   |
| 10  | `/improve-architecture` | skill       | ✅ done | command/skill composing Matt's `improve-codebase-architecture` verbatim + DLC layers (intent-drift, durable `arch-review.md`, ADR-superseding gate across both homes); two modes (per-slug / repo-wide sweep); ADR-0027 (PR #270)                                                                                                                                                      |
| 11  | `/cleanup`              | command     | ✅ done | new repo-global operational janitor (report-first; composes `archon isolation`/`complete` + tracker); `cleanup` config block; retired legacy `unic-dlc-cleanup.yaml` + stub (content now in `/improve-architecture`); ADR-0028 (PR #271)                                                                                                                                               |
| 12  | `/explore`              | Archon      | ✅ done | ported to key-discriminated schema (was inert + imported a deleted lib); findings.md moved to `<artifacts_dir>/<slug>/` with a 3-lens Integrated Brief (Domain Model / Established Decisions / Prior Research) as the tightened `/specs` baton; AFK spike + `/prototype` reference; config-gated spike-branch gate; dissolved `findings-writer` + `spike-verdicts`; ADR-0029 (PR #272) |
| 13  | Finalize                | —           | ✅ done | vision diagram regenerated to the two-axis box set (dated `20260703-Unic-dlc.{mmd,excalidraw}`; old draft archived as `-draft`); README/CONTEXT swept to the shipped model + deterministic-output note; plugin/marketplace descriptions tidied; lightweight dogfood pass (4 workflows parse key-discriminated, stubs + core config keys present); v0.12.0 (PR #273)                    |

## How to run a step

1. Start a **fresh** Claude Code session at the repo root (`unic-agents-plugins`).
2. Paste that step's invocation prompt (table below).
3. The session starts in plan mode, grills you on the step's open questions, then implements and opens a PR to `develop`.
4. Merge the PR, then move to the next step.

> Why fresh sessions: this is the [smart-zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone) / artifact-as-baton discipline the plan itself prescribes — state lives in the repo + tracker, not in conversation memory.

## Invocation prompts (one per step, in order)

| #   | Step (container)                    | Paste this into a fresh session                                                                                        |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 00  | Archon schema pre-work              | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/00-prework-archon-schema.md to the letter. Start in plan mode.` |
| 01  | Foundations                         | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/01-foundations.md to the letter. Start in plan mode.`           |
| 02  | `/handoff` **(Matt's, ref)**        | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/02-handoff.md to the letter. Start in plan mode.`               |
| 03  | `/setup` **(skill)**                | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/03-setup.md to the letter. Start in plan mode.`                 |
| 04  | `/specs` **(skill)**                | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/04-specs.md to the letter. Start in plan mode.`                 |
| 05  | `/tickets` **(skill)**              | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/05-tickets.md to the letter. Start in plan mode.`               |
| 06  | `/build` **(Archon)** — keystone    | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/06-build.md to the letter. Start in plan mode.`                 |
| 07  | `/triage` **(skill)**               | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/07-triage.md to the letter. Start in plan mode.`                |
| 08  | `/qa` **(Archon)**                  | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/08-qa.md to the letter. Start in plan mode.`                    |
| 09  | `/pr-review` **(Archon)**           | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/09-pr-review.md to the letter. Start in plan mode.`             |
| 10  | `/improve-architecture` **(skill)** | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/10-improve-architecture.md to the letter. Start in plan mode.`  |
| 11  | `/cleanup` **(command)**            | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/11-cleanup.md to the letter. Start in plan mode.`               |
| 12  | `/explore` **(Archon)**             | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/12-explore.md to the letter. Start in plan mode.`               |
| 13  | Finalize diagram + docs             | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/13-finalize.md to the letter. Start in plan mode.`              |

## Shared context (every step assumes this — LOCKED; PLAN.md + ADRs have detail)

- **Two axes.** **Axis 1 (container, ADR-0017):** Archon workflows for AFK-isolated legs (`/build`, `/qa`, `/pr-review`, `/explore`); Claude Code commands/skills for interactive/repo-global boxes (`/specs`, `/tickets`, `/triage`, `/improve-architecture`, `/handoff`, `/cleanup`, `/setup`) — **composing Matt's originals, not reimplementing**. **Axis 2 (ADR-0016/0018):** the DLC owns the _what_ and composes team system-skills for the _how_.
- **Box set** — MAIN: `/specs → /tickets → /build → /pr-review → /qa`. ON-RAMPS: `/triage`, `/qa` findings, humans → agent-ready issues. OFF-LINE: `/setup`, `/explore`, `/improve-architecture`, `/cleanup`, `/handoff`.
- **Generic core + config (ADR-0018):** tested lib only for tracker-agnostic deterministic IP (dag-builder, slopcheck, stub-detector, issues/PRD schema-validate, thin config validate/merge). Everything tracker/tenant/OS-specific → `.archon/unic-dlc.config.yaml` + composed skill/CLI (MCP-first, CLI-fallback). No `tracker-adapter` lib.
- **Gates: HITL by default, AFK opt-in** for Archon boxes via config (`gates.<box>: hitl|afk`); interactive skill boxes are inherently HITL.
- **Integration contract:** intent → tracker; artifacts → `workflows/<slug>/` (NOT `docs/`); code → worktree; no conversation-memory reliance. `slug` keys worktree/branch + artifact dir.
- **Red/green = fresh-context anti-cheat (ADR-0012):** RED node (fresh) writes+commits failing test from slice intent; GREEN node (fresh) gets intent + committed test, never red's reasoning.
- **Generic / installable / tweakable.** No Prism/Confluence/ADO/Figma specifics baked in — they are per-project config + composed team system-skills.
- **Archon schema (ADR-0011):** key-discriminated, ≥ 0.5.0; the shipped `type:`-style workflows are a blocking behavioural migration for the Archon boxes.

## Per-step contract (what every step delivers)

- Start in **plan mode**; grill the maintainer on the step's "Open questions" before editing.
- Honour the locked decisions + the confirmed Archon schema.
- **Archon boxes** (`/build`, `/qa`, `/pr-review`, `/explore`): author/port the workflow YAML in `.archon/workflows/` + command stub in `.archon/commands/`. **Skill boxes** (the rest): author the command/skill under `commands/`, composing Matt's originals + team system-skills; touch `lib/` only for tracker-agnostic deterministic IP.
- Read specifics from `.archon/unic-dlc.config.yaml`; compose the configured skill/CLI/MCP for any system access.
- Add/edit ADRs in `apps/claude-code/unic-archon-dlc/docs/adr/` as the step notes.
- `pnpm --filter unic-archon-dlc typecheck` + `test` green; `pnpm bump` + CHANGELOG entry if shipping.
- Open a PR to `develop` (per repo Gitflow). One PR per step.
- **Update the [Progress](#progress--update-after-each-step) table** with the maintainer — set the row's Status (→ ✅) and add the PR link — as part of the step's Definition of Done, before opening the PR.

## Suggested skills per step

`/grilling` + `/domain-modeling` (all design steps) · `/archon` (Archon-box authoring/schema) · `/tdd` (lib changes) · `/handoff` (to bridge into the next step's fresh session). Plus the **team system-skill** for the box's target system (e.g. `azure-devops-cli`, a Confluence skill, the Figma MCP).
