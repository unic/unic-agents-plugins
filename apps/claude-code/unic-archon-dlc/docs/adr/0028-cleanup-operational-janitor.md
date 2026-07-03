# 0028. `/cleanup` is the repo-global operational janitor

**Status:** Accepted (2026-07-03)

## Context

`/cleanup` is the last off-line box in the box set ([ADR-0014](0014-workflow-per-box-decomposition.md)).
The name was **repointed** by the two-axis redesign: the shipped `unic-dlc-cleanup` Archon workflow
held arch-review + ADR-consolidation content, which was harvested into `/improve-architecture` in
step 10 ([ADR-0027](0027-improve-architecture-skill-superseding.md)). ADR-0027 explicitly deferred
disposing of the dormant `unic-dlc-cleanup.yaml` + its command stub to this step.

The maintainer's original intent for the name is git/Archon **hygiene**: an Archon-driven lifecycle
accumulates debris — merged/stale worktrees, leftover branches, stale open PRs, and stale
`workflows/<slug>/` artifact dirs ([ADR-0015](0015-workflows-slug-artifact-home.md)) — that no other
box removes. There is no Matt Pocock analog for this operational concern.

Three questions were grilled with the maintainer (2026-07-03):

1. **Container** — Archon workflow or Claude Code command?
2. **Config surface** — hardcode staleness thresholds or add a config block?
3. **Destructive posture** — how aggressive by default, and how are slug dirs judged?

## Decision

### 1. A repo-global Claude Code command, not an Archon workflow

`/cleanup` inspects and mutates **sibling** worktrees, branches, and PRs. An Archon workflow runs
inside an isolated worktree and cannot safely prune the very worktrees around it. By the
[ADR-0017](0017-container-follows-structural-need.md) litmus (repo-global state → command/skill), it
is a **Claude Code command**. It **composes the _how_** and owns only the _what_
([ADR-0016](0016-dlc-thin-process-layer.md)): Archon's own `archon isolation list` /
`archon isolation cleanup [days] [--merged] [--include-closed]` / `archon complete <branch>` for
worktree/branch lifecycle, and the configured tracker (`tracker.access`, MCP-first / CLI-fallback
`gh` / `az` / `jira`) for PR and branch state. No `tracker-adapter` lib
([ADR-0018](0018-generic-core-config-compose.md)).

### 2. A `cleanup` config block

`.archon/unic-dlc.config.yaml` gains a `cleanup` block: `stale_days` (default `7`, matching Archon's
own default), `dry_run` (default `true`), and `prune_slug_dirs` (default `false`). Staleness is a
legitimate per-project tunable, so — unlike `/improve-architecture`
([ADR-0027](0027-improve-architecture-skill-superseding.md)) — this box earns a small config surface.
No key is added to `MANDATORY_PATHS`: the box is off-line and degrades to these defaults when config
is missing or the tracker is unresolved.

### 3. Report-first, per-category opt-in; slug dirs judged by PR state

`/cleanup` **defaults to a report-only dry-run** and **never auto-deletes**. Deletion happens only
under `--apply` **and** an explicit **per-category** confirmation; `dry_run: true` (the shipped
default) keeps even `--apply` in report mode until the user overrides for that run. This honours the
repo's destructive-action norms and the never-touch-`LICENSE` policy (slug-dir pruning skips any dir
containing a `LICENSE`). A slug dir is **prunable only if** its PR/branch is **merged or closed** —
an open PR or in-flight branch is never prunable, regardless of age.

### 4. Retire the legacy `unic-dlc-cleanup` files here

This step deletes `.archon/workflows/unic-dlc-cleanup.yaml` and
`.archon/commands/unic-dlc-cleanup.md`. Their content lives on in `/improve-architecture`; leaving a
dormant `cleanup`-named Archon workflow whose behaviour contradicts the new operational-janitor
meaning would be confusing.

## Consequences

- **Operational hygiene is now a first-class, safe box.** Consumers run `/cleanup` on a cadence
  (after a batch of merges); it reports by default and prunes only on explicit opt-in.
- **One new config key group (`cleanup`)** with a `defaultConfig` default and merge/validate tests;
  no new mandatory path, so existing configs remain valid and auto-fill the block on next merge.
- **The legacy `unic-dlc-cleanup` workflow + stub are removed**, not left dormant — `/improve-architecture`
  is now the sole home of the arch-review + ADR-consolidation content.
- **No `lib/` beyond the config default; no `tracker-adapter`.** All worktree/branch/PR access is
  composed (Archon CLI + configured tracker), keeping the tested lib tracker-agnostic.
- **Manual follow-up:** an end-to-end prune against real merged worktrees and a stale slug dir is not
  asserted by CI; it is exercised on demand by consumers, per the report-first posture.
