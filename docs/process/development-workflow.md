# Development Workflow

This repo follows an adapted 8-phase version of Matt Pocock's 7-phase AI development workflow. The phases move from raw idea capture through execution to QA, using the tools already available here.

Not every phase is required for every piece of work. A typo fix can go straight to execution. A major feature will touch every phase.

---

## Phase 1 — Capture the idea

When an idea surfaces mid-conversation or mid-task, capture it without breaking flow by opening a GitHub Issue directly (or running `/triage` and letting it walk the idea through the state machine).

GitHub Issues are the canonical tracker (see [docs/agents/issue-tracker.md](../agents/issue-tracker.md)) — they hold raw ideas, bug reports, and triage state. Features that get grilled additionally pick up a `docs/issues/<slug>/` directory in Phase 5, where `/to-spec` and `/to-tickets` write the spec and ticket files the Feature Runner consumes. Not every GitHub Issue grows into a Feature directory — small fixes stay as plain GitHub Issues.

If you already have enough context to start grilling immediately, skip capture and go straight to Phase 2.

## Phase 2 — Grill the idea

Before writing a PRD or spec, reach shared understanding with the agent:

```
/grill-with-docs
```

Use `/grill-with-docs` when the topic involves domain concepts — it is designed to update `CONTEXT.md` and ADRs alongside the grilling. Use `/grill-me` for everything else.

The grilling session walks down every branch of the design tree until the idea is concrete: edge cases surfaced, ambiguities resolved, out-of-scope items named.

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
/to-spec
```

This synthesizes the conversation into a PRD at `docs/issues/<slug>/PRD.md`, describing the end state, user stories, implementation decisions, and what's explicitly out of scope.

The PRD answers "what does done look like?" — not "how do we get there?"

## Phase 6 — Break it into issues

Turn the PRD into independently-executable tickets:

```
/to-tickets
```

This creates `docs/issues/<slug>/<NN>-<ticket>.md` files — vertical slices that cut through all integration layers. Each ticket should be small enough to fit in a single agent context window.

Use the triage labels to track state — see `docs/agents/triage-labels.md` for the full 8-state vocabulary (`needs-triage` → `needs-info` → `needs-specs` → `ready-for-agent` / `ready-for-human` → `resolved` → `closed` / `rejected`).

## Phase 7 — Execute

### Manual execution with `/tdd` — current default

Work through `ready-for-agent` issues one at a time with `/tdd`. For each issue, the `## Acceptance criteria` block stands in for the planning conversation. Mark the issue `resolved` when the implementation lands. Open a PR targeting `develop` once the feature's issues are done.

Respect the issue ordering signalled by `## Blocked by` (see [ADR-0007](../../apps/claude-code/unic-archon-dlc/docs/adr/0007-blocked-by-canonical-sequencing.md)) — a downstream issue inherits a broken foundation if a blocker has not landed.

### AFK execution with `/archon-rollout`

Dispatch a chain of `ready-for-agent` issues with `/archon-rollout`, which runs the native `archon-fix-github-issue` workflow per issue in its own worktree and respects the `## Blocked by` tree. Each run lands its own PR targeting `develop`.

`unic-dlc-build` (shipped by `unic-archon-dlc`) is **not** the AFK path here. That plugin is a product this repo builds for Consumer repos; it is not installed against this one — see [ADR-0033](../adr/0033-de-dogfood-unic-archon-dlc.md).

### Human execution

Tickets marked `ready-for-human` require judgment that cannot be delegated to an agent. Work through them by hand, following the same red-green-refactor discipline as `/tdd`. Mark the issue `resolved` when done.

## Phase 8 — QA

After execution, have the agent generate a QA plan: specific test scenarios, edge cases, and acceptance criteria to verify manually.

Human QA often surfaces new issues or improvement ideas — add them back to the issue tracker and loop through Phases 6–8 until the feature is polished.

---

## Quick reference

| Phase        | When                                           | Tool                                                        |
| ------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| 1. Capture   | Idea surfaces mid-task                         | GitHub Issue (or `/triage`)                                 |
| 2. Grill     | Before any PRD or spec                         | `/grill-with-docs` or `/grill-me`                           |
| 3. Research  | Unfamiliar external dependencies               | `research.md` (ad hoc)                                      |
| 4. Prototype | Uncertain design or UX                         | Ad hoc throwaway route                                      |
| 5. PRD       | After grilling                                 | `/to-spec` → `docs/issues/<slug>/PRD.md`                    |
| 6. Issues    | After PRD                                      | `/to-tickets` → `docs/issues/<slug>/<NN>-*.md`              |
| 7. Execute   | Issues in `docs/issues/` are `ready-for-agent` | `/tdd` or `/implement` per issue, `/archon-rollout` for AFK |
| 8. QA        | After execution                                | QA plan (agent-generated, human-verified)                   |

## Related

- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `docs/process/ai-development.md` — deep guide: mental model, context quality, AFK trust chain, key decisions
