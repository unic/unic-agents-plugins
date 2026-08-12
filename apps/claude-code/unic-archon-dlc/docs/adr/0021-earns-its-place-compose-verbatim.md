# 0021. A box earns a shipped implementation only if it adds value; reference verbatim skills

**Status:** Accepted (2026-07-02); amended by [ADR-0030](0030-harness-hosts-methods.md)

> ADR-0030 makes this test mechanical. "Adds Unic value" became a judgement each Box answered for
> itself; the bar is now structural — a Box survives only for what no Method can supply.

## Context

[ADR-0016](0016-dlc-thin-process-layer.md) says compose team system-skills for the _how_; [ADR-0017](0017-container-follows-structural-need.md) says interactive boxes are commands/skills composing Matt Pocock's originals. Building `/handoff` exposed the next question: if a "box" would be a **verbatim wrapper** around a skill the team already has (Matt's `handoff` compacts the live conversation — exactly what our `/handoff` would do, nothing added), why ship it at all? Shipping a duplicate violates the compose-don't-reimplement principle on our _own_ surface.

## Decision

**A box earns a shipped implementation in this plugin only if it adds Unic value over the raw composed skill** — config-driven genericity, the novel deterministic IP (the build DAG, slopcheck, schema validation), tracker/docs composition, or process orchestration. If a box would be a verbatim wrapper, it is **referenced, not shipped**.

Applying the test:

| Box                     | Adds value over the raw skill?                    | Verdict                           |
| ----------------------- | ------------------------------------------------- | --------------------------------- |
| `/specs`                | branch-on-input + config templates + docs publish | ship                              |
| `/tickets`              | build-DAG gen + Nyquist + tracker composition     | ship                              |
| `/build`                | the anti-cheat Archon IP                          | ship                              |
| `/pr-review`            | generic Archon harvest                            | ship                              |
| `/qa`                   | Archon pipeline + gate                            | ship                              |
| `/triage`               | config-driven tracker + intake                    | ship (thin)                       |
| `/improve-architecture` | ADR superseding + config                          | ship (thin)                       |
| `/cleanup`, `/setup`    | no Matt analog                                    | ship (new)                        |
| `/explore`              | AFK research/spike orchestration                  | ship                              |
| **`/handoff`**          | **nothing** (verbatim Matt)                       | **reference Matt's, not shipped** |
| **`/prototype`**        | **nothing** (verbatim Matt; interactive)          | **reference Matt's, not shipped** |

## Consequences

- **Matt Pocock's skill suite is a declared dependency of the DLC** (every skill box composes it; `/handoff` and `/prototype` are used verbatim). `/setup` verifies its presence and warns if absent ([ADR-0019](0019-conversational-setup.md)).
- The box-set diagram keeps `/handoff` and `/prototype` as lifecycle steps, tagged _(Matt's skill, referenced)_ — not shipped artefacts.
- Redesign step 02 shrinks from "build `/handoff`" to "document that the lifecycle references Matt's `handoff`; ensure it's a declared dependency."
- This refines [ADR-0016](0016-dlc-thin-process-layer.md)/[ADR-0017](0017-container-follows-structural-need.md): "compose, don't reimplement" now explicitly covers our own would-be boxes, not just system access.
- Same reasoning applies to estimation: the DLC composes an estimator, it does not build one ([ADR-0020](0020-specs-branch-on-input.md)).
