# 0024. `/triage` is the intake on-ramp; a thin wrapper that binds Matt's method to the tracker contract in `docs/agents/`

**Status:** Accepted (2026-07-02, revised 2026-10-21)

## Context

The shipped `triage` workflow produced a `HANDOFF.md` state snapshot and updated a `ROADMAP.md`.
[ADR-0013](0013-tracker-single-source-of-truth.md) retired that role. The tracker is the single source of
truth for "where are we", and no workflow writes durable repo-state snapshots. The box set
([ADR-0014](0014-workflow-per-box-decomposition.md)) then gave `/triage` a **new** meaning: an
**intake on-ramp** that turns raw incoming work (bug reports, feature requests, QA findings, external
PRs) into agent-ready issues feeding the `/tickets` convergence point.

Two questions surfaced when implementing the box:

1. **Container and earns-its-place.** Triage is a live conversation (categorise, verify, grill), so per
   [ADR-0017](0017-container-follows-structural-need.md) it is a command/skill, not an Archon
   workflow, and it is inherently HITL. But Matt Pocock's `triage` skill already carries the full
   method (gather, recommend, verify, grill, apply, with agent briefs and the `.out-of-scope/` KB). Per
   [ADR-0021](0021-earns-its-place-compose-verbatim.md) a box ships only if it adds value over the raw
   composed skill. So what does a DLC `/triage` add?

2. **Label drift between two setups.** Matt's skills assume `setup-matt-pocock-skills` ran and wrote
   `docs/agents/triage-labels.md` (five canonical roles) and `docs/agents/issue-tracker.md`. If a second
   writer keeps its own label map, the two label sources diverge and a triaged issue can carry a label
   the downstream boxes don't recognise.

The first answer, on 2026-07-02, put the label map in `.archon/unic-dlc.config.yaml` as
`classification.labels` and told Matt's method **not** to read the two `docs/agents/` files. That solved
the two-writer problem by forbidding the read. A measurement against a live tenant showed that it
failed. The tier alone could not describe a role's value, because five of the eight state roles there cannot
be states.
Writing a state while the work is still open moves an already-active item backwards on the board, so only
the three terminal roles are states there and the rest are tags. On 2026-08-18 (#389) the tracker contract
moved out of the config and into the two `docs/agents/` files. The whole `tracker` block,
`classification.labels` and `project.pr_strategy` left the config with it, and `project.branching` is the
only key a config needs.

## Decision

`/triage` ships as a **thin binding wrapper** ([ADR-0016](0016-dlc-thin-process-layer.md)). It **owns
the _what_**, the tracker contract binding and the on-ramp contract, and **delegates the _method_** to
Matt's `triage` skill verbatim, composing `/grilling` and `/domain-modeling` for the grill step. It does not
re-narrate Matt's steps. What the wrapper binds changed on 2026-08-18; that it binds did not.

**The tracker contract is two repo-local files, and one writer owns them.** `docs/agents/issue-tracker.md`
and `docs/agents/triage-labels.md` carry every tracker fact. Every Box and command, `/triage` included,
reads them, and a Box names a role and a file, never a host word. The two-writer problem is solved by
removing one writer: `/unic-archon-dlc:setup` writes both files, and `setup-matt-pocock-skills` must never
be run over them. **`setup-matt-pocock-skills` is not a dependency of this plugin**, only Matt's skill
_methods_ are.

**The axis belongs to the role, not to the tier.** `triage-labels.md` names, per row, the role's value and
the axis that carries it. A tier does not decide whether a role is a state, a tag or a label.

**The team names the values, and `/setup` creates nothing on the tracker.** `/setup` proposes a value for
each canonical role from what the board already uses, and writes what the operator confirms. A role the
board has no name for is mapped onto a name it already carries, or left unmapped. It is never answered by
adding a label to someone else's board. The role names in the left column are this plugin's; the team owns
every other column and never the role set. On 2026-08-13 no Box read a state label string: `/triage`,
`/tickets` and `/qa` wrote states, and nothing selected work by label.

**Label taxonomy binding.** The DLC taxonomy is a superset of Matt's five roles. The wrapper maps: category
`bug` to type `bug`, `enhancement` to type `feature`; states `needs-triage`, `needs-info`,
`ready-for-agent` and `ready-for-human` map through unchanged; Matt's `wontfix` splits into `rejected` (a
rejected enhancement, which also writes the `.out-of-scope/` record) and `closed` (an already-implemented
request, which points to the code and writes no KB entry); and the DLC adds `needs-specs`, a raw but valid
idea that routes to `/specs`. Teams set each role's value in `triage-labels.md`.

**Verification is best-effort, always; no config knob** ([ADR-0021](0021-earns-its-place-compose-verbatim.md)).
Triage is inherently HITL, so there is no true AFK case: a human is present at every transition. The method
reproduces a bug or checks out a PR when it can. When it cannot reproduce, or no runner exists, it
downgrades to `needs-info` with specific questions rather than guessing.

**On-ramp contract.** `/triage` writes only to the tracker (labels and comments) and, on a rejected
enhancement, to `triage.out_of_scope_dir`. Writes go **directly** (human present, so no PR gate). It
produces **no** `issues.json` or PRD. A `ready-for-agent` item enters the `/tickets` backlog (the
convergence point, sliced there) or `/build` directly if already atomic. Where the pre-two-axis step body
said triage output is "consumed by `/build` exactly like `/tickets` output", **PLAN.md wins**: on-ramps
feed `/tickets` (decision #8).

**The `CLAUDE.md` block is this plugin's alone.** `/setup` writes its block in a Consumer's `CLAUDE.md`
under the heading `## unic-archon-dlc`, not `## Agent skills`, so `/setup` and `setup-matt-pocock-skills`
no longer manage a heading of the same name (#296). Nothing in the block is a registered skill: the Methods
this plugin ships are read by path ([ADR-0031](0031-methods-bundled-three-tier-resolution.md)). The block
lies between `<!-- unic-dlc:begin -->` and `<!-- unic-dlc:end -->`, because every installer that writes into
a Consumer owns only the names that carry its own prefix, and `unic-dlc` is the DLC's
([ADR-0038](0038-practice-packs-stack-by-prefix.md) §5). Before 0.30.0 the markers were
`<!-- unic-archon-dlc:begin -->` and `<!-- unic-archon-dlc:end -->`. `/setup` finds a block under the old
markers and rewrites it in place under the new ones, so a re-run leaves one block, never two. The block
names no Box and no pipeline stage. It carries paths on the Consumer's own disk, `archon workflow list` to
enumerate what is installed there, and a link to this plugin's README. It never presents itself as
auto-managed, because nothing detects a hand edit between the markers.

## Consequences

- **New `commands/triage.md`**: the thin wrapper. It loads the config and the tracker contract, delegates
  to Matt's method, and enforces the on-ramp contract.
- **New `triage` config block**: `out_of_scope_dir` (default `.out-of-scope`) and `external_prs` (default
  `auto`). The § Configuration reference in the README holds the defaults. This is the DLC-config home for
  the two knobs Matt's setup would otherwise write to `docs/agents/*`.
- **The old `unic-dlc-triage` Archon workflow and command stub are deleted.** The state-snapshot role
  is retired ([ADR-0013](0013-tracker-single-source-of-truth.md)), and it used the inert `type:`-style
  schema ([ADR-0011](0011-archon-schema-target.md)).
- **`unic-dlc-cleanup` is de-referenced.** Its dangling terminal `run-triage` node, which invoked
  `archon workflow run unic-dlc-triage` to refresh HANDOFF and ROADMAP, is removed. This is a surgical
  reference cleanup only; the full `/cleanup` redesign is step 11.
- **The block-ownership overlap is settled** (#296): the two installers no longer share the
  `## Agent skills` heading.
