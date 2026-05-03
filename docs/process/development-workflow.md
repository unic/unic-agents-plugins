# Development Workflow

This repo follows an adapted version of Matt Pocock's 7-phase AI development workflow. The phases move from raw idea capture through AFK execution to QA, using the tools already available here.

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

Use `/grill-with-docs` when the topic involves domain concepts — it updates `CONTEXT.md` and ADRs alongside the grilling. Use `/grill-me` for everything else.

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

This synthesises the conversation into a PRD at `docs/issues/<slug>/PRD.md`, describing the end state, user stories, implementation decisions, and what's explicitly out of scope.

The PRD answers "what does done look like?" — not "how do we get there?"

## Phase 6 — Break it into issues

Turn the PRD into independently-executable tickets:

```
/to-issues
```

This creates `docs/issues/<slug>/<NN>-<ticket>.md` files — vertical slices that cut through all integration layers. Each ticket should be small enough to fit in a single agent context window.

Use the triage labels (`needs-triage` → `ready-for-agent` / `ready-for-human`) to track state. See `docs/agents/triage-labels.md`.

## Phase 7 — Execute

Work through the tickets. For agent-ready tickets:

```
pnpm ralph          # runs the Spec Runner (currently ralph-orchestrator)
```

Or for plugin-specific work:

```
cd apps/claude-code/<plugin>
pnpm ralph
```

For test-driven work, use the `/tdd` skill to enforce a red-green-refactor loop.

Tickets that require human judgment (`ready-for-human`) are done by hand following the same steps.

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
| 7. Execute   | Tickets are `ready-for-agent`    | `pnpm ralph` or `/tdd`                        |
| 8. QA        | After execution                  | QA plan (agent-generated, human-verified)     |

## Related

- `docs/inbox/README.md` — inbox conventions
- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `docs/process/ralph-loop-guide.md` — Spec Runner detail
- `docs/process/spec-template.md` — spec file format
