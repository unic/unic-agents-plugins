# Feature Runner

The **Feature Runner** is the concept of a runner that implements a Feature's issues end-to-end in one worktree, branch, and pull request — see root `CONTEXT.md`.

## Current state

- **Current default — manual `/tdd` per issue.** Until the AFK runner is wired into this repo, the developer drives `/tdd` against each `ready-for-agent` issue, respects `## Blocked by` order ([ADR-0028](../adr/0028-blocked-by-canonical-sequencing.md)), marks the issue `resolved`, and opens a PR targeting `develop` once the feature's issues are done.
- **Long-term AFK runner — `unic-dlc-build`.** Shipped by `unic-archon-dlc` (also developed in this monorepo). See [ADR-0030](../adr/0030-retire-ralph-adopt-archon-runner.md) for the retirement of `ralph-orchestrator` and [ADR-0031](../adr/0031-retire-implement-feature-skill.md) for the retirement of the interim `/implement-feature` skill that briefly filled this role.

## What survives across runners

Regardless of which runner executes a Feature, these conventions hold:

- Issues live at `docs/issues/<slug>/NN-*.md` with the `## What to build` / `## Acceptance criteria` format.
- `## Blocked by` is the canonical execution-order signal ([ADR-0028](../adr/0028-blocked-by-canonical-sequencing.md)). Numeric filename prefixes are a UX convenience, not a contract.
- Each Feature ships as a single PR targeting `develop`. Issues are marked `resolved` on implementation and `closed` after the PR merges.

## Related

- [`docs/process/development-workflow.md`](../process/development-workflow.md) — phase-by-phase workflow
- [`docs/process/ai-development.md`](../process/ai-development.md) — deep guide: mental model, context quality, AFK trust chain
- [`docs/agents/issue-tracker.md`](issue-tracker.md) — issue file conventions
- [`docs/agents/triage-labels.md`](triage-labels.md) — 8-state triage vocabulary
