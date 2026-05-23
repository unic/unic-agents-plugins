---
title: Refresh per-plugin CLAUDE.md / AGENTS.md for monorepo context
created: 2026-05-23
---

**Status:** ready-for-agent
**Plugin:** all four Claude Code Plugins (`apps/claude-code/{auto-format,pr-review,unic-confluence,unic-archon-dlc}`)
**Category:** docs

## Problem Statement

The per-plugin agent-guidance files in this monorepo predate the migration and still speak as if each plugin lives in its own standalone repo.

- `apps/claude-code/auto-format/CLAUDE.md`, `apps/claude-code/pr-review/CLAUDE.md`, and `apps/claude-code/unic-confluence/CLAUDE.md` all open with "This file provides guidance to Claude Code when working in this repository" and proceed to duplicate content that already lives in the root `AGENTS.md`: pnpm scripts, SemVer policy, Conventional Commits scope, code conventions, tag scheme, Gitflow rules.
- `unic-confluence/CLAUDE.md` carries an obsolete naming-convention table (`unic-claude-code-<service>`) that referred to the pre-migration repo layout.
- `auto-format/CLAUDE.md` calls the plugin by its retired identifier (`unic-claude-code-format`).
- `pr-review/CLAUDE.md` references `commands/review-pr.md` and a "spec 02" that the file does not link out to or pin down.
- `apps/claude-code/unic-archon-dlc/` has no agent-guidance file at all. It has `CONTEXT.md` (domain vocabulary), but a contributor opening that directory has nothing equivalent to the other plugins' files.

The root `AGENTS.md`/`CLAUDE.md` symlink convention is not mirrored at the plugin level: each plugin has a single `CLAUDE.md` file. This works for Claude Code but does not advertise the same cross-agent compatibility the root uses.

The backlog item in `docs/plans/README.md` — "Update plugin `CLAUDE.md` files for monorepo context" — was deferred during the plugin migration Specs 05–07 and never picked back up.

## Solution

Each Plugin gets an `AGENTS.md` written in monorepo voice, with a `CLAUDE.md` symlink alongside (mirroring the root pattern). The file contains only what is _specific_ to that Plugin; everything generic links to the root `AGENTS.md`. The four files share a common section structure so a reader who has seen one knows where to look in the others.

`unic-archon-dlc` gets its first `AGENTS.md` in the same style. Its `CONTEXT.md` continues to own the domain vocabulary and is referenced from the new file, not duplicated.

## User Stories

1. As a new contributor opening `apps/claude-code/pr-review/AGENTS.md`, I want a one-paragraph statement of what the Plugin does so that I do not have to read source code to orient myself.
2. As a new contributor opening any plugin's `AGENTS.md`, I want it to link out to the root `AGENTS.md` for cross-cutting conventions, so that I do not get conflicting guidance from the two files.
3. As a new contributor reading a plugin file, I want generic monorepo rules (pnpm scripts, Gitflow, SemVer policy, code conventions) to live in one place — the root — so that drift between files cannot create contradictions.
4. As a maintainer renaming a plugin command or changing the bot signature, I want the canonical wording to live in the plugin's own `AGENTS.md`, so that I do not have to remember to update the root file too.
5. As a contributor working on `pr-review`, I want the bot signature format and the soft-dependency on `pr-review-toolkit` to be visible in the plugin file, so that I do not break observability or runtime preconditions accidentally.
6. As a contributor working on `auto-format`, I want the "always exits zero" doctrine and the "consumer owns Formatters" rule to be prominent in the plugin file, so that I do not accidentally introduce a blocking Format Hook or bundled Formatter.
7. As a contributor working on `unic-confluence`, I want the marker-injection priority order and the long "do not add" list to remain in the plugin file, so that I do not propose features that have already been decided against.
8. As a contributor working on `unic-archon-dlc`, I want the file to state the Setup idempotence contract and the dogfooding note explicitly, so that I understand both how the Plugin behaves in a Consumer repo and that this monorepo is also a Consumer.
9. As a contributor opening any plugin's directory, I want a pointer to that plugin's own `docs/adr/` so that I can find the historical design decisions specific to that Plugin without reading the root `docs/adr/`.
10. As an AI agent operating with the AGENTS.md convention, I want every Plugin directory to expose an `AGENTS.md` file so that I can discover guidance without falling back to Claude-specific filenames.
11. As an AI agent operating in Claude Code, I want a `CLAUDE.md` to still be present in every Plugin directory so that the existing tooling continues to find it.
12. As a maintainer reviewing a diff, I want all four plugin `AGENTS.md` files to share the same top-level section structure, so that I can compare them at a glance.
13. As a maintainer auditing for accuracy, I want references to obsolete identifiers (`unic-claude-code-format`, `unic-claude-code-<service>`, the retired `spec-NN` commit scope) removed from every plugin file, so that the documentation reflects current state.
14. As a contributor reading the auto-format file, I want the standalone-repo "Project Overview" framing replaced with a plugin-inside-workspace framing, so that I do not misunderstand the surrounding context.
15. As a contributor reading the unic-confluence file, I want the "no `pnpm run` wrapper is defined" note revisited or removed, so that the file does not contradict the monorepo's actual `pnpm bump` / `pnpm verify:changelog` script entries.
16. As a maintainer, I want each plugin file to point to the same canonical set of root docs (root `AGENTS.md`, root `CONTEXT.md`, root `docs/process/`, root `docs/adr/`, root `CONTEXT-MAP.md`) so that the linking surface is predictable.
17. As an agent or contributor following a link from a plugin file to root docs, I want those links to be relative paths that work from the plugin directory, so that they resolve correctly in editors and on GitHub.
18. As a maintainer, I want a brief acknowledgement in each file that the per-plugin `docs/plans/` directory is historical (no longer the intake path) so that contributors do not treat retired specs as live work.

## Implementation Decisions

### File naming and convention

Each Plugin directory gets two files at its root:

- `AGENTS.md` — the canonical agent guidance file.
- `CLAUDE.md` — a relative symlink pointing to `AGENTS.md`, matching the root convention (`CLAUDE.md -> AGENTS.md`).

The existing `CLAUDE.md` regular file is replaced by the symlink in each affected Plugin. The new `AGENTS.md` carries the refreshed content. The symlink direction must be `CLAUDE.md → AGENTS.md` (not the reverse), so the canonical file name in `git log` and in the file tree is `AGENTS.md`.

### Uniform section template (all four files)

Every plugin `AGENTS.md` uses the same top-level structure. Sections may be omitted when not applicable (for example, a Plugin with no external runtime dependencies omits that section).

1. **What this Plugin is** — one paragraph. States the Plugin's role inside the monorepo and points to its `CONTEXT.md` for vocabulary.
2. **Where to start** — link list to root `AGENTS.md`, root `CONTEXT.md`, root `CONTEXT-MAP.md`, root `docs/adr/`, root `docs/process/`, and to this Plugin's own `docs/adr/`. Notes that root `AGENTS.md` is the source of truth for cross-cutting conventions (pnpm, Gitflow, SemVer, Conventional Commits, code conventions, LICENSE policy, cross-platform requirement).
3. **Commands** — only the pnpm scripts unique to this Plugin (typically `bump`, `sync-version`, `tag`, `verify:changelog`, plugin-specific `test` / `typecheck`). Root-wide commands are not duplicated.
4. **Layout** — short tree of the directories that exist in this Plugin (`.claude-plugin/`, `commands/`, `agents/`, `hooks/`, `lib/`, `scripts/`, `tests/`, `test/`, `docs/`). One line per directory describing its role.
5. **Plugin doctrines** — the load-bearing invariants that are not obvious from the code or the root rules. These are the contents most worth preserving from the existing files.
6. **External dependencies** — runtime tools or Consumer-side packages this Plugin assumes (e.g. `az devops` CLI for `pr-review`; the Archon runtime for `unic-archon-dlc`).
7. **Do not add** — Plugin-specific scope guard, listing things that have been considered and explicitly excluded.
8. **Plugin ADRs** — single line linking to `docs/adr/` for this Plugin.

A sentence at the end of section 8 acknowledges that `docs/plans/` (per-plugin) is historical and not the intake path for new work; pointers to the issue tracker and root `docs/process/` cover the live workflow.

### Per-plugin content decisions

What survives, plugin by plugin (content list, not full prose):

**auto-format**

- Doctrines: Format Hook always exits zero (ADR-0001); consumer owns Formatters (ADR-0003); zero runtime dependencies bar (ADR-0002); per-project config merge (ADR-0004); POSIX path normalisation on Windows (ADR-0006).
- Layout: `hooks/`, `scripts/`, `tests/`, `.claude-plugin/`.
- External deps: none.
- Do not add: bundled Formatters, MCP server, bash hooks, pre-commit hooks.

**pr-review**

- Doctrines: canonical bot signature (ADR-0001) — exact wording lives in the file; signature-based prior-review detection (ADR-0002); target latest iteration (ADR-0003); incremental diff baseline (ADR-0004); four-state thread classification (ADR-0005); reply-not-duplicate auto-resolve (ADR-0006); summary rewritten not appended (ADR-0007); soft dependency on `pr-review-toolkit` (ADR-0008); orchestrator-thin rule (≤ 200 lines).
- Layout: `commands/`, `agents/`, `scripts/`, `tests/`, `.claude-plugin/`.
- External deps: Azure CLI with `azure-devops` extension; `pr-review-toolkit` plugin from `anthropics/claude-plugins-official`.
- Do not add: GitHub PR support (until ADR), vote-on-PR action, PR description generation.

**unic-confluence**

- Doctrines: refuse publish without markers (ADR-0001); three-strategy injection priority (ADR-0002); structured macro for code blocks (ADR-0003); dry-run read-only (ADR-0004); ping-check auth over per-page-verify (ADR-0005); hard HTTP timeout (ADR-0006); `CliError` class (ADR-0007); pure-functions lib with tests (ADR-0008); bare-integer page-id schema (ADR-0009); no catalog for runtime deps (ADR-0010); alias auto-population (ADR-0011); do-not-add-scope-guard (ADR-0012).
- Layout: `commands/`, `scripts/`, `.claude-plugin/`.
- External deps: Confluence v2 REST API endpoint; `~/.unic-confluence.json` credentials file.
- Do not add: the existing eight-item list (image upload, create-page, multi-space, MCP server, agents/sub-agents, recursive publishing, changesets, watch mode) survives intact — it is the most valuable content in the current file.

**unic-archon-dlc** (new file)

- Doctrines: Setup is the sole entry point and is idempotent (ADR-0001 in this Plugin's own `docs/adr/`); Session is scoped by Slug; HANDOFF.md / ROADMAP.md are written exclusively by the triage workflow; the marker-delimited `## Agent skills` block in a Consumer's `CLAUDE.md` is auto-managed; this monorepo dogfoods the Plugin against itself (cross-link to the separate dogfood-banner PRD).
- Layout: `commands/`, `lib/`, `hooks/`, `test/`, `docs/`, `.claude-plugin/`.
- External deps: Archon workflow engine version ≥ 0.10 in the Consumer project.
- Do not add: parallel-runner support before the linear path is operational; per-plugin variants of the Slug scheme; Consumer-side opt-out flags for individual workflow phases (until a real need surfaces).
- Dogfooding note: explicitly states that this monorepo has had Setup run against it, points the reader at `docs/agents/*.md` as the generated output, and warns that those files describe the target workflow rather than current local practice.

### What gets dropped (across all four files)

- pnpm script listings that mirror the root (`pnpm install`, `pnpm test` (root-level), `pnpm check`, `pnpm format`, `pnpm ci:check`, `pnpm typecheck` (root)). The plugin-specific `bump`/`sync-version`/`tag`/`verify:changelog` scripts remain.
- SemVer policy tables — these duplicate ADR-0022 and root `AGENTS.md`.
- Conventional Commits scope explanation — duplicates root `AGENTS.md` and ADR-0021.
- Tag scheme explanation — duplicates ADR-0008 and root `AGENTS.md`.
- Generic "code conventions" sections (tabs vs spaces, single quotes, ESM) — root `AGENTS.md` owns these.
- Cross-platform requirement statements — root owns this.
- Standalone-repo install instructions ("Add to `~/.claude/settings.json`") — moved to each Plugin's `README.md` if not already there; out of scope of this PRD beyond noting it.
- `unic-confluence`'s "Naming convention" table — obsolete since plugin migration; the canonical Plugin identifier now lives in `.claude-plugin/plugin.json`.

### Symlink mechanics

The symlink is created with a relative target so it survives a `git clone` on any OS that supports symlinks. On Windows, repository owners with the relevant Git config (`core.symlinks=true`) get a working symlink; without it, the symlink resolves as a text file containing the target path. This matches how the root `CLAUDE.md -> AGENTS.md` symlink already behaves and so requires no new policy.

### No version bump

This is a documentation-only change to Plugin directories. No Plugin's behaviour changes; no `plugin.json` field changes; no new commands or hooks ship. `pnpm --filter <name> bump` is not invoked for any Plugin. The CHANGELOGs are not touched. `verify:changelog` ignores doc-only PRs by design (PR-only gate, see ADR-0017) — confirm this still holds for the diff before merging.

### One PR or four?

Single PR is acceptable because the changes are mechanically uniform across all four Plugins and reviewing the four files side-by-side is easier than tracking four separate PRs. If the diff grows unwieldy, split per Plugin. Default: one PR targeting `develop`.

## Testing Decisions

This is a documentation refresh with no code changes; there is no test suite to update.

The verification surface is human review of the four `AGENTS.md` files plus the four `CLAUDE.md` symlinks. Reviewer checks:

- Each `AGENTS.md` follows the eight-section template; sections absent only when the Plugin genuinely lacks content for that section.
- No content from the dropped list (root-mirroring pnpm scripts, SemVer, Conventional Commits, code conventions) appears in any plugin file.
- Per-plugin doctrines listed above are present and link to the relevant Plugin ADR by number.
- Each `CLAUDE.md` is a symlink to `AGENTS.md`, not a regular file with duplicated content.
- Links from each plugin file resolve correctly on GitHub (relative paths up to the repo root).
- `pnpm check` and `pnpm format` pass against the new Markdown files (Prettier handles `.md`).
- No reference remains to the retired identifiers `unic-claude-code-format`, `unic-claude-code-<service>`, or `spec-NN` commit scopes.

If automated assertions are desired in the future (e.g. a script that asserts every plugin directory has an `AGENTS.md` and a matching `CLAUDE.md` symlink), that can be added later as a separate Feature. Not included here.

## Out of Scope

- Any code changes inside the Plugins (no command behaviour, no hook contract, no lib refactor).
- Changes to the root `AGENTS.md` / `CLAUDE.md` symlink.
- Changes to per-plugin `CONTEXT.md` — they own the domain glossary and remain as-is.
- The dogfood-banner work tracked separately (`docs/issues/unic-archon-dlc-dogfood-banner/`).
- ADR reshelving from root `docs/adr/` into `apps/claude-code/unic-archon-dlc/docs/adr/`, tracked separately.
- Archival or deletion of per-plugin `docs/plans/` directories — handled by the cleanup chore PR.
- Refreshing each Plugin's `README.md` (Consumer-facing). Out of scope; if the standalone-repo install instructions that get dropped from `CLAUDE.md` are missing from the README, address in a follow-up.
- An assertion script that enforces the `AGENTS.md` + `CLAUDE.md` symlink convention across all Plugins.

## Further Notes

- The pr-review file currently references "spec 02" without linking. The refreshed file replaces this with the corresponding ADR link (`apps/claude-code/pr-review/docs/adr/0002-signature-based-prior-review-detection.md`).
- `unic-archon-dlc`'s file is the only fully new artifact; the other three are rewrites. Treat the new file as the canonical example of the template and align the other three to its structure.
- The PRD assumes the `AGENTS.md` + `CLAUDE.md` symlink pattern is the right answer for the monorepo. The root already follows this. If a Consumer's tooling required Plugin directories to contain a regular `CLAUDE.md` file rather than a symlink, this would change; no such Consumer is known.
- Re-running `unic-archon-dlc` setup against this monorepo after the new `AGENTS.md` lands would update the marker-delimited `## Agent skills` block in root `AGENTS.md` only. The per-Plugin `AGENTS.md` files are not touched by Setup, so no regeneration risk.
