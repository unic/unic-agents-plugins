# AI Development in This Repo — Deep Guide

This guide explains the mental model behind the AI-development workflow, the architectural decisions that make it reliable, and the failure modes to watch for. Read `docs/process/development-workflow.md` first for the quick-reference steps. This document explains the why.

---

## 1. The Feature Runner

A **Feature Runner** is whatever implements a Feature's Issues end-to-end in one worktree, branch, and pull request (see root `CONTEXT.md`).

New work enters as a GitHub Issue — the canonical tracker for state and ownership (see [docs/agents/issue-tracker.md](../agents/issue-tracker.md)). Once an idea is charted into a Feature, `/to-spec` publishes the spec as an issue and `/to-tickets` publishes one issue per ticket, linked by GitHub's native sub-issue and blocking relationships.

`docs/issues/<slug>/` directories hold the markdown artifact set for Features that want durable file-based tickets — `PRD.md` plus numbered ticket files a Feature Runner can read. Since upstream v1.1 **no skill generates them**; create one by hand when a Feature needs it. Most work lives in GitHub Issues alone.

|                       | Feature Runner                                                          |
| --------------------- | ----------------------------------------------------------------------- |
| **Input**             | A `ready-for-agent` GitHub issue, or `docs/issues/<slug>/NN-*.md`       |
| **Format**            | Descriptive: `## What to build` + `## Acceptance criteria`              |
| **Worker**            | `/tdd` or `/implement`                                                  |
| **Completion marker** | `resolved` label on the Issue, or `Status: resolved` in the ticket file |
| **Branch**            | `feature/<name>`, or `feature/<scope>/<issue#>-<slug>` AFK              |

Two runners operate here: **the developer driving `/tdd` or `/implement`** one issue at a time, and **`/archon-rollout`** dispatching the native `archon-fix-github-issue` workflow per issue for AFK runs. `unic-dlc-build` (shipped by `unic-archon-dlc`) is not one of them — that plugin is built here for Consumer repos and deliberately not installed against this one, see [ADR-0033](../adr/0033-de-dogfood-unic-archon-dlc.md). Infrastructure work (CI, tooling, packages) and product work (plugin features) both enter through the issue tracker — the split is in the issue content, not in which runner handles it.

---

## 2. The pipeline and its quality gates

Every piece of work passes through a pipeline before an agent executes it. Each stage has a human-review checkpoint:

```
GitHub Issue / /triage  ← raw capture, no review required
       ↓
/wayfinder              ← human resolves one decision ticket per session
  or /grill-with-docs    (single-session work: human reviews every branch)
       ↓
/to-spec                ← human approves the seams, then it publishes
       ↓
/to-tickets             ← human approves the breakdown, then it publishes
                           `ready-for-agent`
       ↓
/tdd or /implement      ← execution, or /archon-rollout for a chain
```

The pipeline is load-bearing. The quality of the execution at the bottom depends entirely on the quality of the decisions captured at each stage above it. A vague acceptance criterion that slips through triage will produce a vague implementation. Under manual `/tdd` you can still catch it interactively; under AFK execution nothing catches it, which is why the approval inside `/to-tickets` is the checkpoint that has to hold.

What makes a criterion good enough for both audiences lives in the root [`AGENTS.md`](../../AGENTS.md), "Acceptance criteria are prose" — always loaded, so no session has to reach for it.

**Keep the ready queue short: grill late, dispatch soon.** A ticket that has sat `ready-for-agent` for more than a few days describes a tree that has moved; re-grill it or close it rather than auditing it back into shape. This is the trade that replaced a pre-dispatch audit — occasionally a stale ticket ships a wrong pull request, and the cost is that one run against the two and a half hours the audit charged before every night shift.

### A gate that cannot fail is not a gate

State every check so that **not having run** fails it. A check whose "found nothing" is indistinguishable from "never executed" reports success for work it did not do, and it does so most convincingly on the night nobody is watching.

Four instances, all found in this repo within a fortnight:

| Check                                                                                   | How it failed open                                                                                                    |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A PR-review gate written as "the review has returned and carries no unresolved finding" | A review that never happened has no findings. Absence satisfied it                                                    |
| `pnpm --filter <pkg> --if-present verify:changelog`                                     | A package with no such script reported success, hiding that the gate never ran (#340)                                 |
| The changelog gate's allow-list of guarded paths                                        | It omitted `lib/**`, so a change confined there was ungated. An allow-list rots every time a plugin grows a directory |
| A test guarding three sentences of prose in `commands/setup.md` (#329)                  | Its comment claimed it protected the paragraph; each regex anchored one line, and the load-bearing sentence had none  |

The repair is the same in each case: assert the positive. A review must **exist** and be newer than the head commit. A configured step must actually have a script. A guard should deny-list what is exempt rather than allow-list what is covered, so a new directory is covered on arrival.

The fourth is worth its own sentence, because it is the one that looks least like a gate. A **prose guard** — a test asserting that a sentence still exists in a Markdown prompt — is the only protection an instruction gets, since no test executes it. Its comment describes the intent; its regexes describe the coverage; nobody compares the two. Count the assertions against the sentences you meant to hold, and prove each one by deleting its sentence and watching the test go red.

### A sweep confirms its instrument, not its claim

A claim is made by **shape** as often as by phrasing, so a completeness sweep searches for both. #363 published a phrase sweep — `last checkpoint`, `only gate`, `nothing downstream` — and five audit rounds re-ran it and confirmed it. The root `AGENTS.md` carried the same claim in its Feature-driven development paragraph, with none of those words: it made it as a pipeline arrow chain with no audit stage in it. Nobody found it by sweeping. The shape sweep written afterwards has its own blind spot — its regex refuses to cross a `|`, so it cannot see a table row, which is where `docs/process/development-workflow.md` was still saying the old thing.

Two instruments, two blind spots, and their union is still not provably complete. So **reading is the instrument and the sweep is the check on the reading**, never the other way round. Re-running someone else's command tells you their command still behaves the same way. It tells you nothing about whether the claim is true.

### Two readers see different things, and you need both

Both read a diff, after the code exists. Each holds it against a different thing, and each is blind where the other looks:

| Reader                        | Holds the code against    | Blind to                       |
| ----------------------------- | ------------------------- | ------------------------------ |
| **Acceptance-criteria audit** | what the ticket asked for | anything no criterion mentions |
| **Automated code review**     | the code itself           | what the ticket wanted         |

A PR merged in this repo passed nine CI checks and an AC audit that found every criterion met, and still implemented the wrong rule: it gated a deletion on a file header rather than on the file's name, so the very artefacts the issue existed to remove survived. What caught it was a review comment pointing at a **different** file — the README sentence promising behaviour the code did not provide. The audit could not have found it, because no criterion mentioned that sentence.

Both readers work on a diff, and that is the point. Reading a ticket against a tree — guessing which surfaces the work **will** touch — stops at the surfaces the ticket names, which is how #329's `README.md` survived a check that had already read `AGENTS.md` and `CONTEXT.md` and concluded the issue needed no documentation criterion. The AC audit found it once the code existed. Neither reader is a cheaper version of the other, and passing one is not evidence about the other.

Run both. When they disagree, the disagreement is the finding. When one is skipped, say so — on that same PR, the automated review ran with two of its dimensions silently absent, and the completion report flagged them rather than counting them clean. That flag was the only reason anyone knew the review was narrower than green suggested.

---

## 3. Why context quality determines AFK quality

`/tdd` is interactive by default: its planning phase asks the user to confirm interface changes and approve which behaviours to test before writing any code. When `/tdd` is run interactively, that conversation is where most ambiguity is eliminated.

In AFK mode (an `/archon-rollout` dispatch) there is no user to ask. The issue's `## Acceptance criteria` replaces that conversation. The planning phase is not skipped — it must have been completed during the grilling and issue-writing stages.

This means there is a direct line between **grilling quality → PRD quality → issue acceptance criteria quality → implementation correctness**. If any link in that chain is weak, the agent produces a _correct-but-wrong_ implementation: code that satisfies the literal issue description but diverges from what you actually intended.

Phase 2 is where that chain is forged — `/wayfinder` across sessions, or `/grill-with-docs` within one. It is not a formality: it is the point at which ambiguity is eliminated and architectural constraints are identified. Skipping or shortcutting it shifts the cost downstream, where it is much more expensive to recover from.

---

## 4. Dependency ordering

`to-tickets` publishes blockers first, so issue numbers usually ascend in dependency order — and in its local-file mode, filenames carry an explicit `01-`, `02-` prefix for readability. Either way, **that order is not the execution contract**.

The `## Blocked by` field in each issue is the canonical dependency signal — see [ADR-0007](../../apps/claude-code/unic-archon-dlc/docs/adr/0007-blocked-by-canonical-sequencing.md). Any Feature Runner (manual or AFK) must respect `## Blocked by` over filename order. If they conflict, the runner halts rather than proceeding silently in the wrong order — because a wrong execution order means downstream issues inherit a broken foundation.

When writing or reviewing issues: always fill in `## Blocked by` accurately. "None — can start immediately" is a valid and important signal. A missing or incorrect `## Blocked by` is more dangerous than a missing acceptance criterion, because the sequencing error compounds silently across every subsequent issue.

The dependency graph also reveals which issues are parallelisable (those with no blockers and no dependents). The current `/tdd`-per-issue flow serialises execution by default; understanding which issues are independent helps when manually intervening in a failed run.

---

## 5. CONTEXT.md and ADRs as living constraints

`CONTEXT.md` and `docs/adr/` are not documentation you write once and forget. They are the vocabulary and constraint layer that every agent reads before writing code. Their quality directly affects the quality of every execution — manual or AFK.

**Update CONTEXT.md** when a new domain term is introduced or an existing term is redefined. `/grill-with-docs` does this inline, because it composes `/domain-modeling` — terms resolved during the session are written into CONTEXT.md as they land. A `/wayfinder` map does it per decision ticket, in whichever session resolves that ticket. If a term surfaces outside either, add it manually or run `/domain-modeling` on its own.

**Write an ADR** when a decision is: (a) hard to reverse, (b) surprising without context, and (c) the result of a real trade-off with considered alternatives. An ADR that just restates the obvious adds noise and dilutes the ones that matter.

**Never let ADRs drift.** An ADR that no longer reflects the codebase is worse than no ADR — it misdirects the agent. If a decision is superseded, update the original ADR's status to `Superseded by ADR-NNNN` and write the new one.

The commits from your grilling sessions carry this context forward. When an AFK run picks the work up, recent commits are part of the context input precisely because grilling sessions modify CONTEXT.md and ADRs — those changes land in commits and the agent needs the ideation trail, not just the final file state.

---

## 6. Historical: docs/plans/ and the interim `/implement-feature` skill

Two earlier execution paths have been retired:

- **`docs/plans/`** was the intake path for monorepo infrastructure specs (00–17), implemented by `ralph-orchestrator`. All specs are complete and the format is retired as of 2026-05. See [ADR-0009](../../apps/claude-code/unic-archon-dlc/docs/adr/0009-retire-ralph-adopt-archon-runner.md).
- **`/implement-feature`** was an interim Claude Code skill that wrapped `/tdd` in a non-interactive sub-agent loop. It was retired in favour of converging on a single Feature Runner (`unic-dlc-build`). See [ADR-0010](../../apps/claude-code/unic-archon-dlc/docs/adr/0010-retire-implement-feature-skill.md). [ADRs 0006](../../apps/claude-code/unic-archon-dlc/docs/adr/0006-feature-runner-context-bundle.md) and [0008](../../apps/claude-code/unic-archon-dlc/docs/adr/0008-feature-runner-afk-invocation.md) describe its internals and are superseded.

If you encounter `docs/issues/<slug>/` directories whose issues were never closed because they were implemented via a spec or by the retired skill, mark them `closed` with a note referencing the work that covered them.

---

## Related

- `docs/process/development-workflow.md` — the 8-phase quick reference
- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `apps/claude-code/unic-archon-dlc/docs/adr/0005-tdd-dispatch-by-version-impact.md` — when to use /tdd vs direct implementation (dispatch by version impact)
- `apps/claude-code/unic-archon-dlc/docs/adr/0007-blocked-by-canonical-sequencing.md` — why ## Blocked by beats filename order
- `apps/claude-code/unic-archon-dlc/docs/adr/0009-retire-ralph-adopt-archon-runner.md` — retirement of ralph and docs/plans/
- `apps/claude-code/unic-archon-dlc/docs/adr/0010-retire-implement-feature-skill.md` — retirement of /implement-feature and /inbox
