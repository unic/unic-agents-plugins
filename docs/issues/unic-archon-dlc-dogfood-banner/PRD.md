---
title: unic-archon-dlc — banner auto-generated dogfood output
created: 2026-05-23
---

**Status:** ready-for-agent
**Plugin:** `apps/claude-code/unic-archon-dlc`
**Category:** enhancement

## Problem Statement

This monorepo dogfoods the `unic-archon-dlc` Plugin against itself: someone has already run its setup on this repo, so `docs/agents/issue-tracker.md`, `docs/agents/labels.md`, `docs/agents/branching.md`, `docs/agents/domain.md`, `docs/agents/workflow.md`, and a marker-delimited block inside the root `AGENTS.md` are auto-generated outputs of `apps/claude-code/unic-archon-dlc/lib/agent-docs-writer.mjs`.

Nothing in those files signals that:

1. They are auto-generated and will be overwritten on the next setup run — a contributor who edits them by hand loses their work.
2. They describe the **target** `unic-archon-dlc` workflow (seven `unic-dlc-*` phases, `docs/workflow/<slug>/` artifacts), not the current practice in this repo (Matt Pocock's skills + manual `/tdd`).
3. The HTML-comment markers in `AGENTS.md` (`<!-- unic-archon-dlc:begin -->` / `<!-- unic-archon-dlc:end -->`) wrap content that is owned by the harness and refreshed on every install.

The result is a Strange Loop: this repo's own consumer-template documentation reads as canonical project guidance, and there is no visible cue separating "what the harness installs into a Consumer" from "what this repo actually does today."

## Solution

The Plugin gains a small `dogfood-banner` module that owns two banner strings. `agent-docs-writer.mjs` consumes those strings so every file it generates carries a visible, regeneration-safe banner. The banner content names the file as auto-generated, points the reader at the canonical regeneration command, and clarifies that the file describes the unic-archon-dlc target workflow rather than current local practice.

The banner is applied in two places:

- **`docs/agents/*.md` (five files):** banner prepended to the file body, so it appears at the very top of every generated doc.
- **`AGENTS.md` auto-managed block:** banner inserted as the first line _inside_ the marker region, so it lives alongside the auto-managed link list and is refreshed in lockstep.

Because both write paths overwrite their target on every run, the banner is automatically refreshed on every setup — no idempotence trickery required beyond what already exists.

After the Plugin change ships, the existing five `docs/agents/*.md` files in this repo and the AGENTS.md block are updated so the dogfood state matches the new behaviour.

## User Stories

1. As a contributor opening `docs/agents/workflow.md` for the first time, I want to immediately see that the file is auto-generated so that I do not waste time editing it by hand.
2. As a contributor about to edit one of the `docs/agents/*.md` files, I want the banner to tell me which command regenerates the file so that I know where to make the change instead.
3. As a contributor reading `docs/agents/workflow.md`, I want the banner to tell me that the seven `unic-dlc-*` phases describe the target lifecycle and not the current driver, so that I do not assume `/unic-dlc-build` is available in this repo today.
4. As a contributor reading `AGENTS.md`, I want the auto-managed block to announce itself in plain text — not just via easy-to-miss HTML comments — so that I do not hand-edit content that will be overwritten.
5. As a maintainer running the unic-archon-dlc setup against this repo, I want the banner to be re-applied on every run so that the warning never drifts away as the generated content evolves.
6. As a maintainer changing the banner wording, I want the banner constants to live in a single module so that I do not have to hunt across template builders.
7. As a maintainer adding a new generated `docs/agents/*.md` file in the future, I want the banner prefix mechanism to be applied uniformly so that I do not have to remember to copy-paste banner text into a new template.
8. As a Consumer installing `unic-archon-dlc` for the first time, I want the banner to appear on my generated files too, so that my own team is warned not to hand-edit them.
9. As a Consumer who has unic-archon-dlc set up but is still using interim tools, I want the banner to make explicit that the generated docs describe the unic-archon-dlc workflow so that my contributors do not assume the workflow is already operational locally.
10. As a maintainer running `pnpm --filter unic-archon-dlc test`, I want a dedicated test for the banner module so that wording changes are deliberate and reviewed.
11. As a maintainer running `pnpm --filter unic-archon-dlc test`, I want the existing `docs/agents` and `AGENTS.md` install tests to assert banner presence so that a regression in template wiring fails CI rather than slipping through.
12. As a maintainer verifying the change locally on this repo, I want to either re-run setup or apply the banner manually to bring the dogfood state into sync with the new behaviour, so that there is no in-tree inconsistency after the Plugin Release ships.

## Implementation Decisions

### New deep module: `lib/dogfood-banner.mjs`

A small, pure module that owns the dogfood banner strings and a formatting helper. Lives next to `agent-docs-writer.mjs` so the relationship is obvious.

Exports:

- `AGENT_DOC_BANNER` — the HTML-comment banner prepended to each `docs/agents/*.md` file. Content names the file as auto-generated, the source module, the regeneration command, and the workflow-vs-current-practice clarification.
- `SKILLS_BLOCK_BANNER` — a single-line banner inserted as the first line inside the `<!-- unic-archon-dlc:begin -->` / `<!-- unic-archon-dlc:end -->` block of `AGENTS.md`. Distinct from `AGENT_DOC_BANNER` because the markdown surrounding it differs (a Markdown link list vs. a full file body).
- `prependBanner(banner, body)` — pure helper that joins a banner to a body with consistent spacing (banner + blank line + body), normalising trailing newlines. Used by each template builder.

Module size target: under 60 lines. No I/O, no `node:fs`, no `node:path`. Pure string manipulation only.

### Modified module: `lib/agent-docs-writer.mjs`

- Imports `AGENT_DOC_BANNER`, `SKILLS_BLOCK_BANNER`, and `prependBanner` from `dogfood-banner.mjs`.
- Each of the five `build*Doc()` template builders returns `prependBanner(AGENT_DOC_BANNER, <existing body>)` instead of the raw body.
- `updateAgentSkillsBlock()` is updated so the rendered block becomes:

  ```
  <!-- unic-archon-dlc:begin -->
  {SKILLS_BLOCK_BANNER}

  {AGENT_SKILLS_LINKS}
  <!-- unic-archon-dlc:end -->
  ```

  The marker-delimited replacement logic is unchanged — only the inner body is augmented.

No other lib modules are touched. `install-runner.mjs`, `tracker-adapter.mjs`, `labels-config.mjs`, and the rest of the Plugin remain as-is.

### Banner content (canonical wording — owned by this PRD)

`AGENT_DOC_BANNER` (full-file prefix, HTML comment so it stays out of rendered prose):

```
<!--
  AUTO-GENERATED by unic-archon-dlc — DO NOT EDIT BY HAND.
  Source: apps/claude-code/unic-archon-dlc/lib/agent-docs-writer.mjs
  Regenerate: re-run `/unic-archon-dlc-setup` (or the setup-runner directly).
  This file describes the unic-archon-dlc target workflow; the current driver
  in any given Consumer repo may differ.
-->
```

`SKILLS_BLOCK_BANNER` (single-line, lives inside the marker block):

```
<!-- AUTO-GENERATED by unic-archon-dlc — do not edit; re-run setup to regenerate. -->
```

The wording is intentionally short on the AGENTS.md block (which is read inline alongside surrounding prose) and longer on the `docs/agents/*.md` prefix (where it stands alone at the top of a fresh file). Both reference the regenerate command by name so a reader can act on the warning without hunting.

### Plugin Release

- Version impact: **patch** — the change affects on-disk output of generated files only; no CLI flag, exit code, or programmatic interface changes.
- Run `pnpm --filter unic-archon-dlc bump patch` and add a dated CHANGELOG entry under the new version naming the banner addition.
- After the Plugin Release ships, the existing five `docs/agents/*.md` files and the AGENTS.md auto-managed block in this monorepo are updated so the dogfood state matches the new behaviour. Either re-run setup against the repo, or hand-apply the banner to the current files — both routes leave the repo in the same end state. Implementation can choose whichever is simpler.

### Out-of-tree side-effects

None. No changes to commands, hooks, agents, workflows, or `.archon/` artifacts. No new runtime dependencies.

## Testing Decisions

A good test for this change asserts the **observable output** of generated files and the AGENTS.md block — not the internal call graph of the template builders. We care that contributors and Consumers see the banner; we do not care how each template builder concatenates strings.

Three test files are in scope:

### New: `test/dogfood-banner.test.mjs`

Tests the new module in isolation:

- `AGENT_DOC_BANNER` contains the required signal phrases: "AUTO-GENERATED", the source module reference, and the regenerate hint.
- `SKILLS_BLOCK_BANNER` contains "AUTO-GENERATED" and the regenerate hint.
- `prependBanner(banner, body)` produces banner + blank line + body, regardless of whether `body` already ends with a newline.
- `prependBanner(banner, '')` returns just the banner (with no trailing junk).

These are pure-function assertions — no I/O, no temp dirs.

### Modified: `test/install-agent-docs.test.mjs`

The existing tests verify file presence and key content fragments. Extend each test so that, in addition to its current assertions:

- Each of the five generated files begins with the `AGENT_DOC_BANNER` string.
- The banner appears exactly once per file (no duplication on a second `writeAgentDocs` call against the same project dir).

### Modified: `test/install-claude-md.test.mjs`

The existing tests verify the marker block is written, refreshed idempotently, and does not destroy surrounding content. Extend so that:

- After `updateAgentSkillsBlock()`, the content between the begin and end markers contains `SKILLS_BLOCK_BANNER`.
- After running `updateAgentSkillsBlock()` three times, the banner appears exactly once inside the block (matches the existing idempotence test pattern).
- Surrounding non-block content is still preserved.

### Prior art

The existing test files under `apps/claude-code/unic-archon-dlc/test/` use `node:test`, `assert/strict`, and temp directories created under `os.tmpdir()`. The new banner test follows the same patterns but does not need a temp dir because the module is pure.

## Out of Scope

- Relocating any `docs/agents/*.md` file out of `docs/agents/` — the dogfooding is intentional; this PRD adds visibility only.
- Changing the contents of `docs/agents/*.md` beyond the prepended banner.
- Anything inside `.archon/` (config, workflows, commands).
- ADR reshelving from `docs/adr/` into `apps/claude-code/unic-archon-dlc/docs/adr/` — tracked separately.
- Refreshing per-plugin `CLAUDE.md` files for monorepo context — tracked separately.
- The chore PR sweeping retired `docs/plans/`, `.claude/skills/` symlinks, and root orphans.

## Further Notes

- The `unic-archon-dlc` plugin is not yet operational as a Feature Runner in this repo (per ADR-0030 and ADR-0031, manual `/tdd` remains the current path). The banner makes that gap visible at the doc level, which has educational value even before the runner ships.
- Future ADRs that record the dogfood-banner decision belong under `apps/claude-code/unic-archon-dlc/docs/adr/`, not the root `docs/adr/` directory.
- If the banner module turns out to need additional banner kinds in the future (e.g. for generated workflow YAMLs in a Consumer), it is the right home — keep them all in `dogfood-banner.mjs`.
