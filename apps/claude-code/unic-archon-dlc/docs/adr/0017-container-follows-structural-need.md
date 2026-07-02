# 0017. Container follows structural need (Archon for AFK, commands/skills for interactive)

**Status:** Accepted (2026-07-02)

> **Amended (2026-07-02):** per the earns-its-place test ([ADR-0021](0021-earns-its-place-compose-verbatim.md)), `/handoff` and `/prototype` are **referenced Matt skills, not shipped** (verbatim wrappers add nothing). Matt's skill suite is a declared dependency that `/setup` verifies.

## Context

[ADR-0014](0014-workflow-per-box-decomposition.md) fixed the **box set** but framed every box as an _Archon workflow_ ("one Archon workflow per box"). Building `/handoff` exposed the flaw: an Archon workflow runs in an **isolated git worktree with fresh context** and has **no access to the live conversation** — yet `/handoff`'s entire job is compacting the current conversation. It is _structurally impossible_ as an Archon workflow. That is not a `/handoff` quirk; it is a test that classifies every box. Matt Pocock's skills — the process we're honouring — use **zero Archon**; they are all in-session skills because they are conversation-driven.

## Decision

The **container follows the box's structural need**, not a blanket rule:

> **Archon workflow** ⟺ work that runs **unattended, in an isolated worktree, needing no live conversation.** > **Claude Code command/skill** ⟺ work that needs the **live conversation** (grilling, approving, compacting) or operates on **repo-global** state.

Applying the test:

```
ARCHON (AFK, isolated, fresh-context):   /build · /qa (with an approval gate) · /pr-review · /explore
COMMANDS / SKILLS (live conversation):   /specs · /tickets · /triage · /improve-architecture · /handoff · /cleanup · /setup
                                         └─ compose Matt's originals (see ADR-0016), don't reimplement
```

Notes:

- `/build` is where Archon genuinely earns its keep — the anti-cheat red/green loop ([ADR-0012](0012-fresh-context-red-green-separation.md)) _needs_ isolation, parallelism, and fresh context.
- `/qa` is an AFK pipeline with a single interactive **approval** gate (schema per [ADR-0011](0011-archon-schema-target.md)).
- `/pr-review` is a **new** generic Archon workflow built the [ADR-0016](0016-dlc-thin-process-layer.md) way, harvesting the _review-aspect learnings_ of `unic-pr-review` (code quality, tests, silent-failure, type-design, comment-rot, intent-check, re-review) — **not** its ADO-specific code, and **not** as a dependency.
- `/cleanup` operates on repo-global git state (sibling worktrees/branches/PRs) so it cannot live _inside_ an isolated worktree → command.

## Consequences

- **Revises [ADR-0014](0014-workflow-per-box-decomposition.md):** its box set, names, revised `triage`/`cleanup`/`improve-architecture` meanings, and the _agent-ready issue_ term all stand; only its "every box is an Archon workflow" assumption is replaced by this ADR.
- The gate mode config (`gates.<box>: hitl|afk`) still applies to Archon boxes; interactive boxes are inherently HITL by being in-session.
- Redesign step docs are re-scoped: `/handoff`, `/setup`, `/specs`, `/tickets`, `/triage`, `/improve-architecture`, `/cleanup` become command/skill steps; only `/build`, `/qa`, `/pr-review`, `/explore` remain Archon-workflow steps. The `AGENTS.md`/`CONTEXT.md` sweep and step-doc rewrite follow in a subsequent PR.
