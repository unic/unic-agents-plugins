---
description: Run the unic-archon-dlc triage workflow — produces HANDOFF.md and updates ROADMAP.md
---

# /unic-dlc-triage

Runs the `triage` workflow: reads current issue states from the configured tracker, reconciles them against `docs/workflow/ROADMAP.md`, and produces `HANDOFF.md` at the repo root.

## When to use

- After a session boundary to resume cleanly in a fresh context.
- As the final step of the `/unic-dlc-cleanup` workflow (reused by the cleanup DAG).
- Any time you want a status snapshot of open issues, blockers, and recent decisions.

## What it produces

- **`HANDOFF.md`** (repo root) — four sections: current phase, open issues by state, blockers, recent decisions.
- **`docs/workflow/ROADMAP.md`** — created on first run; phase status updated on each run. Human-edited sections are preserved.

## Usage

```sh
archon run .archon/workflows/triage.yaml
```

Or invoke from Claude Code:

```
/unic-dlc-triage
```

## Inspiration

- Matt Pocock skills repo — `/triage` skill pattern.
- This plugin's `docs/agents/` files (written by the install hook) provide the domain context consumed by the triage prompt nodes.
