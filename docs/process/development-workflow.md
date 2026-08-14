# Development Workflow

This repo follows an adapted 8-phase version of Matt Pocock's 7-phase AI development workflow. The phases move from raw idea capture through execution to QA, using the tools already available here.

Not every phase is required for every piece of work. A typo fix can go straight to execution. A major feature will touch every phase.

---

## Phase 1 — Capture the idea

When an idea surfaces mid-conversation or mid-task, capture it without breaking flow by opening a GitHub Issue directly (or running `/triage` and letting it walk the idea through the state machine).

GitHub Issues are the canonical tracker (see [docs/agents/issue-tracker.md](../agents/issue-tracker.md)) — they hold raw ideas, bug reports, triage state, and from Phase 5 onward the spec and its tickets. A Feature that wants a durable markdown artefact set also gets a `docs/issues/<slug>/` directory, created by hand; most work never needs one.

If you already have enough context to start charting immediately, skip capture and go straight to Phase 2.

## Phase 2 — Chart the work

Before writing a spec, reach shared understanding with the agent. Pick the tool by how much there is to decide:

```
/wayfinder          # too much to plan in one agent session
/grill-with-docs    # fits in one session, touches domain concepts
/grill-me           # fits in one session, no domain vocabulary at stake
```

**`/wayfinder` is where the planning weight has moved upstream.** Use it when the fog is thicker than one session: it names the destination, charts the open decisions as a `wayfinder:map` issue with one child ticket per decision, blocks them with GitHub's native dependencies, then works the frontier — one decision per session, each ticket typed `research`, `prototype`, `grilling` or `task`. It plans; it does not build. The map is done when nothing is left to decide. See [Wayfinding operations](../agents/issue-tracker.md#wayfinding-operations) for how this repo expresses maps, blocking, and the frontier query.

Use `/grill-with-docs` when one session is enough and the topic involves domain concepts — it composes `/grilling` with `/domain-modeling`, so `CONTEXT.md` and the ADRs get updated as decisions land. Use `/grill-me` for everything else.

Either way the session walks down every branch of the design tree until the idea is concrete: edge cases surfaced, ambiguities resolved, out-of-scope items named.

## Phase 3 — Research (optional)

If the work involves an unfamiliar external API, a complex integration, or anything that would require repeated exploration in fresh context windows, cache the findings:

```
/research
```

It spins up a background agent that reads primary sources — official docs, source code, specs, first-party APIs — cites each claim, and writes one Markdown file. This repo keeps those notes in `docs/research/`, which is the convention the skill picks up. A `wayfinder` ticket labelled `wayfinder:research` is the same job scoped to one decision.

A note written **beside the code it explains** (e.g. `apps/claude-code/pr-review/research.md`) is **temporary** — scoped to the current feature sprint. Delete it once the feature ships to prevent stale data from misleading future agents. Notes in `docs/research/` are the durable set and stay.

## Phase 4 — Prototype (optional)

When design or state-model decisions are uncertain, prototype first:

```
/prototype
```

It branches on the question. "Does this logic feel right?" produces a single shareable HTML file that drives the state machine through the awkward cases, playable by a non-developer. "What should this look like?" produces several radically different UI variations on one route, switchable from a floating bar. Either way the code is throwaway. A `wayfinder` ticket labelled `wayfinder:prototype` is the same job scoped to one decision.

Commit the winning design before writing the spec — concrete examples are more valuable than abstract descriptions.

## Phase 5 — Write the spec

With charting and prototyping complete, document the destination:

```
/to-spec
```

This synthesizes the conversation into a spec and **publishes it as a GitHub issue**. Seven sections: Problem Statement, Solution, User Stories, Implementation Decisions, **Testing Decisions**, Out of Scope, Further Notes. It does not write a file.

Testing Decisions carries the seams forward into `/tdd`, which is why the skill proposes those seams and checks them with you before it writes anything — prefer existing seams, and the highest one available.

The spec answers "what does done look like?" — not "how do we get there?"

It also applies `ready-for-agent` to the spec issue itself. That label there means "the spec is settled", **not** "an agent may implement this" — the spec has no `## What to build` or `## Blocked by` edges. Phase 6 produces the implementable tickets. A rollout must skip the spec issue.

## Phase 6 — Break it into tickets

Turn the spec into independently-executable tickets:

```
/to-tickets
```

This publishes **one GitHub issue per ticket**, in dependency order so each can reference real identifiers, linked with GitHub's native sub-issue and blocking relationships. Each ticket is a vertical slice that cuts through all integration layers, small enough to fit in a single agent context window.

Two things to know about the output:

- **The human gate sits inside the skill, not after it.** `/to-tickets` iterates on the breakdown until you approve it, and only then publishes — so the `ready-for-agent` label it applies already carries your approval. Do not run `/triage` again over freshly published tickets. Approve properly inside the skill: nothing re-checks the ticket after it publishes, so that approval is the last look anyone takes at the criteria before an agent runs them. `/triage` stays the on-ramp for raw work that arrives unspecified: bug reports, external PRs, ideas. See `docs/agents/triage-labels.md` for the full order (`needs-triage` → `needs-info` → `needs-specs` → `ready-for-agent` / `ready-for-human` → `resolved` → `closed`, or `rejected`).
- **Two kinds of issue now carry `ready-for-agent`, and only one is implementable.** The spec issue from Phase 5 has it too, and a `wayfinder:map` and its decision tickets are labelled by a different scheme entirely. Before dispatching, check the Issue has the `## What to build` / `## Acceptance criteria` shape — a label match alone is not enough. `/archon-rollout` does not yet filter these out; treat its issue list as needing a glance.
- **`docs/issues/<slug>/` is a repo convention, not skill output.** Nothing generates it since upstream v1.1 — `to-tickets`' local-file mode writes `.scratch/<slug>/issues/` and is only reached when no real tracker is configured. Existing `docs/issues/<slug>/` directories are the durable artefact set from earlier Features; create one by hand when a Feature wants file-based tickets.

## Phase 7 — Execute

### Manual execution with `/tdd` — current default

Work through `ready-for-agent` issues one at a time with `/tdd`. For each issue, the `## Acceptance criteria` block stands in for the planning conversation. Mark the issue `resolved` when the implementation lands. Open a PR targeting `develop` once the feature's issues are done.

Respect the issue ordering signalled by `## Blocked by` (see [ADR-0007](../../apps/claude-code/unic-archon-dlc/docs/adr/0007-blocked-by-canonical-sequencing.md)) — a downstream issue inherits a broken foundation if a blocker has not landed.

### AFK execution with `/archon-rollout`

Dispatch a chain of `ready-for-agent` issues with `/archon-rollout`, which runs the native `archon-fix-github-issue` workflow per issue in its own worktree and respects the `## Blocked by` tree. Nothing re-checks a ticket on its way in, so keep the queue short — re-grill anything that has sat for more than a few days rather than dispatching it. Each run lands its own PR targeting `develop`.

`unic-dlc-build` (shipped by `unic-archon-dlc`) is **not** the AFK path here. That plugin is a product this repo builds for Consumer repos; it is not installed against this one — see [ADR-0033](../adr/0033-de-dogfood-unic-archon-dlc.md).

### Human execution

Tickets marked `ready-for-human` require judgment that cannot be delegated to an agent. Work through them by hand, following the same red-green-refactor discipline as `/tdd`. Mark the issue `resolved` when done.

## Phase 8 — QA

After execution, have the agent generate a QA plan: specific test scenarios, edge cases, and acceptance criteria to verify manually.

Human QA often surfaces new issues or improvement ideas — add them back to the issue tracker and loop through Phases 6–8 until the feature is polished.

---

## Quick reference

| Phase        | When                             | Tool                                                                           |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------ |
| 1. Capture   | Idea surfaces mid-task           | GitHub Issue (or `/triage`)                                                    |
| 2. Chart     | Before any spec                  | `/wayfinder` if it exceeds one session, else `/grill-with-docs` or `/grill-me` |
| 3. Research  | Unfamiliar external dependencies | `/research`                                                                    |
| 4. Prototype | Uncertain design or state model  | `/prototype`                                                                   |
| 5. Spec      | After charting                   | `/to-spec` → one GitHub issue                                                  |
| 6. Tickets   | After the spec                   | `/to-tickets` → one GitHub issue per ticket, natively linked                   |
| 7. Execute   | Tickets are `ready-for-agent`    | `/tdd` or `/implement` per issue, `/archon-rollout` for AFK                    |
| 8. QA        | After execution                  | QA plan (agent-generated, human-verified)                                      |

## Related

- `docs/agents/issue-tracker.md` — issue file conventions
- `docs/agents/triage-labels.md` — 8-state triage vocabulary
- `docs/process/ai-development.md` — deep guide: mental model, context quality, AFK trust chain, key decisions
