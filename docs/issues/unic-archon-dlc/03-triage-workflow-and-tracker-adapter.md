# Triage workflow and tracker adapter

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

The simplest of the six workflows — `triage` — paired with the tracker adapter module that every later workflow will depend on. Builds the foundation for issue I/O across all backends.

In scope:

- **Tracker adapter module:** translates canonical label names to tracker-specific strings and produces create/update CLI command strings for each configured backend. Backends covered in v1: GitHub Issues, Azure DevOps, Jira, local markdown (per the `docs/agents/issue-tracker.md` convention in this repo: file under `docs/issues/<slug>/`, `Status:` line records triage state, comments append to a `## Comments` heading). Deep module — all tracker-specific knowledge encapsulated.
- **`/unic-dlc-triage` command** (note the `unic-dlc-` prefix — avoids collision with existing `/triage` skills) plus `.archon/workflows/triage.yaml`.
- **Workflow behaviour:** reads current issue states from the configured tracker, reconciles them against `docs/workflow/ROADMAP.md` (creates it if absent), and produces `HANDOFF.md` capturing:
  - Current phase (which workflow last ran, when, on which feature slug)
  - Open issues grouped by triage state
  - Blockers (issues whose `blocked_by` references are still open)
  - Recent decisions (latest ADR file IDs)
- **Standalone invocation:** runnable at any point in the lifecycle without prerequisites.
- **Reused as final node of `cleanup`:** the same workflow file is referenced from the cleanup DAG in slice 13. Both invocations produce the same `HANDOFF.md`.
- Tests covering the tracker adapter: for each backend, canonical label input produces the expected CLI command string. Tests also assert that absent state files are treated as "no data" rather than errors.

Out of scope: any auto-promotion of issues across states (PRD explicitly excludes this).

## Acceptance criteria

- [ ] `/unic-dlc-triage` runs end-to-end against a project with the local-markdown tracker and produces a valid `HANDOFF.md`.
- [ ] Tracker adapter handles all four backends. Each emits a syntactically valid CLI command (or the local-markdown file write) for a canonical-label input.
- [ ] `docs/workflow/ROADMAP.md` is created on first run and updated on subsequent runs; updates do not clobber human-edited sections (use marker-delimited regions for the auto-generated parts).
- [ ] `HANDOFF.md` includes all four sections: phase, open issues by state, blockers, recent decisions.
- [ ] `node:test` covers the tracker adapter (one case per backend) and the HANDOFF generator (golden-file-style assertion on a mock project state).
- [ ] Command file uses the `unic-dlc-` prefix consistently.

## Blocked by

- `docs/issues/unic-archon-dlc/02-full-install-hook-and-agent-docs.md`
