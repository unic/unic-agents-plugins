# 0030. The DLC is a Harness that hosts Methods; a Box survives only for what no Method can supply

**Status:** Accepted (2026-08-03)

Amends [ADR-0016](0016-dlc-thin-process-layer.md) and [ADR-0021](0021-earns-its-place-compose-verbatim.md).

## Context

[ADR-0016](0016-dlc-thin-process-layer.md) said the plugin owns the _what_ and composes the team's
system-skills for the _how_. [ADR-0021](0021-earns-its-place-compose-verbatim.md) said a Box ships
only if it adds value over the raw composed skill. Both were right and both were too soft to decide
anything: "adds value" is a judgement, so every Box kept its own restatement of the method it
composed, and the plugin drifted into competing with the skills it claimed to reuse.

Upstream v1.1.0 (2026-07-08, five days after the redesign shipped) renamed or moved 8 of the ~10
skills the plugin composed. That produced two defects, both verified before this ADR was written:

- **The rename wave broke `/specs` and `/tickets` with CI green.** A Method name lived as a hardcoded
  string in `commands/setup.md`, `commands/specs.md` and `commands/tickets.md` at once, with nothing
  tying the three together. `to-prd` → `to-spec` and `to-issues` → `to-tickets` turned each of those
  references into a no-op that no test could see.
- **Three documentation surfaces disagreed about the dependency list.** `commands/setup.md` named 7
  skills, `README.md` named 6, and the commands actually composed 11 — including `grill-with-docs`,
  which at v1.1.0 is no longer a method at all but a six-line pointer to two others.

Neither defect is a coding mistake. Both follow from having no name for the relationship: if the
plugin is a "thin process layer" then method text is just more layer, and nothing says where the
plugin's responsibility stops and the skill's begins.

Grilled with the maintainer on 2026-07-31 (see #279).

## Decision

### 1. The DLC is a Harness. Matt Pocock's skill text is a Method

The plugin is a **Harness**: it owns the concerns that only something outside the procedure can own.
A **Method** is the skill text a Box reads, and it owns the procedure.

The Harness owns, and a Method never does:

| Concern               | Where it lives                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Isolation             | Archon worktrees for the AFK legs ([ADR-0017](0017-container-follows-structural-need.md))                      |
| Gates                 | `gates.<box>` HITL/AFK approvals                                                                               |
| Configuration         | `.archon/unic-dlc.config.yaml` as the single source of truth ([ADR-0018](0018-generic-core-config-compose.md)) |
| Red/green integrity   | Fresh context per slice ([ADR-0012](0012-fresh-context-red-green-separation.md))                               |
| Tracker/docs/design   | Composed per config, MCP-first ([ADR-0016](0016-dlc-thin-process-layer.md))                                    |
| Artefact durability   | `<artifacts_dir>/<slug>/` ([ADR-0015](0015-workflows-slug-artifact-home.md))                                   |
| Posting and reporting | The tracker and PR surfaces                                                                                    |

A Method owns how the work is actually done — how to interview, how to slice, how to review, how to
grill — and the Harness does not paraphrase, summarise, or improve it.

### 2. The structural bar, replacing "adds value"

[ADR-0021](0021-earns-its-place-compose-verbatim.md)'s test becomes mechanical: **a Box survives only
for what no Method can supply.** The question is no longer "does this add value?" but "does this
add isolation, a gate, config binding, integrity, composition, durability, or posting?" If the answer
is none of those, the Box is deleted rather than kept as a wrapper — and its Method is named in prose
for a human to run.

That is why `handoff` and `prototype` are referenced and never bundled: both are pure procedure, run
by a human in a live conversation, with no Harness concern attached.

### 3. Matt's v1.1 lifecycle is the DLC main line, so stop competing on method text

Upstream v1.1.0's own lifecycle — `wayfinder → to-spec → to-tickets → implement → code-review` — is
box-for-box the DLC main line. Two teams were maintaining one procedure. After this ADR only one
does: the DLC keeps the lifecycle's _shape_ (which Box, which gate, which artefact) and reads the
procedure from the Method.

## Consequences

- Box prose shrinks to Harness concerns. Any paragraph in a `commands/*.md` file that explains _how_
  to do the work is a defect, because the Method already says it and the two will diverge.
- The dependency list stops being prose. `lib/methods-manifest.mjs` is the one place a Method name
  exists as data ([ADR-0031](0031-methods-bundled-three-tier-resolution.md)), and the documentation
  is generated from its `providedTo` field rather than restating it.
- Rewiring each Box onto the resolver is deliberately separate work (#280 for the command Boxes, #281
  for the Archon Boxes), so this ADR changes no Box behaviour on its own.
- A Box that turns out to add no Harness concern is now deleted on sight. #281 is mostly deletion for
  exactly this reason.
- The word "Harness" replaces "thin process layer" in the glossary. ADR-0016 keeps its original
  wording as the historical record; `CONTEXT.md` lists the old phrase under `_Avoid_`
  ([ADR-0032](0032-box-method-vocabulary.md)).
