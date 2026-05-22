# Feature Runner

The Feature Runner is the `/implement-feature` skill. It automates the implementation side of the AI-development cycle: given a Feature slug, it creates an isolated branch, works through all `ready-for-agent` issues in dependency order using `/tdd`, opens a pull request, and marks each issue `resolved`.

Invoke it with `/implement-feature <slug>` (named Feature) or `/implement-feature` (auto-select). Compose it with `/loop` for overnight queue draining.

## Lifecycle

```
feature selected → worktree created → issues implemented in topological order → PR opened → issues closed on merge
```

### 1. Feature selection

- **Named**: `/implement-feature <slug>` targets `docs/issues/<slug>/` directly.
- **Auto-select**: `/implement-feature` with no argument scans `docs/issues/` and picks the first Feature (alphabetically by slug) where at least one `NN-*.md` file is `ready-for-agent` and no file is in an unprepped state (`needs-triage`, `needs-info`, `needs-specs`). Partially-completed Features (mix of `resolved` and `ready-for-agent`) are included — the runner resumes from where it stopped. Features where every issue is `resolved`, `closed`, or `rejected` are skipped (nothing left to run). Issues with status `ready-for-human` or `rejected` do not disqualify a feature.
- **Empty queue**: when no qualifying Feature exists, the runner emits `LOOP_COMPLETE` on its own line and exits cleanly. This is the stop signal that `/loop` uses to terminate an overnight run.

### 2. Worktree creation

The runner creates (or reuses) a git worktree and branch:

- Branch: `feature/afk/<slug>`
- Worktree path: `.claude/worktrees/<slug>`

If `.claude/worktrees/<slug>` already exists (prior failed run), the runner reuses it — `git worktree add` is skipped and the existing branch retains its committed work. If it does not exist, the runner creates it from `develop`. On success, the worktree is removed after the PR is opened. On failure, it is left in place for inspection.

### 3. Issue implementation

Issues are executed via `/tdd` sub-agent invocations in **topological order** derived from `## Blocked by` references (see [Dependency ordering](#dependency-ordering) below). Only `ready-for-agent` issues are executed. `resolved`, `closed`, and `rejected` issues satisfy dependencies but are skipped. `ready-for-human` issues are unsatisfied — if a `ready-for-agent` issue depends on one, the runner halts before executing anything.

Before each invocation the runner outputs:

```
Implementing issue N of M: <issue title>
```

After a successful `/tdd` invocation, the issue file is updated: `Status: ready-for-agent` → `Status: resolved`.

On failure, a note is appended to the failing issue under `## Comments` (see [Failure behaviour](#failure-behaviour)) and the runner stops. No subsequent issues run.

### 4. PR and cleanup

When all issues are resolved, the runner:

1. Pushes `feature/afk/<slug>` to origin.
2. Opens a pull request targeting `develop` via `gh pr create`. The PR title is `feat(<slug>): <PRD title>` and the body references the PRD and lists all resolved issues.
3. Removes the worktree.

Issues remain at `Status: resolved` until the PR is merged, at which point they are manually marked `closed` (or via a future hook).

## Context bundle

Each `/tdd` sub-agent invocation receives a six-part context bundle assembled by the runner:

| Part                  | What it contains                                                    | Why                                                                                      |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Issue file**        | `## What to build` and `## Acceptance criteria`                     | Replaces the interactive planning phase in AFK mode                                      |
| **PRD**               | `docs/issues/<slug>/PRD.md`                                         | Carries the "why" and shared vision from the grilling session                            |
| **Sibling issues**    | All other `NN-*.md` files in the feature directory at current state | Shows what is already resolved and what is still pending                                 |
| **Scoped CONTEXT.md** | Plugin or root `CONTEXT.md` (see ADR scope below)                   | Ensures interface vocabulary and test names match the domain glossary                    |
| **Scoped ADRs**       | All `*.md` files in the scoped ADR directory                        | Communicates the architectural constraints that bind the implementation                  |
| **Recent commits**    | `git log --oneline -5`                                              | Carries the ideation trail from grilling and PRD work that landed just before the runner |

### ADR scope

ADRs are scoped to the domain of the Feature:

- **Plugin Feature**: the PRD references one or more paths under `apps/claude-code/<plugin>/` → inject `apps/claude-code/<plugin>/CONTEXT.md` and `apps/claude-code/<plugin>/docs/adr/`. Root ADRs are **not** injected.
- **Repo/tooling Feature**: no `apps/claude-code/<plugin>/` references in the PRD → inject root `CONTEXT.md` and root `docs/adr/`.

## Dependency ordering

`## Blocked by` is the canonical dependency signal, not numeric filename order. Numeric order is a UX convenience produced by `/to-issues` (it publishes blockers first so numbers usually match), but it is not an execution contract.

The runner builds a topological execution order from `## Blocked by` references across all `NN-*.md` files before executing anything.

**Conflict detection**: if an issue A lists issue B in `## Blocked by`, and B has a higher numeric prefix than A, the dependency contradicts the numeric convention. The runner halts before executing any issue and reports:

```
Feature Runner error: dependency conflict detected.
  Issue NN-<A> is blocked by NN-<B>, but NN-<B> has a higher number than NN-<A>.
  This conflicts with the numerical ordering convention. Resolve the ordering manually before re-running.
```

`## Blocked by: None`, `## Blocked by: None — can start immediately`, or a missing `## Blocked by` section all mean the issue has no predecessors.

## Failure behaviour

When a `/tdd` sub-agent cannot complete an issue:

1. The issue status is changed to `needs-info`. This prevents the auto-selection path from picking up this Feature on subsequent `/loop` iterations until the developer investigates and restores `ready-for-agent` (or closes/rejects the issue).
2. The runner appends a failure note to the issue file under `## Comments`:

```markdown
## Comments

> _This was generated by AI during triage._

**Feature Runner failure** — `/tdd` could not complete this issue. Status has been set to `needs-info`.

The worktree at `.claude/worktrees/<slug>` has been left in place for inspection. Once the issue is resolved manually, restore `**Status:** ready-for-agent` and re-run `/implement-feature <slug>` to resume. Alternatively, close or reject the issue if it should not be retried.
```

3. The runner stops. No subsequent issues in the Feature are executed.
4. The worktree is left at `.claude/worktrees/<slug>` on `feature/afk/<slug>` for inspection.

Re-running `/implement-feature <slug>` after a manual fix resumes from the first `ready-for-agent` issue (already-resolved issues are skipped via the topological filter).

## Historical cleanup convention

> **Historical note:** This section describes a one-time cleanup task from the `ralph-orchestrator` retirement (see [ADR-0030](../adr/0030-retire-ralph-adopt-archon-runner.md)). It does not apply to Features created after 2026-05.

When a spec in `docs/plans/` was marked `done` and a corresponding `docs/issues/<slug>/` directory exists, those issues were implemented via the retired Spec Runner, not the Feature Runner. They will never be processed by `/implement-feature` and should not remain at `ready-for-agent`.

**Convention**: manually mark all `NN-*.md` files in `docs/issues/<slug>/` as `closed` and append a note:

```markdown
## Comments

> _This was generated by AI during triage._

Marked `closed` — implemented via the Spec Runner (see `docs/plans/<spec-file>.md`, marked `done`). The Feature Runner was not used for this Feature.
```

This prevents the auto-selection path from picking up stale Features and keeps the issue tracker accurate.
