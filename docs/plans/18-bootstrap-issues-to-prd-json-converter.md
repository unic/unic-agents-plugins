# 18. Bootstrap: issues-to-prd-json converter for unic-archon-dlc

**Status: ready-for-agent**

**Priority:** P2
**Effort:** S
**Version impact:** none (throwaway bootstrap tooling)
**Depends on:** —
**Touches:** `scripts/issues-to-prd-json.mjs` (new), `docs/workflow/unic-archon-dlc/prd.json` (generated output)

## Context

### The bigger picture

We are building a Claude Code plugin called **`unic-archon-dlc`** that ships an Archon-powered AI development lifecycle (six workflows: `explore`, `plan`, `build`, `qa`, `cleanup`, `triage`). The plugin itself does not yet exist. The PRD is at `docs/issues/unic-archon-dlc/PRD.md` and 14 implementation issues live at `docs/issues/unic-archon-dlc/NN-slug.md` (already created via `/to-issues`).

### The bootstrapping paradox

Because the plugin does not exist yet, we cannot use `unic-archon-dlc` to implement `unic-archon-dlc`. To break this paradox, we plan to manually feed our existing issues to **one of Archon's native default workflows** — specifically `archon-ralph-dag`, which already handles vertical-slice issues with a dependency DAG, parallel execution, and AFK loops.

The catch: `archon-ralph-dag` expects its input in **`prd.json` format** (the output of `archon-ralph-generate`). Our issues are in **markdown format** (the output of `/to-issues`). The two formats don't match.

This plan implements the one-off converter that bridges the gap.

### Prior research on this decision

- `docs/research/archon-native-to-issues.md` — confirms `archon-ralph-dag`'s native input format and field mappings.
- `docs/research/archon-vs-native-skills.md` — documents the decision to keep Archon as the runtime (rather than dropping it for native Claude Code skills).

### What the converter is NOT

- Not a feature of the `unic-archon-dlc` plugin. The plugin's own `to-issues` workflow node writes `issues.json` (a different, plugin-native format) — see PRD implementation decisions and issue 07.
- Not intended for general reuse. After `unic-archon-dlc` ships, no one should ever need this script again.
- Not part of any CI pipeline, test suite, or `pnpm` workspace script.

It is a bootstrap throwaway. Treat it like scaffolding.

## Current behaviour

There is no converter. The user cannot start an Archon `archon-ralph-dag` run because:

1. No `prd.json` exists for `unic-archon-dlc`.
2. The 14 markdown issues at `docs/issues/unic-archon-dlc/NN-*.md` cannot be consumed by Archon natively.

## Target behaviour

Running `node scripts/issues-to-prd-json.mjs` reads every numbered markdown issue under `docs/issues/unic-archon-dlc/` and writes a `prd.json` file at `docs/workflow/unic-archon-dlc/prd.json` in the format Archon's `archon-ralph-dag` expects.

### Input format (per markdown issue)

Each input file is `docs/issues/unic-archon-dlc/NN-<slug>.md` where `NN` is a two-digit number. The first issue is `01-plugin-scaffold-and-tracer-install.md`, the last is `14-readme-and-documentation.md`. `PRD.md` is in the same directory and must be skipped.

Each file follows this shape (verified against all 14 issues; do not assume — re-read a few before parsing):

```markdown
# <Title — first H1, single line>

**Status:** ready-for-agent
**Category:** feature|docs

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

<free-form paragraphs and lists; may include sub-headings like "In scope:" and "Out of scope:">

## Acceptance criteria

- [ ] Criterion one
- [ ] Criterion two
- [ ] Criterion three

## Blocked by

- `docs/issues/unic-archon-dlc/06-plan-specs-and-to-prd.md`
- `docs/issues/unic-archon-dlc/03-triage-workflow-and-tracker-adapter.md`
```

Or for unblocked issues:

```markdown
## Blocked by

None — can start immediately.
```

The `Blocked by` references are always full repo-relative paths starting with `docs/issues/unic-archon-dlc/` followed by `NN-<slug>.md`.

### Output format (`prd.json`)

```json
{
  "stories": [
    {
      "id": "US-001",
      "title": "Plugin scaffold and tracer install hook",
      "description": "<full content of `## What to build` section, including subsections>",
      "acceptanceCriteria": [
        "Criterion one",
        "Criterion two"
      ],
      "dependsOn": [],
      "status": "pending"
    },
    {
      "id": "US-007",
      "title": "Plan workflow — to-issues, nyquist-map, and validation gate",
      "description": "...",
      "acceptanceCriteria": ["..."],
      "dependsOn": ["US-006"],
      "status": "pending"
    }
  ]
}
```

Mapping rules:

| Markdown source | `prd.json` field |
|---|---|
| Filename `NN-slug.md` | `id` = `US-<NNN>` (zero-padded to 3 digits, so `01` → `US-001`) |
| First `# <Title>` line | `title` (trimmed) |
| Body of `## What to build` section | `description` (preserve markdown, trim leading/trailing whitespace) |
| Each `- [ ] <text>` line under `## Acceptance criteria` | one entry in `acceptanceCriteria` array (strip the checkbox prefix, trim) |
| Each `docs/issues/unic-archon-dlc/NN-*.md` reference under `## Blocked by` | one entry in `dependsOn` array mapped to `US-<NNN>` |
| Literal text "None" (case-insensitive) under `## Blocked by` | empty `dependsOn: []` array |
| Always | `status: "pending"` |

Output stories are sorted by `id` ascending (US-001 first).

## Affected files

| File | Change |
|---|---|
| `scripts/issues-to-prd-json.mjs` | Create — the converter |
| `docs/workflow/unic-archon-dlc/prd.json` | Generated output (committed for traceability, not gitignored) |

## Implementation steps

1. Verify the input shape by reading at least three issues end-to-end:
   - `docs/issues/unic-archon-dlc/01-plugin-scaffold-and-tracer-install.md` (unblocked, baseline)
   - `docs/issues/unic-archon-dlc/07-plan-to-issues-and-nyquist.md` (single dependency)
   - `docs/issues/unic-archon-dlc/13-cleanup-workflow.md` (multiple dependencies)
2. Create `scripts/issues-to-prd-json.mjs` as a zero-dependency Node.js ESM script (`.mjs`). Use only `node:fs/promises`, `node:path`, `node:url`. Use `// @ts-check` and JSDoc for type safety per `auto-format` ADR-0008.
3. Compute the project root from `import.meta.url` so the script can be invoked from any working directory (must work on macOS, Windows, and Linux per the monorepo cross-platform requirement).
4. Discover input files: `readdir` of `docs/issues/unic-archon-dlc/`, filter to `^\d{2}-.+\.md$`, sort ascending.
5. For each file, parse the four sections (title, what-to-build, acceptance-criteria, blocked-by) using regex on section headings. Tolerate trailing whitespace and CRLF line endings.
6. Map filenames to story IDs and resolve `Blocked by` paths to those IDs.
7. Write `docs/workflow/unic-archon-dlc/prd.json` with `JSON.stringify(prd, null, 2) + '\n'`. Create the parent directory with `mkdir({ recursive: true })`.
8. Log a one-line summary: `Wrote N stories to <path>`.
9. Run the script and visually spot-check the output JSON against three source markdown files.

## Verification

```sh
# From repo root
node scripts/issues-to-prd-json.mjs

# Expected: "Wrote 14 stories to docs/workflow/unic-archon-dlc/prd.json"

# Manual checks
jq '.stories | length' docs/workflow/unic-archon-dlc/prd.json
# → 14

jq '.stories[0].id' docs/workflow/unic-archon-dlc/prd.json
# → "US-001"

jq '.stories[0].dependsOn' docs/workflow/unic-archon-dlc/prd.json
# → [] (slice 01 has no blockers)

jq '.stories[12].dependsOn' docs/workflow/unic-archon-dlc/prd.json
# → ["US-012", "US-003"] (slice 13 is blocked by 12 and 03)

jq '[.stories[].acceptanceCriteria | length] | add' docs/workflow/unic-archon-dlc/prd.json
# → 100+ (sanity check that criteria were extracted)
```

Cross-platform check: run on a non-POSIX-path-aware shell (PowerShell or `bash --norc` with `LC_ALL=C`) and confirm the script still produces identical output. The script must not rely on `ls`, `find`, or any POSIX-only shell construct.

## Acceptance criteria

- [ ] `scripts/issues-to-prd-json.mjs` exists, runs with `node scripts/issues-to-prd-json.mjs`, exits 0.
- [ ] `docs/workflow/unic-archon-dlc/prd.json` contains exactly 14 stories.
- [ ] Every story has a non-empty `title`, `description`, and `acceptanceCriteria` array.
- [ ] `dependsOn` arrays correctly reflect the `Blocked by` section of each source markdown.
- [ ] `dependsOn: []` for slices whose `Blocked by` reads "None — can start immediately."
- [ ] Output JSON is sorted by `id` ascending.
- [ ] Script has zero external runtime dependencies (uses only `node:` built-ins).
- [ ] Script uses `// @ts-check` and JSDoc, passes `pnpm typecheck` at repo root.
- [ ] Cross-platform: no POSIX-only shell commands or path separators in the script.

## Next steps (after this plan completes — do NOT do in this plan)

1. Run `archon workflow inspect archon-ralph-dag` to confirm it accepts `prd.json` either as a `--input issues_file=...` argument or at a default path like `.archon/ralph/unic-archon-dlc/prd.json`.
2. Place `prd.json` at the expected location (or pass it via CLI input).
3. Create a feature worktree from `develop` (per repo Gitflow): `git worktree add .claude/worktrees/unic-archon-dlc-build origin/develop`.
4. Trigger Archon: `archon workflow run archon-ralph-dag --input issues_file=docs/workflow/unic-archon-dlc/prd.json` (or its actual input shape).
5. Monitor execution; Archon implements stories in dependency order and marks them `passes: true` as it goes.

## Out of scope

- Reverse converter (`prd.json` → markdown). Not needed — the markdown is the source of truth, JSON is derived.
- Writing the converter as a feature of `unic-archon-dlc` itself. The plugin's native `to-issues` workflow emits its own `issues.json` format (different shape) per issue 07.
- Validating Archon's exact input shape — that is the "next steps" research, not part of building the converter.
- Triggering the actual Archon `archon-ralph-dag` run — that is the next plan after this one.
- Any changes to the source markdown issues. The converter is read-only on inputs.
- CI integration, npm scripts, or `pnpm` workspace registration. This is throwaway tooling.

## References

- PRD: `docs/issues/unic-archon-dlc/PRD.md`
- Issues: `docs/issues/unic-archon-dlc/01-*.md` through `14-*.md`
- Conversation export (full grilling + design rationale): `docs/conversations/unic-archon-dlc.grill.txt`
- Research — Archon vs native: `docs/research/archon-vs-native-skills.md`
- Research — Archon to-issues mapping: `docs/research/archon-native-to-issues.md`
- Repo conventions: `CLAUDE.md` (cross-platform, code style, zero-deps for plugins)
- Prior art for zero-dep `.mjs` + JSDoc + `node:test`: `apps/claude-code/auto-format/scripts/lib/`
