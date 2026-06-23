# unic-archon-dlc redesign — handoff sessions

This directory drives the refactor of `unic-archon-dlc` into a Matt-Pocock-aligned, one-workflow-per-box set. Read **[PLAN.md](./PLAN.md)** first — it is the canonical spec. Each numbered file below is a **self-contained prompt** for one fresh Claude Code session. Do them **in order**; each commits durable artifacts (workflow YAML, ADRs, lib changes) that later steps read from the repo, so a cold session always picks up cleanly.

## How to run a step

1. Start a **fresh** Claude Code session at the repo root (`unic-agents-plugins`).
2. Paste that step's invocation prompt (table below).
3. The session starts in plan mode, grills you on the step's open questions, then implements and opens a PR to `develop`.
4. Merge the PR, then move to the next step.

> Why fresh sessions: this is the [smart-zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone) / artifact-as-baton discipline the plan itself prescribes — state lives in the repo + tracker, not in conversation memory.

## Invocation prompts (one per step, in order)

| # | Step | Paste this into a fresh session |
|---|------|--------------------------------|
| 00 | Archon schema pre-work | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/00-prework-archon-schema.md to the letter. Start in plan mode.` |
| 01 | Foundations (PRD + ADRs + doc edits) | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/01-foundations.md to the letter. Start in plan mode.` |
| 02 | `/handoff` workflow | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/02-handoff.md to the letter. Start in plan mode.` |
| 03 | `/setup` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/03-setup.md to the letter. Start in plan mode.` |
| 04 | `/specs` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/04-specs.md to the letter. Start in plan mode.` |
| 05 | `/tickets` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/05-tickets.md to the letter. Start in plan mode.` |
| 06 | `/build` (keystone) | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/06-build.md to the letter. Start in plan mode.` |
| 07 | `/triage` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/07-triage.md to the letter. Start in plan mode.` |
| 08 | `/qa` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/08-qa.md to the letter. Start in plan mode.` |
| 09 | `/pr-review` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/09-pr-review.md to the letter. Start in plan mode.` |
| 10 | `/improve-architecture` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/10-improve-architecture.md to the letter. Start in plan mode.` |
| 11 | `/cleanup` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/11-cleanup.md to the letter. Start in plan mode.` |
| 12 | `/explore` | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/12-explore.md to the letter. Start in plan mode.` |
| 13 | Finalize diagram + docs | `Follow apps/claude-code/unic-archon-dlc/docs/redesign/13-finalize.md to the letter. Start in plan mode.` |

## Shared context (every step assumes this)

These are LOCKED (PLAN.md has detail). Each step honours them; do not re-litigate without flagging.

- **One workflow per box**, independently runnable + resumable. Artifact = baton.
- **Box set** — MAIN: `/specs → /tickets → /build → /pr-review → /qa`. ON-RAMPS: `/triage`, `/qa` findings, humans → agent-ready issues. OFF-LINE: `/setup`, `/explore`, `/improve-architecture`, `/cleanup`, `/handoff`.
- **Gates: HITL by default, AFK opt-in** per workflow via `/setup` (`gates.<workflow>: hitl|afk`).
- **Integration contract:** intent → tracker (acceptance criteria on the issue); artifacts → `workflows/<slug>/` (NOT `docs/`); code → worktree. No conversation-memory reliance. `slug` keys worktree/branch + artifact dir.
- **Red/green = fresh-context anti-cheat**: RED node (fresh) writes+commits failing test from slice intent; GREEN node (fresh) gets intent + committed test, never red's reasoning.
- **Generic / installable / tweakable.** No Prism/Figma/Storybook specifics in generic workflows.
- **Archon schema:** use whatever step 00 confirmed and wrote back into PLAN.md.

## Per-step contract (what every step delivers)

- Start in **plan mode**; grill the maintainer on the step's "Open questions" before editing.
- Honour the locked decisions + the confirmed Archon schema.
- Update the relevant workflow YAML in `.archon/workflows/`, command stub in `.archon/commands/`, and any `lib/` modules.
- Add/edit ADRs in `apps/claude-code/unic-archon-dlc/docs/adr/` as the step notes.
- `pnpm --filter unic-archon-dlc typecheck` + `test` green; `pnpm bump` + CHANGELOG entry if shipping.
- Open a PR to `develop` (per repo Gitflow). One PR per step.

## Suggested skills per step

`/grilling` + `/domain-modeling` (all design steps) · `/archon` (workflow authoring/schema) · `/tdd` (lib changes) · `/handoff` (to bridge into the next step's fresh session).
