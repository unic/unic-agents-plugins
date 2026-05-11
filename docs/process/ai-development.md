# AI Development in This Repo — Deep Guide

This guide explains the mental model behind the AI-development workflow, the architectural decisions that make it reliable, and the failure modes to watch for. Read `docs/process/development-workflow.md` first for the quick-reference steps. This document explains the why.

---

## 1. Two runners, not one

The most important thing to understand is that this repo has two distinct execution loops, and they are not interchangeable.

|                       | Spec Runner                                                                       | Feature Runner                                             |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Input**             | `docs/plans/NN-*.md` Spec                                                         | `docs/issues/<slug>/NN-*.md` Issue                         |
| **Invocation**        | `pnpm ralph`                                                                      | `/implement-feature`                                       |
| **Format**            | Prescriptive: before/after snapshots, shell verification commands, explicit steps | Descriptive: `## What to build` + `## Acceptance criteria` |
| **Worker**            | Agent follows spec as recipe (or `/tdd` for behavioral specs)                     | `/tdd` in non-interactive AFK mode                         |
| **Completion marker** | `**Status: done**` in spec file                                                   | `Status: resolved` in issue file                           |
| **Branch**            | Current branch                                                                    | `feature/afk/<slug>` worktree                              |

**When to use which:** The Spec Runner is for building and evolving the repo itself — release tooling, CI configuration, monorepo infrastructure. The Feature Runner is for product work on top of a stable system — new plugin capabilities, improvements to existing features. A rough heuristic: if the work would change something under `packages/` or `.github/`, it belongs in a Spec. If it changes something under `apps/claude-code/<plugin>/`, it belongs in a Feature.

Both runners are backed by the same agent; the difference is in what inputs they receive and how much the agent is expected to figure out on its own.

---

## 2. The pipeline and its quality gates

Every piece of work passes through a pipeline before an agent executes it. Each stage has a human-review checkpoint:

```
docs/inbox/          ← /inbox: raw capture, no review required
       ↓
/grill-with-docs     ← human reviews every branch of the design tree
       ↓
/to-prd              ← human reviews the synthesized PRD
       ↓
/to-issues           ← human reviews the vertical slice breakdown
       ↓
/triage              ← human moves issues to ready-for-agent
       ↓
/implement-feature   ← agent executes, no human present
```

The pipeline is load-bearing. The quality of the autonomous execution at the bottom depends entirely on the quality of the decisions captured at each stage above it. A vague acceptance criterion that slips through triage will produce a vague implementation — and there is no human in the loop to catch it until the PR review.

---

## 3. Why context quality determines AFK quality

When `/tdd` runs inside the Feature Runner, it runs non-interactively. In a normal interactive session, `/tdd`'s planning phase asks the user to confirm interface changes and approve which behaviours to test before writing any code. In AFK mode there is no user to ask.

The issue's `## Acceptance criteria` replaces that conversation. The planning phase is not skipped — it was completed during the grilling and issue-writing stages. The Feature Runner simply does not repeat it at runtime.

This means there is a direct line between **grilling quality → PRD quality → issue acceptance criteria quality → implementation correctness**. If any link in that chain is weak, the agent produces a _correct-but-wrong_ implementation: code that satisfies the literal issue description but diverges from what you actually intended.

The grilling session (`/grill-with-docs`) is where that chain is forged. It is not a formality — it is the point at which ambiguity is eliminated and architectural constraints are identified. Skipping or shortcutting it shifts the cost downstream, where it is much more expensive to recover from.

---

## 4. The context bundle

When the Feature Runner invokes `/tdd` for an issue, it does not pass only the issue file. It assembles a **context bundle** from six sources:

| Input                       | Why it matters                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Issue file**              | The `## What to build` and `## Acceptance criteria` — the pre-answered plan                                                                |
| **PRD**                     | The "why" behind the feature; the shared vision from grilling. Without it, the agent reasons from a vertical slice with no broader context |
| **Sibling issue files**     | Dependency awareness; "what is already resolved" without the runner summarising                                                            |
| **Scoped CONTEXT.md**       | Domain glossary — ensures test names and interfaces match the project's vocabulary                                                         |
| **Scoped ADRs**             | Architectural constraints the implementation must respect                                                                                  |
| **Recent commits (last 5)** | The ideation trail — grilling sessions typically modify CONTEXT.md and ADRs, and those changes land in commits before the runner executes  |

### ADR scoping

Not all ADRs are relevant to all work. Root `docs/adr/` covers monorepo concerns (versioning, tagging, CI) — those are noise for plugin implementation. Per-plugin `docs/adr/` covers domain-specific decisions that directly constrain what the agent builds.

The runner infers scope from the PRD: if it references paths under `apps/claude-code/<plugin>/`, inject that plugin's ADRs and CONTEXT.md. If it references paths outside `apps/` (`.claude/`, `docs/`, `packages/`), inject the root ADRs and CONTEXT.md.

This is why CONTEXT.md and ADRs must be kept current. They are not documentation artifacts — they are runtime inputs to every AFK agent execution.

---

## 5. Writing issues that AFK agents can execute

An issue's `## Acceptance criteria` is doing two jobs: it is the definition of done for the human reviewer, and it is the planning conversation substitute for the AFK agent. It must be specific enough for both audiences.

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

## 6. Dependency ordering

Issues produced by `to-issues` are named with a numeric prefix (`01-`, `02-`, etc.) for human readability. The numbers usually reflect dependency order because `to-issues` publishes blockers first. But **numerical order is not the execution contract**.

The `## Blocked by` field in each issue is the canonical dependency signal. The Feature Runner builds a topological order from `## Blocked by` references before executing anything. If `## Blocked by` and numerical order conflict, the runner halts rather than proceeding silently in the wrong order — because a wrong execution order means downstream issues inherit a broken foundation.

When writing or reviewing issues: always fill in `## Blocked by` accurately. "None — can start immediately" is a valid and important signal. A missing or incorrect `## Blocked by` is more dangerous than a missing acceptance criterion, because the sequencing error compounds silently across every subsequent issue.

The dependency graph also reveals which issues are parallelisable (those with no blockers and no dependents). The Feature Runner serialises all execution by design — parallel issue execution is explicitly out of scope — but understanding which issues are independent helps when manually intervening in a failed run.

---

## 7. Running overnight

The Feature Runner is designed to be composable with `/loop` for unattended overnight execution:

```
/loop /implement-feature
```

When the queue empties (no qualifying feature exists — see `.claude/skills/implement-feature/SKILL.md` step 0 for the full qualification rule), the runner outputs `LOOP_COMPLETE` and the loop terminates cleanly. This mirrors the Spec Runner's `completion_promise: LOOP_COMPLETE` in `ralph.yml`.

For overnight runs to succeed, the queue must be in good shape before you start: each target feature must qualify (see SKILL.md step 0) — every issue in `{ready-for-agent, resolved, closed, rejected, ready-for-human}`, no `needs-*` states, no conflicts between `## Blocked by` and numerical order, acceptance criteria specific enough to verify without judgment. A single malformed issue will halt the runner and leave the remainder of the queue unexecuted.

If a `/tdd` invocation fails mid-feature, the failing issue is flipped to `needs-info` with a failure note appended. The runner stops. Subsequent issues in the same feature do not run — they could inherit a broken foundation. The `needs-info` flip prevents `/loop /implement-feature` from auto-selecting the same feature again until a developer triages the failure. Inspect the failure note, fix the issue or the codebase, set the issue back to `ready-for-agent`, and re-run. (Note: a Ctrl+C interrupt — as opposed to a `/tdd` failure — leaves the issue at `ready-for-agent` so a simple re-run resumes it.)

---

## 8. CONTEXT.md and ADRs as living constraints

`CONTEXT.md` and `docs/adr/` are not documentation you write once and forget. They are the vocabulary and constraint layer that every agent reads before writing code. Their quality directly affects the quality of every AFK execution.

**Update CONTEXT.md** when a new domain term is introduced or an existing term is redefined. `/grill-with-docs` does this automatically during a grilling session — terms resolved during grilling are written into CONTEXT.md inline. If a term surfaces outside a grilling session, add it manually.

**Write an ADR** when a decision is: (a) hard to reverse, (b) surprising without context, and (c) the result of a real trade-off with considered alternatives. An ADR that just restates the obvious adds noise and dilutes the ones that matter.

**Never let ADRs drift.** An ADR that no longer reflects the codebase is worse than no ADR — it misdirects the agent. If a decision is superseded, update the original ADR's status to `Superseded by ADR-NNNN` and write the new one.

The commits from your grilling sessions carry this context forward. The Feature Runner injects the last 5 commits into every `/tdd` invocation specifically because grilling sessions modify CONTEXT.md and ADRs — those changes land in commits and the agent needs the ideation trail, not just the final file state.

---

## 9. Keeping docs/plans/ and docs/issues/ in sync

The Spec Runner and Feature Runner evolved independently. Work that was implemented via the Spec Runner (i.e. a Spec in `docs/plans/` was marked `done`) may have a corresponding directory in `docs/issues/<slug>/` that was never updated. The Feature Runner will attempt to implement those stale issues if they have `ready-for-agent` status.

The convention: when a Spec is marked `**Status: done**`, check for a corresponding `docs/issues/<slug>/` directory. If it exists, mark all issue files in it `closed` and append a note:

```markdown
## Comments

> _Closed 2026-05-09 — implemented via Spec Runner (docs/plans/NN-<slug>.md marked done)._
```

This is a manual step. There is no automation for it. The `docs/agents/feature-runner.md` reference document records this convention for agents that need to be briefed on it.

---

## Related

- `docs/process/development-workflow.md` — the 8-phase quick reference
- `docs/process/ralph-loop-guide.md` — Spec Runner invocation and resumption detail
- `docs/process/spec-template.md` — spec file format
- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `docs/adr/0023-spec-template-format.md` — why specs are prescriptive
- `docs/adr/0026-tdd-dispatch-by-version-impact.md` — when the Spec Runner uses /tdd
- `docs/adr/0027-feature-runner-context-bundle.md` — what /tdd receives per invocation
- `docs/adr/0028-blocked-by-canonical-sequencing.md` — why ## Blocked by beats filename order
- `docs/adr/0029-feature-runner-afk-invocation.md` — how AFK invocation works
