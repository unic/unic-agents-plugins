# 0029. Feature Runner invokes `/tdd` non-interactively; issue acceptance criteria replace the planning phase

**Status:** Accepted (2026-05)

## Context

`/tdd`'s planning phase is interactive: before writing any code it asks the user to confirm interface changes, prioritise which behaviours to test, and approve the plan. This is by design — it prevents the agent from outrunning its headlights on ambiguous requirements.

The Feature Runner's core use case is autonomous, overnight execution (composable with `/loop`). There is no user present to answer planning questions. Invoking `/tdd` as a sub-agent via the Agent tool means there is no TTY — interactive prompts cannot be issued and the planning phase cannot execute as designed.

Matt Pocock's reference AFK loop (`afk.sh`) resolves this by running Claude with `--print` (non-interactive mode) and injecting issue files as the implicit plan. The Agent tool in Claude Code is the equivalent mechanism: sub-agents run without a TTY and must infer their plan from the provided context.

## Decision

The Feature Runner invokes `/tdd` via the Agent tool (non-interactive). The issue's `## Acceptance criteria` section serves as the pre-answered planning conversation:

- `## What to build` answers "what interface changes are needed"
- `## Acceptance criteria` answers "which behaviours to test" and "what does done look like"

Because issues are produced by `to-issues` (which slices the PRD vertically and quizzes the user on the breakdown) and then reviewed by the user before reaching `ready-for-agent`, the acceptance criteria represent a human-approved definition of done. The interactive planning phase is not bypassed in substance — it was completed during the grilling and issue-writing pipeline; the Feature Runner simply does not repeat it at runtime.

`/tdd` is not modified. No AFK flag or non-interactive variant is introduced.

## Considered options

- **Fork `/tdd` into a non-interactive variant** (`/tdd-afk` or similar) — would allow explicit suppression of planning prompts. Rejected: creates a maintenance burden; the two variants would diverge over time; the Agent tool already provides non-interactive execution without any skill changes.
- **Add an AFK flag to `/tdd`** — e.g. a frontmatter option or a prompt prefix that skips planning. Rejected: couples the `/tdd` skill to the Feature Runner's invocation model; `to-issues` already produces the information that the planning phase would gather.
- **Non-interactive Agent tool invocation with injected context bundle** — chosen. No skill modifications required; the planning information is supplied via the context bundle (ADR-0027) rather than elicited at runtime.

## Consequences

- Issues that reach the Feature Runner must have specific, human-reviewed `## Acceptance criteria`. Vague criteria (e.g. "the feature works correctly") remove the planning substitute and leave `/tdd` without a concrete definition of done.
- The `to-issues` + `/triage` → `ready-for-agent` pipeline is load-bearing: it is the point at which the planning conversation occurs. The Feature Runner depends on that pipeline having been followed correctly.
- `/tdd` remains unchanged and continues to work interactively when invoked directly by the user.
- When the queue is empty (no `ready-for-agent` features remain), the Feature Runner outputs `LOOP_COMPLETE` as its stop signal. This is what makes `/loop /implement-feature` composable for overnight draining: the `/loop` skill catches `LOOP_COMPLETE` and terminates the loop cleanly rather than spinning on an empty queue. This mirrors the Spec Runner's `completion_promise: LOOP_COMPLETE` in `ralph.yml` and Matt Pocock's `<promise>NO MORE TASKS</promise>` in `afk.sh`.
