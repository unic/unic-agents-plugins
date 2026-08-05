# Feature Runner

Repo-owned. Hand-maintained — no generator writes this file.

The **Feature Runner** is the concept of a runner that implements a Feature's issues end-to-end in one worktree, branch, and pull request — see root `CONTEXT.md`.

## The two runners

- **By hand — `/tdd` or `/implement` per issue.** The developer works each `ready-for-agent` issue, respects `## Blocked by` order ([ADR-0007](../../apps/claude-code/unic-archon-dlc/docs/adr/0007-blocked-by-canonical-sequencing.md)), marks the issue `resolved`, and opens a PR targeting `develop`.
- **AFK — `/archon-rollout`.** Dispatches the native `archon-fix-github-issue` workflow per issue, each in its own worktree, respecting the dependency tree. Every run lands its own PR targeting `develop`.

`unic-dlc-build` (shipped by `unic-archon-dlc`) is **not** a runner here. That plugin is built in this monorepo for Consumer repos and is deliberately not installed against this one — see [ADR-0033](../adr/0033-de-dogfood-unic-archon-dlc.md). For the history it replaced, see [ADR-0009](../../apps/claude-code/unic-archon-dlc/docs/adr/0009-retire-ralph-adopt-archon-runner.md) (retiring `ralph-orchestrator`) and [ADR-0010](../../apps/claude-code/unic-archon-dlc/docs/adr/0010-retire-implement-feature-skill.md) (retiring the interim `/implement-feature` skill).

## What survives across runners

Regardless of which runner executes a Feature, these conventions hold:

- A ticket carries the `## What to build` / `## Acceptance criteria` shape, whether it lives as a GitHub issue (what `/to-tickets` publishes) or as `docs/issues/<slug>/NN-*.md` for a Feature that keeps a durable file set.
- `## Blocked by` is the canonical execution-order signal ([ADR-0007](../../apps/claude-code/unic-archon-dlc/docs/adr/0007-blocked-by-canonical-sequencing.md)). Numeric filename prefixes are a UX convenience, not a contract.
- Each Feature ships as a single PR targeting `develop`. Issues are marked `resolved` on implementation and `closed` after the PR merges.

## Related

- [`docs/process/development-workflow.md`](../process/development-workflow.md) — phase-by-phase workflow
- [`docs/process/ai-development.md`](../process/ai-development.md) — deep guide: mental model, context quality, AFK trust chain
- [`docs/agents/issue-tracker.md`](issue-tracker.md) — issue file conventions
- [`docs/agents/triage-labels.md`](triage-labels.md) — 8-state triage vocabulary
