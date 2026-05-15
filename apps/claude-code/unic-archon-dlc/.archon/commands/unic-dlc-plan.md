---
description: Run the unic-archon-dlc plan workflow — adversarial spec interview, PRD synthesis, and human PR gate
---

# /unic-dlc-plan

Runs the `plan` workflow: loads project context and prior research, runs an adversarial interview to surface requirements and decisions, synthesises the transcript into a structured PRD, and opens a PR for human review before proceeding.

## When to use

- After `/unic-dlc-explore` to turn research findings into a formal PRD.
- When starting a new feature and you want to stress-test assumptions before writing specs.
- Any time you need a structured `PRD.md` that captures problem, solution, stories, decisions, and scope.

## What it produces

- **`docs/workflow/<slug>/PRD.md`** — seven sections: Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes.
- **`docs/adr/NNNN-<slug>.md`** — one or more ADR files for non-obvious decisions surfaced during the interview (written live, confirmed by user).
- **PR** targeting `develop` — pauses until approved. Rejection returns control to the adversarial interview for refinement.

## Usage

```sh
archon run .archon/workflows/plan.yaml --input slug=<slug>
```

Or invoke from Claude Code:

```
/unic-dlc-plan <slug>
```

Replace `<slug>` with a short identifier for this planning session (e.g. `auth-refactor`, `v2-planning`).

## Options

Set `workflow.discuss_mode` in `.archon/unic-dlc.config.json` to control the interview style:

| Value | Behaviour |
|---|---|
| `interview` (default) | One focused, adversarial question per turn; probes deeply |
| `assumptions` | Surfaces all implicit assumptions upfront, then confirms or refutes each |

## Workflow structure

```
load-context ──▶ specs (loop) ──▶ to-prd ──▶ prd-gate (interactive)
                     ▲                              │
                     └──────── rejected ────────────┘
```

- `load-context` reads CONTEXT.md, CONTEXT-MAP.md, all ADRs, and findings.md (if present).
- `specs` runs the adversarial interview; writes ADRs live for confirmed decisions.
- `to-prd` synthesises the interview transcript into PRD.md.
- `prd-gate` validates all 7 sections, opens a PR, and waits for human approval.

## Inspiration

- The `grill-with-docs` skill — adversarial interview pattern against the domain model.
- The `to-prd` skill — structured PRD synthesis from conversation context.
- Archon PR-gate pattern for human-in-the-loop workflow checkpoints.
