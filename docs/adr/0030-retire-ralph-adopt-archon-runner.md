# 0030. Retire ralph-orchestrator; adopt unic-archon-dlc as the Spec Runner

**Status:** Accepted (2026-05)

## Context

`ralph-orchestrator` (`@ralph-orchestrator/ralph-cli`) was used as the Spec Runner for all `docs/plans/` specs at both the monorepo root and per-plugin level (see [ADR-0020](0020-per-plugin-ralph-loops.md), [ADR-0024](0024-ralph-atomic-iteration.md)). By 2026-05 all 18 monorepo-level specs (00–17) and all prior plugin specs were marked done. The `docs/plans/` format was a bootstrap mechanism, not a permanent intake path.

Two factors drove the retirement:

1. **Windows incompatibility** — `ralph-cli` has no Windows support. CI runs on Windows (see [ADR-0014](0014-ci-matrix-three-os-two-node.md)); contributors on Windows could not run the spec loop locally.
2. **Strategic direction** — `unic-archon-dlc` is being developed as an Archon-powered AI development lifecycle harness that this monorepo both ships and consumes. Its `unic-dlc-build` workflow is the intended long-term runner; converging on one tool reduces the harness surface.

## Decision

- Remove `@ralph-orchestrator/ralph-cli` from `package.json` and `pnpm-workspace.yaml`.
- Delete all `ralph.yml`, `PROMPT.md`, and `.ralph/` artifacts from the repo root and all plugin directories.
- Remove the `pnpm ralph` and per-plugin `ralph` scripts.
- Retire the `docs/plans/` spec format; specs 12–16 for `pr-review` are the last batch.
- Remove **Spec** and **Spec Runner** from `CONTEXT.md`; the **Feature Runner** (backed by `unic-dlc-build`) is the sole runner going forward.
- In the interim, individual specs are implemented manually via `/tdd`.

## Consequences

- No CLI wrapper exists for running specs during the transition; developers invoke `/tdd` directly.
- Future work items enter through the issue tracker as Features, not as `docs/plans/` spec files.
- `unic-dlc-build` must be production-ready before fully automated AFK runs resume.
- ADR-0020 and ADR-0024 are superseded by this decision.
