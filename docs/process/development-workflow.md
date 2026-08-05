# Development Workflow

This repo follows an adapted 8-phase version of Matt Pocock's 7-phase AI development workflow. The phases move from raw idea capture through execution to QA, using the tools already available here.

Not every phase is required for every piece of work. A typo fix can go straight to execution. A major feature will touch every phase.

---

## Phase 1 — Capture the idea

When an idea surfaces mid-conversation or mid-task, capture it without breaking flow by opening a GitHub Issue directly (or running `/triage` and letting it walk the idea through the state machine).

GitHub Issues are the canonical tracker (see [docs/agents/issue-tracker.md](../agents/issue-tracker.md)) — they hold raw ideas, bug reports, triage state, and from Phase 5 onward the spec and its tickets. A Feature that wants a durable markdown artefact set also gets a `docs/issues/<slug>/` directory, created by hand; most work never needs one.

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

## Phase 5 — Write the spec

With grilling and prototyping complete, document the destination:

```
/to-spec
```

This synthesizes the conversation into a spec — problem statement, solution, user stories, implementation decisions, out-of-scope — and **publishes it as a GitHub issue**. It proposes the seams it intends to test at and checks them with you first. It does not write a file.

The spec answers "what does done look like?" — not "how do we get there?"

## Phase 6 — Break it into tickets

Turn the spec into independently-executable tickets:

```
/to-tickets
```

This publishes **one GitHub issue per ticket**, in dependency order so each can reference real identifiers, linked with GitHub's native sub-issue and blocking relationships. Each ticket is a vertical slice that cuts through all integration layers, small enough to fit in a single agent context window.

Two things to know about the output:

- **Both skills apply `ready-for-agent` themselves** on publish. Under this repo's 8-state vocabulary that label is a triage decision, so treat theirs as a proposal: review the acceptance criteria before dispatching anything to an agent. See `docs/agents/triage-labels.md` for the full order (`needs-triage` → `needs-info` → `needs-specs` → `ready-for-agent` / `ready-for-human` → `resolved` → `closed`, or `rejected`).
- **`docs/issues/<slug>/` is a repo convention, not skill output.** Nothing generates it since upstream v1.1 — `to-tickets`' local-file mode writes `.scratch/<slug>/issues/` and is only reached when no real tracker is configured. Existing `docs/issues/<slug>/` directories are the durable artefact set from earlier Features; create one by hand when a Feature wants file-based tickets.

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

| Phase        | When                             | Tool                                                         |
| ------------ | -------------------------------- | ------------------------------------------------------------ |
| 1. Capture   | Idea surfaces mid-task           | GitHub Issue (or `/triage`)                                  |
| 2. Grill     | Before any spec                  | `/wayfinder`, `/grill-with-docs` or `/grill-me`              |
| 3. Research  | Unfamiliar external dependencies | `/research` (or `research.md`, ad hoc)                       |
| 4. Prototype | Uncertain design or UX           | `/prototype`                                                 |
| 5. Spec      | After grilling                   | `/to-spec` → one GitHub issue                                |
| 6. Tickets   | After the spec                   | `/to-tickets` → one GitHub issue per ticket, natively linked |
| 7. Execute   | Tickets are `ready-for-agent`    | `/tdd` or `/implement` per issue, `/archon-rollout` for AFK  |
| 8. QA        | After execution                  | QA plan (agent-generated, human-verified)                    |

## Related

- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `docs/process/ai-development.md` — deep guide: mental model, context quality, AFK trust chain, key decisions
