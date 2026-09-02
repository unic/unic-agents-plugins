# ADRs — unic-archon-dlc plugin

Plugin-scoped architectural decisions. Repo-wide decisions live in `docs/adr/` at the monorepo root.

## Form and numbering

A new Plugin ADR takes its **form** from the `domain-modeling` Method's ADR format document (`.agents/skills/domain-modeling/ADR-FORMAT.md` — a hint for finding it, not the reference; the owner is the Method, and its installed path is replaced on every `npx skills add`). One to three sentences is a whole ADR: the context, the decision, the reason. Every section beyond that is optional and earns its place.

Numbering comes from the root `docs/adr/README.md` instead: `NNNN-slug.md`, zero-padded to four digits, numbered per directory in the order decisions were recorded. The Method's examples are padded to four but it states no rule, so this half is the root's.

This Plugin diverges from the other plugin ADR homes here, which point at the root rather than stating a form of their own, because this Plugin composes the Method that defines the form — so it follows it.

### Two additions, and they are local

Both are this Plugin's. Cite them as this Plugin's, because the Method carries neither.

- **Every Plugin ADR carries a `Status` line.** The Method makes `Status` optional and writes it as lowercase frontmatter; here it is required and written as a bold line under the title — `**Status:** Accepted (2026-07-02)` — so that the index's Status column below has a source in the file it describes.
- **A decision that still stands while a detail of it changes is revised inline.** Edit the body so it reads as current, and extend the `Status` line with the revision date: `Accepted (YYYY-MM-DD, revised YYYY-MM-DD)`. The first date is the one already on the line, the day the decision was recorded; leave it alone. Add no amendment block. The Method does not sanction inline revision at all; it offers superseding alone.

A **superseding** ADR is reserved for a decision that is reversed or replaced. Pick by subject, as the root does: a change to the same subject revises, a change of subject gets its own record.

### The amendment blocks that already exist

ADRs here still carry dated `> **Amended (YYYY-MM-DD):**` blockquotes from the previous convention. That convention is gone, and nothing sweeps the files.

When you first revise one of those ADRs inline, read its blocks, carry forward into Context or Decision whatever is still true, then delete the blocks. Git keeps the text. An ADR nobody edits keeps its blocks unchanged.

### Status values

Two surfaces carry a status: each ADR's own `**Status:**` line, and the Status column of the index below. Keep the two consistent in meaning; the column may be shorter.

- `Accepted (YYYY-MM-DD)` — the date the decision was recorded. The index column shortens it to `Accepted`.
- `Accepted (YYYY-MM-DD, revised YYYY-MM-DD)` — inline revision.
- `Superseded by ADR-NNNN` — the ADR's own line links the successor, the column names it.

Legacy forms that existing files and rows still carry, and new work does not use:

- On an ADR's `Status` line: a month-only date, and the extended `; amended YYYY-MM-DD — <what>` clause that recorded a blockquote below it.
- In the index column: `Accepted (amended)`, with or without issue numbers and a date in the parentheses; and `Accepted; <what> amended by ADR-NNNN`, with or without trailing issue numbers, also spelled `revised by` and `floor amended by`.

## Index

| ID   | Title                                                                                      | Status                              |
| ---- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| 0001 | Setup is a slash command delegating to `lib/install-runner.mjs`                            | Superseded by ADR-0019              |
| 0002 | Each plugin has its own Ralph loop with its own ralph.yml and PROMPT.md                    | Superseded by ADR-0009              |
| 0003 | Spec template format for Ralph-executable specs                                            | Superseded by ADR-0009              |
| 0004 | Ralph implements one spec per iteration, then commits and stops                            | Superseded by ADR-0009              |
| 0005 | `/tdd` for behavioral specs, direct for structural ones, dispatched by `Version impact:`   | Accepted                            |
| 0006 | Feature Runner injects a scoped context bundle into every `/tdd` sub-agent invocation      | Superseded by ADR-0010              |
| 0007 | `## Blocked by` is the canonical sequencing signal for Feature Runner issue execution      | Accepted                            |
| 0008 | Feature Runner invokes `/tdd` non-interactively; acceptance criteria replace planning      | Superseded by ADR-0010              |
| 0009 | Retire ralph-orchestrator; adopt unic-archon-dlc as the Feature Runner                     | Accepted                            |
| 0010 | Retire the `/implement-feature` skill; Feature Runner backed solely by `unic-dlc-build`    | Accepted                            |
| 0011 | Archon version target (≥ 0.5.0) and key-discriminated node-schema conventions              | Accepted; floor amended by ADR-0033 |
| 0012 | Fresh-context red/green separation for anti-cheating                                       | Accepted                            |
| 0013 | Issue tracker is the single source of truth; HANDOFF.md/ROADMAP.md dropped                 | Accepted                            |
| 0014 | Workflow-per-box decomposition                                                             | Accepted; revised by ADR-0017       |
| 0015 | `workflows/<slug>/` is the artifact home                                                   | Accepted                            |
| 0016 | DLC is a thin process layer; compose team system-skills for the _how_                      | Accepted; amended by ADR-0030, #381 |
| 0017 | Container follows structural need (Archon for AFK, commands/skills for interactive)        | Accepted                            |
| 0018 | Generic core + per-project config; the tested-lib surface reached zero                     | Accepted (amended #381)             |
| 0019 | Conversational `/setup`; the one thin tested schema lib is gone                            | Accepted (amended #381)             |
| 0020 | `/specs` reaches an aligned PRD by branch-on-input                                         | Accepted (amended)                  |
| 0021 | A box ships only if it adds value; reference verbatim skills                               | Accepted; amended by ADR-0030       |
| 0022 | `/tickets` slices a PRD into build-ready issues; `/build` consumes them via a generic loop | Accepted                            |
| 0023 | `/build` is one generic red/green loop; dag-builder dissolved                              | Accepted (amended #281, #381)       |
| 0024 | `/triage` is the intake on-ramp; thin wrapper binds Matt's method to DLC config            | Accepted (amended #296, #389)       |
| 0025 | `/qa` is an Archon pipeline with two config-gated approvals + an issue-producing on-ramp   | Accepted (amended #389)             |
| 0026 | `/pr-review` is a generic fan-out Archon workflow harvesting unic-pr-review's learnings    | Accepted (amended #281, 2026-08-24) |
| 0027 | `/improve-architecture` is a skill composing Matt's method + owns ADR superseding          | Accepted                            |
| 0028 | `/cleanup` is the repo-global operational janitor; retires the legacy cleanup workflow     | Accepted (amended #389)             |
| 0029 | `/explore` is an off-line research + AFK-spike on-ramp; findings.md is the /specs baton    | Accepted (amended #281, #389)       |
| 0030 | The DLC is a Harness hosting Methods; a Box survives only for what no Method can supply    | Accepted (amended #381)             |
| 0031 | Methods are bundled, the plugin version is the pin, resolution is one path                 | Accepted (amended #381)             |
| 0032 | Vocabulary: Box, Method, Bundle; config is parameters, a Method is procedure               | Accepted (amended #389, #381)       |
| 0033 | Archon 0.7.0 schema target — floor bump, always_run, sub-runs deferred                     | Accepted (amended #389, #396)       |
| 0034 | The evidence gate is a deterministic script writer, never a self-judging prompt            | Accepted                            |
| 0035 | `/archon-upgrade` reports Archon-release impact; read-only, cites 0011/0033 by reference   | Accepted (amended #381, #396)       |
| 0036 | `/setup` owns a named install set; a Box workflow retires by name, never by header         | Accepted (amended #295, #381)       |
