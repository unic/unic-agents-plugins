# 0012. Fresh-context red/green separation for anti-cheating

**Status:** Accepted (2026-06-30)

## Context

The redesign ([`docs/redesign/PLAN.md`](../redesign/PLAN.md), contract B) reworks the `/build` workflow around test-first vertical slices. The plugin's lineage is Matt Pocock's TDD discipline (slice into vertical tracer bullets; run the red→green→refactor rhythm), but `unic-archon-dlc` runs that loop **unattended (AFK)** inside Archon worktrees — there is no human watching each cycle.

That difference is load-bearing. When a single agent holds both the test and the implementation in one context, an unattended loop can **cheat**:

- it writes tests that pass the implementation it already plans to write, or
- it special-cases the implementation to its own tests.

Matt's flow tolerates a shared session because a human reviews every red and every green. An AFK pipeline has no such guard, so the isolation must be **structural**, not behavioural. This is precisely the failure mode that `ralph-orchestrator` set out to address and that a naive ralph-loop ignores.

## Decision

`/build` slices stay Matt-faithful; the **context boundary between red and green is stricter**.

```
SLICE = vertical tracer bullet (Matt-faithful; may carry several assertions for ONE demoable behaviour)
  │
  ▼ RED node   (fresh ctx)  input: slice INTENT (acceptance criteria, from tracker / issues.json)
                            write failing test(s) → RUN → assert RED → commit
  │ baton = (1) slice intent  +  (2) committed failing test   (NOT red's reasoning / session)
  ▼ GREEN node (fresh ctx)  input: slice INTENT + committed test
                            minimum impl → RUN → assert GREEN
  ▼ refactor   (placement is an open item for /build: tail of green vs separate fresh node)
```

1. **Red and green run in separate fresh-context nodes.** The generated `code-red-<id>` and `code-green-<id>` Archon nodes carry `context: fresh` (the schema convention from [ADR-0011](0011-archon-schema-target.md) — never a node-level `fresh_context:` key; inside a loop use `loop.fresh_context: true`).
2. **The baton between them is artefacts, not memory.** Green receives (a) the slice's original intent and (b) the committed failing test — it never inherits red's reasoning or session. The committed test on disk is the contract green must satisfy.
3. **Fresh ≠ blind.** Every node, even a fresh one, is fed the slice's **original intent**. Each generated `code-red-<id>` / `code-green-<id>` node injects the issue's `acceptance_criteria` into its prompt, so isolation never costs the agent the requirement it is building toward.

## Consequences

- **Divergence from Matt is deliberate and documented here.** Matt's single-session red→green→refactor is correct under human supervision; this ADR records why the AFK pipeline splits the session instead. Future contributors should not "simplify" `/build` back into one shared context — doing so removes the only structural anti-cheat guarantee.
- The `/build` redesign step (06, the keystone build step) implements the generated DAG: one `code-red-<id>` and one `code-green-<id>` per issue, `context: fresh` on both, `acceptance_criteria` injected into each prompt, `code-green-<id>` depending on `code-red-<id>` for the same issue.
- **Refactor placement is left open** for redesign step 06 to decide (tail of green vs. a separate fresh node); this ADR fixes the red/green isolation, not the refactor seam.
- Intent must be durable and external (the issue tracker / `issues.json`), since fresh nodes cannot read it from conversation memory — this dovetails with [ADR-0013](0013-tracker-single-source-of-truth.md) and [ADR-0015](0015-workflows-slug-artifact-home.md).
