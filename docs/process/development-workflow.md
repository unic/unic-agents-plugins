# Development Workflow

This repo follows an adapted 8-phase version of Matt Pocock's 7-phase workflow. version of Matt Pocock's 7-phase AI development workflow. The phases move from raw idea capture through AFK execution to QA, using the tools already available here.

Not every phase is required for every piece of work. A typo fix can go straight to execution. A major feature will touch every phase.

---

## Phase 1 — Capture the idea

When an idea surfaces mid-conversation or mid-task, capture it without breaking flow:

```
/inbox <one-liner>
```

This drops a file into `docs/inbox/<slug>.md`. No follow-up needed. Come back to it during triage.

If you already have enough context to start grilling immediately, skip the inbox and go straight to Phase 2.

## Phase 2 — Grill the idea

Before writing a PRD or spec, reach shared understanding with the agent:

```
/grill-with-docs
```

Use `/grill-with-docs` when the topic involves domain concepts — it is designed to update `CONTEXT.md` and ADRs alongside the grilling. Use `/grill-me` for everything else.

The grilling session walks down every branch of the design tree until the idea is concrete: edge cases surfaced, ambiguities resolved, out-of-scope items named.

**Inbox → grilling transition:** open the inbox file, pass it to `/grill-with-docs` as context, then delete the inbox file once the session completes.

## Phase 3 — Research (optional)

If the work involves an unfamiliar external API, a complex integration, or anything that would require repeated exploration in fresh context windows, cache the findings:

Ask the agent to research the topic and save results to a `research.md` file in the relevant plugin directory (e.g. `apps/claude-code/pr-review/research.md`).

Research assets are **temporary** — scoped to the current feature sprint. Delete them once the feature ships to prevent stale data from misleading future agents.

## Phase 4 — Prototype (optional)

When design or UX decisions are uncertain, prototype first. Ask the agent to generate multiple variations on a throwaway route and iterate until you have a direction you're happy with.

Commit the winning design to the codebase before writing the PRD — concrete examples are more valuable than abstract descriptions.

## Phase 5 — Write the PRD

With grilling and prototyping complete, document the destination:

```
/to-prd
```

This synthesizes the conversation into a PRD at `docs/issues/<slug>/PRD.md`, describing the end state, user stories, implementation decisions, and what's explicitly out of scope.

The PRD answers "what does done look like?" — not "how do we get there?"

## Phase 6 — Break it into issues

Turn the PRD into independently-executable tickets:

```
/to-issues
```

This creates `docs/issues/<slug>/<NN>-<ticket>.md` files — vertical slices that cut through all integration layers. Each ticket should be small enough to fit in a single agent context window.

Use the triage labels (`needs-triage` → `ready-for-agent` / `ready-for-human`) to track state. See `docs/agents/triage-labels.md`.

## Phase 7 — Execute

There are two execution paths depending on the type of work. Choose based on where the work item lives, not on personal preference — the two runners are not interchangeable.

### Spec Runner — for `docs/plans/` specs

Use the Spec Runner when implementing infrastructure, tooling, or repo-level changes captured as Specs in `docs/plans/`:

```
pnpm ralph                        # root specs
pnpm --filter <plugin> ralph      # plugin-specific specs
```

Specs follow a prescriptive format (before/after snapshots, shell verification commands, acceptance criteria). The Spec Runner implements one Spec per iteration, commits, and stops. See `docs/process/ralph-loop-guide.md`.

### Feature Runner — for `docs/issues/` features

Use the Feature Runner when implementing product features tracked as Issues in `docs/issues/<slug>/`. Once all issues in a feature reach `ready-for-agent`:

```
/implement-feature <slug>         # target a specific feature
/implement-feature                # auto-select next ready feature
```

The Feature Runner builds a dependency graph from `## Blocked by` references, invokes `/tdd` non-interactively for each issue in topological order, marks each issue `resolved` on completion, and opens a PR targeting `develop` when all issues are done.

Compose with `/loop` for overnight queue draining:

```
/loop /implement-feature
```

The runner outputs `LOOP_COMPLETE` when the queue is empty, which terminates the loop cleanly.

### Human execution

Tickets marked `ready-for-human` require judgment that cannot be delegated to an agent. Work through them by hand, following the same red-green-refactor discipline as `/tdd`. Mark the issue `resolved` when done.

## Phase 8 — QA

After execution, have the agent generate a QA plan: specific test scenarios, edge cases, and acceptance criteria to verify manually.

Human QA often surfaces new issues or improvement ideas — add them back to the issue tracker and loop through Phases 6–8 until the feature is polished.

---

## Quick reference

| Phase        | When                             | Tool                                          |
| ------------ | -------------------------------- | --------------------------------------------- |
| 1. Capture   | Idea surfaces mid-task           | `/inbox <one-liner>`                          |
| 2. Grill     | Before any PRD or spec           | `/grill-with-docs` or `/grill-me`             |
| 3. Research  | Unfamiliar external dependencies | `research.md` (ad hoc)                        |
| 4. Prototype | Uncertain design or UX           | Ad hoc throwaway route                        |
| 5. PRD       | After grilling                   | `/to-prd` → `docs/issues/<slug>/PRD.md`       |
| 6. Issues    | After PRD                        | `/to-issues` → `docs/issues/<slug>/<NN>-*.md` |
| 7a. Execute (Spec)    | Specs in `docs/plans/` are ready       | `pnpm ralph` (Spec Runner)                    |
| 7b. Execute (Feature) | Issues in `docs/issues/` are `ready-for-agent` | `/implement-feature` (Feature Runner) |
| 8. QA        | After execution                  | QA plan (agent-generated, human-verified)     |

## Related

- `docs/inbox/README.md` — inbox conventions
- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `docs/process/ralph-loop-guide.md` — Spec Runner detail
- `docs/process/spec-template.md` — spec file format
- `docs/process/ai-development.md` — deep guide: mental model, context quality, AFK trust chain, key decisions
