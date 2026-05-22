# AI Development in This Repo — Deep Guide

This guide explains the mental model behind the AI-development workflow, the architectural decisions that make it reliable, and the failure modes to watch for. Read `docs/process/development-workflow.md` first for the quick-reference steps. This document explains the why.

---

## 1. The Feature Runner

A **Feature Runner** is the skill that implements a Feature's issues end-to-end in one worktree, branch, and pull request (see root `CONTEXT.md`).

New work enters as a GitHub Issue — the canonical tracker for state and ownership (see [docs/agents/issue-tracker.md](../agents/issue-tracker.md)). Once an idea is grilled into a Feature, `/to-prd` and `/to-issues` materialise a `docs/issues/<slug>/` directory with the PRD and the numbered ticket files the Feature Runner reads. GitHub Issues remain the source of truth for triage state; `docs/issues/<slug>/` is the markdown artifact set that captures the grilled scope. Not every GitHub Issue becomes a Feature directory (small fixes never need one).

|                       | Feature Runner                                             |
| --------------------- | ---------------------------------------------------------- |
| **Input**             | `docs/issues/<slug>/NN-*.md` Issue                         |
| **Format**            | Descriptive: `## What to build` + `## Acceptance criteria` |
| **Worker**            | `/tdd`                                                     |
| **Completion marker** | `Status: resolved` in issue file                           |
| **Branch**            | `feature/<name>` (or `feature/afk/<slug>` when AFK)        |

`unic-dlc-build` (shipped by `unic-archon-dlc`) is the long-term Feature Runner — see [ADR-0030](../adr/0030-retire-ralph-adopt-archon-runner.md) and [ADR-0031](../adr/0031-retire-implement-feature-skill.md). Until it is wired into this repo, the runner is **the developer driving `/tdd` manually**, one issue at a time. Infrastructure work (CI, tooling, packages) and product work (plugin features) both enter through the issue tracker — the split is in the issue content, not in which runner handles it.

---

## 2. The pipeline and its quality gates

Every piece of work passes through a pipeline before an agent executes it. Each stage has a human-review checkpoint:

```
GitHub Issue / /triage  ← raw capture, no review required
       ↓
/grill-with-docs        ← human reviews every branch of the design tree
       ↓
/to-prd                 ← human reviews the synthesized PRD
       ↓
/to-issues              ← human reviews the vertical slice breakdown
       ↓
/triage                 ← human moves issues to ready-for-agent
       ↓
/tdd  (or unic-dlc-build, when wired up)  ← execution
```

The pipeline is load-bearing. The quality of the execution at the bottom depends entirely on the quality of the decisions captured at each stage above it. A vague acceptance criterion that slips through triage will produce a vague implementation. Under manual `/tdd` you can still catch it interactively; under AFK execution there is no human in the loop until PR review.

---

## 3. Why context quality determines AFK quality

`/tdd` is interactive by default: its planning phase asks the user to confirm interface changes and approve which behaviours to test before writing any code. When `/tdd` is run interactively, that conversation is where most ambiguity is eliminated.

In AFK mode (the future `unic-dlc-build` path) there is no user to ask. The issue's `## Acceptance criteria` replaces that conversation. The planning phase is not skipped — it must have been completed during the grilling and issue-writing stages.

This means there is a direct line between **grilling quality → PRD quality → issue acceptance criteria quality → implementation correctness**. If any link in that chain is weak, the agent produces a _correct-but-wrong_ implementation: code that satisfies the literal issue description but diverges from what you actually intended.

The grilling session (`/grill-with-docs`) is where that chain is forged. It is not a formality — it is the point at which ambiguity is eliminated and architectural constraints are identified. Skipping or shortcutting it shifts the cost downstream, where it is much more expensive to recover from.

---

## 4. Writing issues that AFK agents can execute

An issue's `## Acceptance criteria` is doing two jobs: it is the definition of done for the human reviewer, and it is the planning conversation substitute for any AFK agent. It must be specific enough for both audiences.

**Good acceptance criteria** are checkable without ambiguity:

```markdown
## Acceptance criteria

- [ ] `grep -nF '🤖 *Reviewed by Claude Code*' commands/review-pr.md` → matches at every signature location
- [ ] `pnpm --filter pr-review test` passes
- [ ] `pnpm typecheck` passes
```

**Bad acceptance criteria** leave the agent to interpret intent:

```markdown
## Acceptance criteria

- [ ] The feature works correctly
- [ ] Tests pass
```

The `to-issues` skill produces acceptance criteria — but an agent authors them. They are then reviewed by you before the issue reaches `ready-for-agent`. That review is the last human checkpoint before AFK execution. Use it.

If an issue's acceptance criteria are too vague to verify without judgment, the issue is not `ready-for-agent`. Send it back to `needs-specs`.

---

## 5. Dependency ordering

Issues produced by `to-issues` are named with a numeric prefix (`01-`, `02-`, etc.) for human readability. The numbers usually reflect dependency order because `to-issues` publishes blockers first. But **numerical order is not the execution contract**.

The `## Blocked by` field in each issue is the canonical dependency signal — see [ADR-0028](../adr/0028-blocked-by-canonical-sequencing.md). Any Feature Runner (manual or AFK) must respect `## Blocked by` over filename order. If they conflict, the runner halts rather than proceeding silently in the wrong order — because a wrong execution order means downstream issues inherit a broken foundation.

When writing or reviewing issues: always fill in `## Blocked by` accurately. "None — can start immediately" is a valid and important signal. A missing or incorrect `## Blocked by` is more dangerous than a missing acceptance criterion, because the sequencing error compounds silently across every subsequent issue.

The dependency graph also reveals which issues are parallelisable (those with no blockers and no dependents). The current `/tdd`-per-issue flow serialises execution by default; understanding which issues are independent helps when manually intervening in a failed run.

---

## 6. CONTEXT.md and ADRs as living constraints

`CONTEXT.md` and `docs/adr/` are not documentation you write once and forget. They are the vocabulary and constraint layer that every agent reads before writing code. Their quality directly affects the quality of every execution — manual or AFK.

**Update CONTEXT.md** when a new domain term is introduced or an existing term is redefined. `/grill-with-docs` does this automatically during a grilling session — terms resolved during grilling are written into CONTEXT.md inline. If a term surfaces outside a grilling session, add it manually.

**Write an ADR** when a decision is: (a) hard to reverse, (b) surprising without context, and (c) the result of a real trade-off with considered alternatives. An ADR that just restates the obvious adds noise and dilutes the ones that matter.

**Never let ADRs drift.** An ADR that no longer reflects the codebase is worse than no ADR — it misdirects the agent. If a decision is superseded, update the original ADR's status to `Superseded by ADR-NNNN` and write the new one.

The commits from your grilling sessions carry this context forward. When `unic-dlc-build` later runs AFK, recent commits are part of the context input precisely because grilling sessions modify CONTEXT.md and ADRs — those changes land in commits and the agent needs the ideation trail, not just the final file state.

---

## 7. Historical: docs/plans/ and the interim `/implement-feature` skill

Two earlier execution paths have been retired:

- **`docs/plans/`** was the intake path for monorepo infrastructure specs (00–17), implemented by `ralph-orchestrator`. All specs are complete and the format is retired as of 2026-05. See [ADR-0030](../adr/0030-retire-ralph-adopt-archon-runner.md).
- **`/implement-feature`** was an interim Claude Code skill that wrapped `/tdd` in a non-interactive sub-agent loop. It was retired in favour of converging on a single Feature Runner (`unic-dlc-build`). See [ADR-0031](../adr/0031-retire-implement-feature-skill.md). [ADRs 0027](../adr/0027-feature-runner-context-bundle.md) and [0029](../adr/0029-feature-runner-afk-invocation.md) describe its internals and are superseded.

If you encounter `docs/issues/<slug>/` directories whose issues were never closed because they were implemented via a spec or by the retired skill, mark them `closed` with a note referencing the work that covered them.

---

## Related

- `docs/process/development-workflow.md` — the 8-phase quick reference
- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `docs/adr/0026-tdd-dispatch-by-version-impact.md` — when to use /tdd vs direct implementation (dispatch by version impact)
- `docs/adr/0028-blocked-by-canonical-sequencing.md` — why ## Blocked by beats filename order
- `docs/adr/0030-retire-ralph-adopt-archon-runner.md` — retirement of ralph and docs/plans/
- `docs/adr/0031-retire-implement-feature-skill.md` — retirement of /implement-feature and /inbox
