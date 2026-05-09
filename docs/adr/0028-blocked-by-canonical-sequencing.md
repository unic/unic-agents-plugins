# 0028. `## Blocked by` is the canonical sequencing signal for Feature Runner issue execution

**Status:** Accepted (2026-05)

## Context

Issues in `docs/issues/<slug>/` are named with a numeric prefix (`NN-*.md`) produced by the `to-issues` skill, which publishes issues in dependency order so blockers get lower numbers. This makes numerical filename order a reliable proxy for execution order in practice.

However, `to-issues` also records explicit dependency information in each issue's `## Blocked by` field. The numeric prefix is a UX convenience — it makes the dependency graph human-readable at a glance in a file browser. It is not an execution contract. The `to-issues` skill's "Blocked by" field is the canonical representation of the dependency graph: it can express non-linear dependencies that numerical order cannot (e.g. issue 03 blocking issue 02 after a user reorders slices during review).

Treating numerical order as the execution contract would make the Feature Runner silently incorrect whenever `## Blocked by` and filename order diverge — a failure mode that would be invisible until a downstream issue ran on a broken foundation.

## Decision

The Feature Runner builds a **topological order** from `## Blocked by` references before executing any issue. Numerical filename order is used only as a tiebreaker when two issues have no dependency relationship between them.

If `## Blocked by` references conflict with numerical filename order (i.e. a lower-numbered issue declares a blocker that is a higher-numbered issue), the Feature Runner halts with an error and surfaces the conflict to the user rather than proceeding in the wrong order. Silent execution on a potentially wrong order is not acceptable.

Issues with `## Blocked by: None` (or equivalent) have no predecessors and may be placed anywhere in the topological order consistent with their number.

## Considered options

- **Numerical order only** — simpler to implement; no graph parsing required. Rejected: not an execution contract; silently wrong when user reorders slices or when `to-issues` produces a non-linear dependency graph.
- **`## Blocked by` order, silent fallback to numerical on conflict** — avoids halting. Rejected: a conflict between the two signals indicates a malformed feature (either the issue was hand-edited or `to-issues` produced unexpected output); proceeding silently would compound the error.
- **`## Blocked by` order, halt on conflict** — chosen. Forces the human to resolve ambiguity before the autonomous run begins, preventing downstream issues from inheriting a broken foundation.

## Consequences

- The Feature Runner skill must parse `## Blocked by` fields and construct a dependency graph before beginning execution.
- Features where `## Blocked by` and numerical order disagree will not run until the conflict is resolved by the developer.
- The `to-issues` skill's practice of publishing issues in dependency order (blockers first) remains a useful convention that keeps numerical order and the dependency graph aligned in the common case.
- The dependency graph also reveals which issues are parallelisable (those with `## Blocked by: None` and no dependents). The Feature Runner serialises all execution regardless — see the Feature Runner PRD Out of Scope for the rationale.
