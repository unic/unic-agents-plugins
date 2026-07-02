# 0024. `/triage` is the intake on-ramp; a thin wrapper that binds Matt's method to DLC config as the single source of truth

**Status:** Accepted (2026-07-02)

## Context

The shipped `triage` workflow produced a `HANDOFF.md` state snapshot and updated a `ROADMAP.md`.
[ADR-0013](0013-tracker-single-source-of-truth.md) retired that role — the tracker is the single
source of truth for "where are we", and no workflow writes durable repo-state snapshots. The box set
([ADR-0014](0014-workflow-per-box-decomposition.md)) then gave `/triage` a **new** meaning: an
**intake on-ramp** that turns raw incoming work (bug reports, feature requests, QA findings, external
PRs) into agent-ready issues feeding the `/tickets` convergence point.

Two questions surfaced when implementing the box:

1. **Container + earns-its-place.** Triage is a live conversation (categorise, verify, grill), so per
   [ADR-0017](0017-container-follows-structural-need.md) it is a command/skill, not an Archon
   workflow, and it is inherently HITL. But Matt Pocock's `triage` skill already carries the full
   method (gather → recommend → verify → grill → apply, with agent briefs and the `.out-of-scope/`
   KB). Per [ADR-0021](0021-earns-its-place-compose-verbatim.md) a box ships only if it adds value
   over the raw composed skill — so what does a DLC `/triage` add?

2. **Label drift between two setups.** Matt's skills assume `setup-matt-pocock-skills` ran and wrote
   `docs/agents/triage-labels.md` (five canonical roles) and `docs/agents/issue-tracker.md`. The
   DLC's `/setup` writes `classification.labels` (the plugin's eight-state taxonomy) in
   `.archon/unic-dlc.config.yaml`, which `/tickets` and `/build` already read. If both setups exist,
   the two label sources diverge and a triaged issue can carry a label the downstream boxes don't
   recognise.

## Decision

`/triage` ships as a **thin binding wrapper** ([ADR-0016](0016-dlc-thin-process-layer.md)): it **owns
the _what_** (the DLC config binding + the on-ramp contract) and **delegates the _method_** to Matt's
`triage` skill verbatim (composing `/grilling` + `/domain-modeling` for the grill step). It does not
re-narrate Matt's steps.

**Single source of truth, injected at compose time.** Matt's `triage` states the label mapping
_"should have been provided to you"_ — it need not come from Matt's file. So the wrapper loads
`classification.labels` (+ `tracker`, `triage.out_of_scope_dir`, `triage.external_prs`) from
`.archon/unic-dlc.config.yaml` and **hands the mapping to Matt's method inline, instructing it NOT to
read `docs/agents/triage-labels.md` / `docs/agents/issue-tracker.md`**. This is the general
**compose rule**: DLC commands feed Matt's methods DLC config; Matt's own setup artifacts are never
consulted in DLC flows. Consequences:

- `.archon/unic-dlc.config.yaml` is the **single source of truth** for labels; there is no second
  file to keep in sync, and `/triage` speaks the same vocabulary `/tickets` + `/build` read.
- **`setup-matt-pocock-skills` is not a dependency of this plugin** — only Matt's skill _methods_
  are. `/setup` already only _verifies the suite is present_ ([ADR-0019](0019-conversational-setup.md),
  verify-only); it never needs Matt's config. The binding is exactly what `/triage` adds over the raw
  skill — the same category of value that justifies shipping `/specs` and `/tickets`.

**Label taxonomy binding.** The DLC eight-state taxonomy is a superset of Matt's five roles. The
wrapper maps: category `bug`→type `bug`, `enhancement`→type `feature`; states `needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human` map through unchanged; Matt's `wontfix` splits
into `rejected` (a rejected enhancement → also writes the `.out-of-scope/` record) and `closed` (an
already-implemented request → point to the code, no KB write); and the DLC adds `needs-specs` — a
raw-but-valid idea that routes to `/specs`. Teams override `classification.labels` in YAML.

**Verification is best-effort, always; no config knob** ([ADR-0021](0021-earns-its-place-compose-verbatim.md)).
Triage is inherently HITL, so there is no true AFK case — a human is present at every transition.
The method reproduces a bug / checks out a PR when it can; when it cannot reproduce or no runner
exists, it downgrades to `needs-info` with specific questions rather than guessing.

**On-ramp contract.** `/triage` writes only to the tracker (labels + comments) and, on a rejected
enhancement, to `triage.out_of_scope_dir`. Writes go **directly** (human present → no PR gate). It
produces **no** `issues.json` / PRD. A `ready-for-agent` item enters the `/tickets` backlog (the
convergence point — sliced there) or `/build` directly if already atomic. Where the pre-two-axis step
body said triage output is "consumed by `/build` exactly like `/tickets` output", **PLAN.md wins**:
on-ramps feed `/tickets` (decision #8).

## Consequences

- **New `commands/triage.md`** — the thin wrapper (config load → injected context → delegate to
  Matt's method with the single-source override → enforce the on-ramp contract).
- **New `triage` config block** — `{ out_of_scope_dir: '.out-of-scope', external_prs: 'auto' }` in
  `defaultConfig()`. This is the DLC-config home for the two knobs Matt's setup would otherwise write
  to `docs/agents/*` (the out-of-scope location; whether external PRs are a request surface).
  `mergeConfig` auto-fills them for existing configs — no `/setup` change this step.
- **The old `unic-dlc-triage` Archon workflow + command stub are deleted** — the state-snapshot role
  is retired ([ADR-0013](0013-tracker-single-source-of-truth.md)) and it used the inert `type:`-style
  schema ([ADR-0011](0011-archon-schema-target.md)).
- **`unic-dlc-cleanup` is de-referenced** — its dangling terminal `run-triage` node (which invoked
  `archon workflow run unic-dlc-triage` to refresh HANDOFF/ROADMAP) is removed. This is a surgical
  reference cleanup only; the full `/cleanup` redesign is step 11.
- **Known item, not fixed here:** both `/setup` and `setup-matt-pocock-skills` manage an
  `## Agent skills` block in the consumer's `CLAUDE.md`/`AGENTS.md`. The single-source rule removes
  the _label_ collision, but the block-ownership overlap remains for a later `/setup`/finalize step.
