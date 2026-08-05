# 0033. De-dogfood `unic-archon-dlc`: one agent-skill driver, not two

**Status:** Accepted (2026-08)

## Context

This monorepo ran two agent-skill setup systems against itself at the same time.

`unic-archon-dlc` had its `/setup` run here as dogfooding. That generated
`docs/agents/{branching,domain,issue-tracker,labels,workflow}.md`, each carrying a
DO-NOT-EDIT header, plus a marker-delimited `## Agent skills` block in the root
`AGENTS.md`. `setup-matt-pocock-skills` writes three of those same paths and the same
`AGENTS.md` section. Two generators, one set of files.

The plugin's own doctrine already ruled the arrangement out. From
`apps/claude-code/unic-archon-dlc/AGENTS.md`, on `/triage`:

> […] injects `classification.labels` from `.archon/unic-dlc.config.yaml` as the single
> source of truth and **forbids reading Matt's `docs/agents/triage-labels.md` /
> `issue-tracker.md`**, so labels can't drift from what `/tickets` + `/build` read.
> Consequently `setup-matt-pocock-skills` is **not** a Plugin dependency.

A repo running both is precisely the drift that doctrine exists to prevent. The damage was
already visible:

- `docs/agents/workflow.md` documented the **retired** seven-workflow generation
  (`explore → plan → build → qa → cleanup → triage`), superseded by the box-set redesign
  months earlier.
- `docs/agents/issue-tracker.md` cited `lib/tracker-adapter.mjs`, a module that was
  dissolved.
- `.archon/` tracked fourteen dead `unic-dlc-*` artefacts and two `unic-dlc.config.*`
  files, while the workflows actually in use were never committed.
- `/wayfinder`, new at upstream v1.1, reads a **Wayfinding operations** section from the
  tracker doc. The DLC-generated copy has no such section, so the skill could not work
  here at all.

[ADR-0032](0032-label-taxonomy.md) resolved the same collision the other way in 2026-06:
`unic-archon-dlc` was "the tool that stays" and `setup-matt-pocock-skills` was "being
phased out". That was correct when the plugin was also this repo's local driver. The
redesign since then (ADR-0030–0032, plugin-local) turned it into a _product_ with a
vendored Method bundle pinned to an upstream tag, shipped to Consumer repos. Its
configuration surface now belongs to those Consumers, not to the workshop that builds it.

## Decision

**`unic-archon-dlc` is a product built in this repo, not a driver run against it.**

1. `/unic-archon-dlc:setup` must never run against this monorepo. Test the plugin against a
   scratch Consumer clone.
2. `setup-matt-pocock-skills` — that is, Matt Pocock's skills at `.agents/skills/`, pinned
   in `skills-lock.json` — is the sole agent-skill driver here.
3. `docs/agents/*.md` is **repo-owned and hand-maintained**. No generator writes it. The
   DO-NOT-EDIT headers are gone.
4. `/setup-matt-pocock-skills` is **not** re-run either, despite now owning the territory:
   upstream still declares five canonical triage roles using `wontfix`, so a re-run would
   revert `docs/agents/triage-labels.md` to a vocabulary this repo does not use. The
   warning ADR-0032 raised about this is resolved by never re-running the skill, not by
   reconciling it after the fact. Files it would have written are authored by hand from its
   templates.
5. `.agents/skills/**` remains **upstream-owned**: never hand-edit it. Every
   `npx skills add` overwrites the tree, so an edit there dies silently — which is exactly
   how this repo lost its 8-state reconciliation of `triage-labels.md` once already.

Removed: seven `.archon/commands/unic-dlc-*.md`, seven `.archon/workflows/unic-dlc-*.yaml`,
`.archon/unic-dlc.config.json`, `.archon/unic-dlc.config.yaml`, `.archon/ralph/`,
`docs/agents/workflow.md`, `docs/agents/branching.md`, and the plugin's "Dogfooding note"
doctrine. `.archon/config.yaml` survives — that is Archon's own project config, not the
plugin's.

## Consequences

- **The label taxonomy loses its generator.** Tiers 1-3 were "owned by `unic-archon-dlc`";
  they are now repo-owned and documented by hand in `docs/agents/labels.md`. See the
  amendment on [ADR-0032](0032-label-taxonomy.md).
- **`release` has one home.** The repo-local `release` type lived as an override in
  `.archon/unic-dlc.config.json`, which is deleted. `docs/agents/labels.md` is now the only
  record of it.
- **`/wayfinder` becomes usable once the five `wayfinder:*` labels exist.**
  `docs/agents/issue-tracker.md` is hand-authored from upstream's v1.1 GitHub template,
  including the Wayfinding operations section. This repo's GitHub sub-issues and native
  issue-dependency endpoints were both verified live, so no body-convention fallback is
  needed. The labels are the one remaining prerequisite: creating them mutates the live
  tracker, so the commands are recorded in that section rather than run here.
- **The plugin's `/setup` gap is now visible rather than papered over.** It generates a
  tracker doc it under-fills — no wayfinding section — which a real Consumer will hit.
  Fixing that is plugin work, tracked separately; this repo no longer masks it with a
  hand-seeded file.
- **Losing dogfooding costs coverage.** No Consumer-shaped repo exercises `/setup` on every
  change any more, and that is a real regression in confidence. It is the price of a
  coherent single driver here; the replacement is a scratch clone, which needs discipline
  rather than a generated artefact nobody re-reads.
- **Branch and workflow facts consolidate into `AGENTS.md`.** `docs/agents/branching.md`
  duplicated the Gitflow table verbatim; `workflow.md` described a generation that no
  longer exists. Both are deleted rather than re-homed.
