---
argument-hint: '[--apply | (empty = report-only dry-run)]'
description: 'Repo-global operational janitor: report (and, on explicit opt-in, prune) the merged/stale worktrees, stale branches/PRs, and stale workflows/<slug>/ artifact dirs an Archon-driven lifecycle accumulates. Composes archon isolation/complete plus the tracker its contract in docs/agents/ names; report-first, never auto-deletes.'
---

# unic-archon-dlc:cleanup

> Design rationale: [ADR-0028 — `/cleanup` is the repo-global operational janitor](docs/adr/0028-cleanup-operational-janitor.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); compose-don't-reimplement per [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md); tracker is the single source of truth per [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md); artifact home per [ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)).

**Arguments:** "$ARGUMENTS"

`/cleanup` is the **off-line operational janitor**: it prunes the debris an Archon-driven lifecycle
accumulates — **merged/stale worktrees**, **stale branches/PRs**, and **stale `workflows/<slug>/`
artifact dirs**. It is a **repo-global** box: it inspects and mutates sibling worktrees, branches,
and PRs, so it **cannot** run inside an isolated worktree — that is exactly why it is a **Claude
Code command, not an Archon workflow** ([ADR-0017](docs/adr/0017-container-follows-structural-need.md)).

It is a **thin composing wrapper**: it **owns the _what_** — deciding what is prunable and enforcing
the report-first / per-category-confirm posture — and **composes the _how_**: Archon's own
`archon isolation` / `archon complete` commands for worktree/branch lifecycle, and the tracker that
`docs/agents/issue-tracker.md` § Access names, for PR and branch state.
Compose those tools — never reimplement them, and never introduce a `tracker-adapter` lib
([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) / [ADR-0018](docs/adr/0018-generic-core-config-compose.md)).

> **This is not `/improve-architecture`.** The name `cleanup` was repointed: the old arch-review +
> ADR-consolidation content moved to `/improve-architecture` ([ADR-0027](docs/adr/0027-improve-architecture-skill-superseding.md)).
> `/cleanup` is git/Archon hygiene only — it touches no code, no ADRs, and no `arch-review.md`.

**Destructive-action posture (load-bearing).** `/cleanup` **defaults to a report-only dry-run** and
**never auto-deletes**. Deletion happens only when invoked with `--apply` **and** confirmed by the
user **per category**. Never create, copy, or delete a `LICENSE` file (repo policy) — slug-dir
pruning explicitly skips them.

Follow these steps in order. Do not skip any step.

## Step 1 — Load config (lenient; tracker read-only)

`/cleanup` reads (never writes) `.archon/unic-dlc.config.yaml`. Read it with your own tools. Do not
shell out to Node, do not import a Plugin module, and do not read `$CLAUDE_PLUGIN_ROOT`: an installed
Plugin ships no `node_modules`, and that variable is not set inside the Bash tool
([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5). The four Archon Boxes read
their config this way already; this is the same shape.

Like `/improve-architecture` this is an **off-line** box, so an absent or unreadable config is
**non-blocking**: print a one-line warning naming what happened, take the defaults below, and continue.
No key is mandatory. It does reach the tracker **read-only** (to check PR and branch state) through the
contract in `docs/agents/` read below; if that contract is absent, the PR/branch-state and slug-dir
categories degrade with a warning rather than halting.

| Key                       | Default     | Keep as                   |
| ------------------------- | ----------- | ------------------------- |
| `artifacts_dir`           | `workflows` | `ARTIFACTS_DIR`           |
| `cleanup.stale_days`      | `7`         | `CLEANUP.stale_days`      |
| `cleanup.dry_run`         | `true`      | `CLEANUP.dry_run`         |
| `cleanup.prune_slug_dirs` | `false`     | `CLEANUP.prune_slug_dirs` |
| `project.branching`       | unset       | `PROJECT.branching`       |

`PROJECT.branching` is a **hint** for the main branch and may be unset. When it is, warn that the main
branch will be derived from git rather than from config — merged detection still works (Step 3), so
this is non-blocking.

### Read the tracker contract

Read `docs/agents/issue-tracker.md`. Its § Access names the MCP server or skill that serves this
tracker and its § Addressing names the repository — read that server's own current tool list and build
each call from it, naming no provider and writing no command, subcommand or flag
([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)). Keep `TRACKER_READY` = whether the file
resolved. If it did not, warn that PR/branch-state detection and slug-dir pruning will be skipped
(they need the tracker), then continue — this box never halts on it.

## Step 2 — Determine mode

Read `$ARGUMENTS`:

- **Empty (or anything other than `--apply`) → report-only dry-run.** Enumerate and report every
  prunable item; delete nothing. This is the default and the safe path.
- **`--apply` → apply mode.** After reporting, offer to prune **per category** with an explicit
  confirmation for each. Even here, if `CLEANUP.dry_run` is `true` (the shipped default), treat the
  run as report-only unless the user explicitly confirms they want to override the configured
  dry-run default for this run.

State the resolved mode to the user before continuing (e.g. `Mode: report-only dry-run` or
`Mode: --apply (config dry_run=true → confirm to override)`).

## Step 3 — Enumerate worktrees & branches (compose `archon isolation`)

Run `archon isolation list` and parse the output (branch name, worktree path, workflow type,
platform, last-activity age). If the command is unavailable, warn that Archon isolation is not
installed and skip this category (non-blocking).

Classify each environment:

- **merged** — its branch is merged into the main branch. Do **not** depend on `PROJECT.branching`
  for correctness: Archon's `--merged` computes merged-into-main itself via a union of ancestry
  (`git branch --merged`), patch-equivalence (`git cherry`), and PR state, which safely catches
  squash-merges — rely on that signal rather than re-deriving it. `PROJECT.branching` is only a
  **reporting hint** for which line is "main" (`gitflow` → `develop`/`main`, `github-flow` → `main`);
  when it is unset (per Step 1), derive the main branch from git instead
  (`git symbolic-ref --short refs/remotes/origin/HEAD`, falling back to `main`) — never block on it.
- **stale** — last activity older than `CLEANUP.stale_days` days, not yet merged.
- **active** — recent and unmerged; never prunable. Report it as retained, with its age.

## Step 4 — Detect stale PRs & branches (through the tracker)

Only if `TRACKER_READY`. Ask the tracker to list open PRs and their branches, addressing the
repository its § Addressing names. Flag as candidates:

- PRs whose branch has already been merged (a leftover open PR), and
- PRs with no activity for longer than `CLEANUP.stale_days`.

Report these read-only; closing them is opt-in in Step 7. An already-merged PR is normally closed by
the merge itself — surface only genuine leftovers.

## Step 5 — Detect prunable slug artifact dirs

Only if `TRACKER_READY` (a slug dir's disposition depends on its PR/branch state). Using
`node:fs`, list the immediate child directories of `<ARTIFACTS_DIR>/` (default `workflows/`). Each
child dir name is a Slug ([ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)). For each:

- Resolve its PR/branch via the tracker + the isolation list from Step 3.
- A slug dir is **prunable only if** its PR/branch is **merged or closed**. A slug with an **open
  PR or an in-flight (active) branch is never prunable** — report it as retained.
- If `CLEANUP.prune_slug_dirs` is `false` (the shipped default), **report** prunable slug dirs but do
  **not** offer to delete them in Step 7 (note that pruning is disabled by config).

Never treat `<ARTIFACTS_DIR>/arch-review-*.md` or any loose file as a slug dir — only directories.

## Step 6 — Report

Print a per-category summary the user can scan. One block per category, each row with the reason it
is prunable (or retained):

```
/cleanup report — mode: <report-only dry-run | --apply>
  Worktrees:  <N prunable> (merged: A, stale >Dd: B) · <M retained active>
    - <branch>  <path>  <merged | stale 12d>
  Branches:   <N prunable>
    - <branch>  <merged, worktree gone>
  PRs:        <N leftover/stale>
    - #<id> <title>  <branch merged | stale 30d>
  Slug dirs:  <N prunable> (<workflows/<slug>/>)   [pruning <enabled | disabled by config>]
    - <slug>  <PR #id merged | PR #id closed>
  Retained:   <items intentionally kept, with why>
```

In report-only mode this is the final output — stop here after printing the "next step" hint
(`re-run with --apply to prune`).

## Step 7 — Apply (only with `--apply`; per-category confirmation)

Never auto-delete. For each category with prunable items, show the concrete command and the exact
items, then ask the user to confirm **that category** (yes/no). On confirmation, compose:

- **Merged worktrees/branches** → `archon isolation cleanup --merged` (this also removes the merged
  remote branches). Add `--include-closed` **only** if the user separately opts in to also pruning
  worktrees whose PRs were **closed without merging**.
- **Stale worktrees** → `archon isolation cleanup <CLEANUP.stale_days>`.
- **A specific branch's full lifecycle** (worktree + local/remote branch) → `archon complete <branch>`.
  Use this for a targeted removal the bulk `isolation cleanup` did not cover.
- **Stale/leftover PRs** → close each one with the tracker's own close capability, read from the
  server's current tool list. Ask what it offers and use that; a provider name or a subcommand written
  down here is wrong on every other host and stale on this one the day the tool changes. If it exposes
  no way to close a PR, report the leftovers and close nothing. Opt-in only.
- **Prunable slug dirs** (only if `CLEANUP.prune_slug_dirs` is `true`) → remove the directory with
  Node's `node:fs` (`rm` recursive). **Before deleting, scan the dir for any `LICENSE` file; if one
  is present, skip that dir and warn the maintainer to handle it manually** (repo LICENSE policy).

Report what each confirmed action did (or the error, surfaced — never swallowed). A declined
category is left fully intact.

## Step 8 — Summary

Print a concise summary:

```
/cleanup complete — mode: <report-only dry-run | --apply>
  worktrees:  <pruned N | reported N, none deleted>
  branches:   <pruned N | reported N>
  PRs:        <closed N | reported N, none closed>
  slug dirs:  <pruned N | reported N | pruning disabled by config>
  skipped:    <LICENSE-guarded dirs / declined categories, or none>
  next:       run /cleanup again after the next batch of merges;
              cadence is off-line / on-demand — there is no auto-hook.
```
