# Plan workflow — specs, to-prd, and first PR gate

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

First half of the `plan` workflow: a grill-with-docs interview, live ADR writes for non-obvious decisions, a structured PRD output, and the first human approval gate.

In scope:

- `.archon/workflows/plan.yaml` (extended by slice 07).
- `/unic-dlc-plan` command file.
- **`specs` node — grill-with-docs style:**
  - Loads `CONTEXT.md`, `CONTEXT-MAP.md` (if present), all existing ADRs from `docs/adr/`, and `docs/workflow/<slug>/findings.md` if present.
  - Conducts an adversarial interview, **one question at a time**, challenging terminology against the domain glossary.
  - Proposes ADR entries for non-obvious decisions as they crystallise — not for every answer. Written live into `docs/adr/NNNN-<slug>.md` at the moment the decision is made.
  - Configurable assumptions-first mode via `workflow.discuss_mode: assumptions` in `.archon/unic-dlc.config.json` (defaults to `interview`). Assumptions mode is for experienced developers in established codebases — surfaces a set of assumptions for the user to correct rather than asking from scratch.
- **`to-prd` node:** synthesises the interview transcript and live-written ADRs into `docs/workflow/<slug>/PRD.md` with the agreed structure: Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes.
- **First human PR gate (`interactive: true`):** opens a PR against the working branch with `PRD.md` and any new ADRs staged for review. Workflow pauses until the gate is approved.

Out of scope (slice 07 and 08): `to-issues`, `nyquist-map`, `plan-checker`, `yaml-gen`, second PR gate.

## Acceptance criteria

- [ ] `specs` loads CONTEXT.md and existing ADRs before the first interview question.
- [ ] Interview asks one question at a time (no multi-question batches) and rephrases when the user pushes back on terminology.
- [ ] At least one ADR is written into `docs/adr/` during a representative session that contains a non-obvious decision; sessions with only obvious answers produce zero ADRs.
- [ ] `to-prd` writes `docs/workflow/<slug>/PRD.md` with all seven structural sections present.
- [ ] `workflow.discuss_mode: assumptions` flips the interview into assumptions mode; the default mode runs full interviews.
- [ ] First human PR gate blocks the workflow until approved; rejected approvals return control to `specs` for another iteration.
- [ ] Command file uses the `unic-dlc-` prefix.

## Blocked by

- `docs/issues/unic-archon-dlc/02-full-install-hook-and-agent-docs.md`
