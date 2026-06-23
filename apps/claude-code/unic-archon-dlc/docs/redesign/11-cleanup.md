# Step 11 — `/cleanup` (NEW: operational janitor)

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** The name `cleanup` is REPOINTED — the old `cleanup` content moved to `/improve-architecture` (step 10). This is the maintainer's original intent: git/Archon hygiene. No Matt analog.

## Goal

A `unic-dlc-cleanup` workflow that prunes the operational debris an Archon-driven lifecycle accumulates: merged/stale worktrees, stale branches, stale PRs, and stale `workflows/<slug>/` artifact dirs.

## Task

- Lean on Archon's own commands: `archon isolation list`, `archon isolation cleanup --merged`, `archon isolation cleanup` (stale), `archon complete <branch>`.
- Prune stale `workflows/<slug>/` dirs (contract C) for sessions whose PRs are merged/closed.
- Detect stale branches/PRs via `lib/tracker-adapter.mjs` (gh/az) and report or close per config.
- **Default to dry-run / report-first**, with explicit opt-in to delete (destructive — never auto-delete without confirmation, per repo safety norms).

## Open questions to grill first

- Staleness thresholds (days since merge / last activity) — config keys.
- Dry-run default + which actions require HITL confirmation.
- Cross-platform safety (Node APIs, no shell-isms).

## Done when

`/cleanup` reports prunable worktrees/branches/PRs/slug-dirs and, on confirmation, prunes them safely cross-platform. PR to `develop`.

## Suggested skills

`/archon` (isolation/complete commands), `/grilling`. Mind the repo's LICENSE/never-delete and destructive-action norms.
