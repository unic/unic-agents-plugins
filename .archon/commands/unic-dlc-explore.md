---
description: Run the unic-archon-dlc explore workflow — parallel research across stack, features, architecture, and pitfalls, then synthesize into docs/workflow/<slug>/findings.md
---

# /unic-dlc-explore

Runs the `explore` workflow: four parallel research agents investigate the project from different angles, then a synthesize node combines their findings into a single `findings.md` document.

## When to use

- At the start of a new feature or investigation to build a shared mental model.
- When onboarding to an unfamiliar project or module.
- Before writing a spec, to surface pitfalls and architecture constraints early.
- Any time you want a structured snapshot of what the project is, what it does, and where the risks are.

## What it produces

- **`docs/workflow/<slug>/findings.md`** — five sections:
  - **Stack** — runtime, package manager, toolchain
  - **Features** — shipped capabilities, in-progress work, planned features
  - **Architecture** — directory structure, design patterns, ADR decisions, cross-platform constraints
  - **Pitfalls** — TODOs, untested modules, CI issues, HANDOFF.md blockers
  - **Integrated Brief** — 3-5 sentence synthesis with the highest-impact next step

## Usage

```sh
archon workflow run unic-dlc-explore --input slug=<slug>
```

Or invoke from Claude Code:

```
/unic-dlc-explore <slug>
```

Replace `<slug>` with a short identifier for this exploration (e.g. `auth-refactor`, `v2-planning`).

## Workflow structure

```
research-stack  ──┐
research-features ─┤
                   ├──▶  synthesize  ──▶  findings.md
research-architecture ─┤
research-pitfalls ──┘
```

All four research nodes are independent and run in parallel. The `synthesize` node depends on all four and writes the final output.

## Inspiration

- Parallel research pattern from the Archon workflow specification.
- This plugin's `lib/findings-writer.mjs` handles idempotent directory and file creation.
