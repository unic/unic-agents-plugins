# 0038. Practice Packs stack by prefix; the DLC alone owns `.archon/methods/`

**Status:** Accepted (2026-10-21)

## Context

A Consumer may install several Practice Packs beside the DLC. Before this decision, nothing said how they
share the Consumer's files. `/setup` replaces `.archon/methods/` wholesale, and
[ADR-0031](0031-methods-bundled-three-tier-resolution.md) retired the two override tiers that a pack could
otherwise have used. So the question was how several installers write into one repository without one of them
removing, or silently overriding, what another one wrote.

Grilled with the maintainer on 2026-10-20 and 2026-10-21, on
[Practice Packs must stack](https://github.com/unic/unic-agents-plugins/issues/520). The Archon facts below
come from the
[research note of 2026-10-21](../../../../../docs/research/2026-10-21-archon-workflow-extensibility.md), and
from one measurement made for this ADR. Each fact names the Archon version it was read or measured on.

- **A Claude node loads the project's `CLAUDE.md` without declaring it.** Documented at v0.12.1: the
  `settingSources` default is `project` and `user`, and it still applies after 0.12.0.
- **A node follows a pointer in `CLAUDE.md`.** Measured on the v0.12.1 release binary with Claude Code
  2.1.306: a node whose prompt named no file read the file that `CLAUDE.md` pointed at, in three runs of
  three. A control repository without the pointer gave zero of three.
  [The measurement](https://github.com/unic/unic-agents-plugins/issues/520#issuecomment-6313878448) states
  the probe, the control and what it does not show.
- **A node reaches a project skill only when it names it in `skills:`.** Documented and read in source at
  v0.12.1. Omitting `skills:` selects no skill, and no workflow-level or config-level default exists.
- **A node reaches a Claude Code plugin only when it names it in `plugins:`.** Since 0.12.0, documented at
  v0.12.1. The node fails before its first turn when a named plugin is missing, or when one it did not name
  loads.
- **An `include:` target is overridden by filename, never shared.** Measured on 0.10.1: across scopes, the
  bundled, `~/.archon` and repository files of one filename resolve to the highest scope. Two files in reach
  that declare the same `name:` under different filenames are both dropped, and the workflow that includes
  them then fails to load. Source at v0.12.1 shows the same logic. It was not measured on 0.12.

## Decision

### 1. A Practice Pack ships context artefacts and config values, never a Box or a Method

This holds for v1. It was decided on the e2e pack, which has nothing to override, and has not been tested
against a pack that must replace a step such as `implement`. §7 records the route for that pack.

### 2. The DLC alone owns `.archon/methods/`

`/setup`'s wholesale replace of that tree stays correct, because no pack writes there.

### 3. A skill under `.claude/skills/` is a context artefact, not a Method

This holds also when a node declares the skill in `skills:`. A Method is the text a Box reads by path from
`.archon/methods/` ([ADR-0031](0031-methods-bundled-three-tier-resolution.md)). A skill is a file a node may
load as context. v1 Boxes declare no pack skill in `skills:` and no pack plugin in `plugins:`, so on 0.12.1
a pack skill reaches a Box run only through `CLAUDE.md`.

### 4. A pack reaches a Box run through its own block in the Consumer's `CLAUDE.md`

The block points at the pack's conventions. A node receives `CLAUDE.md` without declaring it, and it
follows the pointer, as measured on 0.12.1 above.

### 5. Ownership is decided by prefix, with no manifest

Each pack has a unique prefix. The DLC's prefix is `unic-dlc`. An installer reads, writes, overwrites or
removes only these names that carry its prefix:

| Where                                 | The name a pack with prefix `<prefix>` owns           |
| ------------------------------------- | ----------------------------------------------------- |
| `.claude/skills/`                     | `<prefix>-*/`                                         |
| The Consumer's `CLAUDE.md`            | one block between `<prefix>:begin` and `<prefix>:end` |
| Each line-based formatter ignore file | one block between `<prefix>:begin` and `<prefix>:end` |
| `.archon/packs/`                      | `<prefix>.config.yaml`                                |

These are the only files a pack writes. An installer assumes nothing about any other name. If its prefix is
already held by another pack, it stops and asks the operator. Each pack brings its own installer, and the
DLC's `/setup` installs no pack in v1.

The DLC follows the same rule. Its markers move from `unic-archon-dlc:begin` and `unic-archon-dlc:end` to
`unic-dlc:begin` and `unic-dlc:end`. `/setup` finds a block under the old markers and rewrites it in place
under the new ones, so a Consumer never holds both. No pack may take `unic-dlc` or `unic-archon-dlc` as its
prefix.

### 6. Config is layered, and the Consumer's file holds only the Consumer's choices

A Box reads three layers, and a later layer wins key by key:

1. `.archon/packs/unic-dlc.config.yaml`, the DLC's defaults.
2. Each `.archon/packs/<prefix>.config.yaml`, one pack's defaults.
3. `.archon/unic-dlc.config.yaml`, the Consumer's choices.

Each installer replaces its own defaults file on every run. No installer writes a default into the
Consumer's file. So the Consumer's value wins, and it survives a re-run of `/setup` and a pack upgrade.
The reader sees a Consumer override in the Consumer's own file, because that file holds nothing else. On a
re-run, `/setup` reports every key in the Consumer's file whose value equals the current default, as a
candidate to remove, and changes nothing.

[Build the layered Practice Pack config](https://github.com/unic/unic-agents-plugins/issues/647) builds this
layer order and the report. Until it lands, the Consumer's file is the only layer.

### 7. Replacing a Box step is a future route, decided and not built

A Box may declare an `include:` slot that ships with a DLC default block, and a pack may replace that block.
Archon resolves an include target by filename across bundled, `~/.archon` and repository scope (measured on
0.10.1, the same logic in source at v0.12.1). It gives no precedence inside one scope. The DLC and every pack
install into repository scope, so the installer has to decide who wins.

One slot holds one occupant. When a second pack claims an occupied slot, its installer detects the
collision, names both packs and offers a resolution. The installer writes the Consumer's choice into
`.archon/unic-dlc.config.yaml` as a Consumer override, which is where the reader sees who won. Nothing
resolves silently. This is the route for a pack that must replace `implement`. It is built in its own
ticket, when the first pack needs it, so no step of `/setup` implements it today.

### 8. This does not wait for #425

[#425](https://github.com/unic/unic-agents-plugins/issues/425) substitutes a value inside a file the DLC
owns, such as a node's `mcp:`. §7 replaces a whole file that another owner occupies. The two share the
moment, install time, but not the mechanism, so neither one blocks the other.

## Which file wins on a collision

| Collision                                | Who wins                                        | Where the reader sees it                                                       |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| One key set in several config layers     | The later layer of §6; the Consumer's file last | `.archon/unic-dlc.config.yaml`, and the `/setup` report of default-valued keys |
| Two packs claim one prefix               | Nobody. The second installer stops and asks     | That installer's run                                                           |
| Two packs claim one `include:` slot      | The pack the Consumer chooses                   | `.archon/unic-dlc.config.yaml`, as a Consumer override                         |
| A Consumer edit inside a pack's own name | The pack. Its next run overwrites the edit      | The `git diff` after that run                                                  |

## Not decided here

- **The prefix boundary.** Whether one prefix may begin another is open. A pack prefixed `unic` would claim
  every `unic-dlc-*` name, so the prefix rule needs a boundary. `/setup` touches no name that carries another
  prefix, and that rule holds whatever the boundary turns out to be.
- **How a slot records its occupant**, so that the DLC's next `/setup` leaves it alone.
- **Whether the DLC's `/setup` runs each installed pack's installer.**
- **Whether Archon 0.12.x treats include slots as measured on 0.10.1.** Source at v0.12.1 shows the same
  logic, and nobody has measured it.
- **Whether a `SessionStart` hook or `.claude/rules/*.md` reach a node.** Both are unmeasured on every
  version, and neither is used here.
- **How a pack picks a prefix that no other pack holds.** §5 detects a collision, and no registry prevents
  one.
