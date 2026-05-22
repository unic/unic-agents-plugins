# 0031. Retire the `/implement-feature` skill; Feature Runner backed solely by `unic-dlc-build`

**Status:** Accepted (2026-05)

## Context

[ADR-0030](0030-retire-ralph-adopt-archon-runner.md) retired `ralph-orchestrator` and declared `unic-dlc-build` (shipped by `unic-archon-dlc`) the long-term Feature Runner. As an interim measure while `unic-dlc-build` matured, a `/implement-feature` Claude Code skill was added at `.claude/skills/implement-feature/`. It assembled a context bundle ([ADR-0027](0027-feature-runner-context-bundle.md)) and invoked `/tdd` as a non-interactive sub-agent for each `ready-for-agent` issue ([ADR-0029](0029-feature-runner-afk-invocation.md)).

In practice the skill was not adopted:

1. **Single-purpose duplication** — it replicated, in skill form, exactly what `unic-dlc-build` is built to do. Maintaining two runners doubled the surface for prompt drift and made it unclear which one was canonical.
2. **Agent-tool invocation is fragile** — driving `/tdd` through `Agent` with `subagent_type: general-purpose` cannot match the affordances of a dedicated harness (worktree management, retry semantics, observability). Treating the interim as a real path delayed the move to `unic-dlc-build`.
3. **Capture path conflict** — the companion `/inbox` slash command duplicated `triage`'s capture entry point. Ideas now go straight to the issue tracker (or to `triage`), so the inbox-then-grill staging area is no longer needed.

## Decision

- Remove `.claude/skills/implement-feature/` (the skill directory, references, and runner output formats).
- Remove `.claude/commands/inbox.md` and `docs/inbox/README.md`. Existing files under `docs/inbox/` remain as historical artifacts; no new ones are captured there.
- Designate `unic-dlc-build` (via `unic-archon-dlc`) as the **sole** Feature Runner implementation going forward. Until `unic-dlc-build` is wired into this repo, individual issues are implemented manually via `/tdd`, as already stated in ADR-0030.
- [ADR-0027](0027-feature-runner-context-bundle.md) and [ADR-0029](0029-feature-runner-afk-invocation.md) are superseded by this decision. Their context-bundle and AFK-invocation choices described `/implement-feature`'s internals, not portable design constraints; `unic-dlc-build` is free to make its own decisions about both.

## Consequences

- `AGENTS.md`, `CONTRIBUTING.md`, `docs/process/ai-development.md`, `docs/process/development-workflow.md`, and `docs/agents/feature-runner.md` are updated to remove references to `/implement-feature` and `/inbox` and to describe the current state (manual `/tdd`, `unic-dlc-build` as the runner).
- The Feature Runner concept (as defined in root `CONTEXT.md`) is unchanged — it remains "the skill that implements a Feature's issues end-to-end in one worktree, branch, and pull request. Backed by `unic-dlc-build`." Only the interim Claude Code skill implementation is removed.
- [ADR-0028](0028-blocked-by-canonical-sequencing.md) is **not** superseded — it defines the canonical sequencing signal (`## Blocked by`) for any Feature Runner implementation, including `unic-dlc-build`.
- Captured ideas under `docs/inbox/*.md` are not migrated automatically. They graduate to issues only when someone triages them.
