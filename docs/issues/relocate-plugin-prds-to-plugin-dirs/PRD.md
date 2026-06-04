---
title: Relocate plugin-scoped PRDs from root docs/issues/ into their plugin dirs
created: 2026-05-26
---

# PRD: Relocate plugin-scoped PRDs from root `docs/issues/` into their plugin dirs

**Status:** ready-for-agent
**Category:** docs / tech-debt
**Scope:** monorepo
**GitHub:** [#132](https://github.com/unic/unic-agents-plugins/issues/132)

---

## Problem Statement

Root `docs/issues/` currently mixes monorepo-scoped PRDs (CI upgrades, naming conventions, cross-plugin refreshes) with plugin-scoped PRDs (`pr-review-*`, `auto-format-*`, `unic-archon-dlc-*`). The multi-context doctrine for this repo places plugin-scoped artifacts under the plugin — `apps/claude-code/<plugin>/docs/adr/`, `apps/claude-code/<plugin>/CONTEXT.md`, `apps/claude-code/<plugin>/CHANGELOG.md`. Plugin issues should follow the same rule.

The inconsistency was set in motion by early plugin PRDs landing at root before the convention crystallised. The first plugin-scoped PRD filed under the correct path is `apps/claude-code/pr-review/docs/issues/pr-review-ado-fetcher-step4-fix/` (issue #120). This PRD retroactively aligns the rest.

## Solution

`git mv` each plugin-scoped PRD directory into `apps/claude-code/<plugin>/docs/issues/`. Update internal references (ADR links, `## Parent` headings, `## Blocked by` paths) inside the moved files. Update any external references that point at the old root paths.

## Inventory

**Move to `apps/claude-code/pr-review/docs/issues/`** (7 dirs):

- `pr-review-ado-fetcher-reliability/` — contains 4 done slices
- `pr-review-doc-context-enrichment/`
- `pr-review-doc-context-spawn-reliability/`
- `pr-review-orchestrator-split/`
- `pr-review-platform-failure-handling/` — contains 6 done slices
- `pr-review-rereview/`
- `pr-review-suppress-addressed-reply/` — contains 2 done slices

**Move to `apps/claude-code/auto-format/docs/issues/`** (2 dirs):

- `auto-format-config/`
- `auto-format-runners/`

**Move to `apps/claude-code/unic-pr-review/docs/issues/`** (1 dir):

- `unic-pr-review/` — plugin-scoped PRD filed after this PRD was first written; the plugin already hosts `docs/issues/unic-pr-review-intent-check-verdicts/`.

**Deferred — do NOT move in this PRD** (3 dirs targeting `apps/claude-code/unic-archon-dlc/docs/issues/`):

- `adr-reshelving-harness-internal/` — closed GH issue #129 references the root path; would need a body rewrite
- `unic-archon-dlc/` — 16 OPEN GH issues (#101–#116) actively reference `docs/issues/unic-archon-dlc/PRD.md` in their bodies. Moving the dir would break live references on in-flight work.
- `unic-archon-dlc-dogfood-banner/`

File a follow-up cleanup PRD scoped to `unic-archon-dlc-*` once #101–#116 close, OR pair the move with a sweep of `gh issue edit` body rewrites.

**Stay at root** (8 dirs — monorepo / package-scoped):

- `ci-node24-upgrade/`
- `conventional-commits-scopes/`
- `feature-runner/` — issue-queue tooling for the AI-development cycle, monorepo-wide
- `github-copilot-config/` — agent-level config, parallel to plugin scope; confirm before classifying
- `plugin-claude-md-monorepo-refresh/`
- `plugin-unic-prefix/`
- `relocate-plugin-prds-to-plugin-dirs/` — this PRD; a monorepo-wide reshelving task
- `verify-changelog-nested-plugin-gate/` — scoped to the `packages/release-tools` package, not a Claude Code plugin; the plugin-relocation doctrine does not cover `packages/`

## Implementation

For each directory to move:

1. `git mv docs/issues/<slug>/ apps/claude-code/<plugin>/docs/issues/<slug>/` (preserves history).
2. Rewrite internal references inside the moved files:
   - ADR links from `../../../apps/claude-code/<plugin>/docs/adr/<file>` → `../../adr/<file>`.
   - `## Parent` headings from `docs/issues/<slug>/PRD.md` → `apps/claude-code/<plugin>/docs/issues/<slug>/PRD.md`.
   - `## Blocked by` paths from `docs/issues/<slug>/<file>` → `apps/claude-code/<plugin>/docs/issues/<slug>/<file>`.
3. Grep the rest of the repo for any external references to the old root path and update.
4. Verify no OPEN GH issue body references the moved path. (Closed issues stay frozen and are out of scope.)
5. Leave a single bulk-relocation commit per plugin (3 commits total: pr-review, auto-format, unic-pr-review) so blame is clean.

## Acceptance criteria

- [ ] Every plugin-scoped PRD listed in "Inventory" lives under its plugin's `docs/issues/`.
- [ ] No file under `apps/claude-code/<plugin>/docs/issues/` contains a link of the form `../../../apps/claude-code/<plugin>/docs/adr/`; relative ADR links use `../../adr/`.
- [ ] Every `## Parent` heading inside a moved slice points at the new plugin-scoped path.
- [ ] Every `## Blocked by` reference inside a moved slice uses the new plugin-scoped path.
- [ ] `git log --follow` on any moved file shows the pre-move history (i.e. `git mv` was used, not delete-and-recreate).
- [ ] `grep -rn "docs/issues/<moved-slug>" --include="*.md" .` returns no stale references for any moved slug (outside of the moved file itself).
- [ ] Root `docs/issues/` contains only the 8 monorepo/package-scoped dirs from "Stay at root" plus the 3 deferred `unic-archon-dlc-*` dirs (until their follow-up cleanup lands).

## Out of scope

- Reclassifying any "Stay at root" dir as plugin-scoped. If `github-copilot-config/` or `feature-runner/` turns out to be plugin-scoped on closer reading, file a follow-up.
- Re-organising `done/` subfolders into a different layout. The convention of "completed slices move to `done/` inside the same PRD dir" is preserved.
- Updating closed GitHub issue bodies that reference old paths. The cleanup is a docs-only reshelving; GH issue bodies stay frozen.
- Touching the `docs/inbox/` and `docs/research/` conventions.

## Further notes

- **Precedent for the new convention.** `apps/claude-code/pr-review/docs/issues/pr-review-ado-fetcher-step4-fix/` (GH #120) is the first plugin-scoped PRD filed under the correct path. This PRD aligns the rest.
- **History preservation matters.** Use `git mv` (not delete-and-recreate) so `git log --follow` traces the pre-move history of each file. Reviewers reading `done/` slices need that history.
