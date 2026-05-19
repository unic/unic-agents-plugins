# Archon Native Workflows — Mapping to `to-issues` Behavior

> **Scope note:** This document explored mapping the `to-issues` behaviour onto native Claude Code workflows (no Archon dependency). The PRD at `docs/issues/unic-archon-dlc/PRD.md` chose the Archon-workflow path instead — `to-issues` is implemented as a node inside `plan.yaml`. Read this doc for historical context; do not use it as implementation guidance for issue 07.

**Research date**: 2026-05-14
**Archon repo**: https://github.com/coleam00/Archon
**Workflows live at**: `.archon/workflows/defaults/` (not `workflows/` at root)

---

## What We Need

The `to-issues` skill should:

1. Accept a PRD (file or conversation context) as input
2. Decompose it into vertically-sliced, independently-grabbable issues
3. Attach `blocked_by` dependency notes between issues
4. Validate the breakdown interactively with the user before writing
5. Write issues to the local markdown tracker (`docs/issues/<slug>/`)

---

## Workflows Examined

### 1. `archon-ralph-dag`

**What it does**: End-to-end PRD→implementation loop using a DAG of user stories.

| Aspect                    | Detail                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Input                     | Idea text, `prd.md`, or a directory containing `prd.md` + `prd.json`                                                   |
| Output                    | Implemented code, committed commits, draft PR                                                                          |
| Issue decomposition       | Yes — via `archon-ralph-generate` sub-command; produces `prd.json` with `userStories[]` array                          |
| Dependency handling       | Yes — each story has a `dependsOn: [story-id]` array; the loop selects only stories where all deps have `passes: true` |
| User validation gate      | No — PRD generation is fully autonomous; no interactive confirmation step                                              |
| Issue tracker interaction | None — stories live in `.archon/ralph/{slug}/prd.json`, not in a markdown issue tracker                                |

**Story schema (prd.json)**:

```json
{
  "id": "US-001",
  "title": "...",
  "description": "As a...",
  "acceptanceCriteria": ["..."],
  "technicalNotes": "...",
  "dependsOn": [],
  "priority": 1,
  "passes": false,
  "notes": ""
}
```

Dependencies are expressed as `dependsOn: ["US-002"]` (array of story IDs). Priority determines execution order within the DAG: lower priority number = runs first.

**Closeness to `to-issues`**: High on decomposition and dependency DAG. Zero on issue-tracker integration and user validation.

---

### 2. `archon-interactive-prd`

**What it does**: Guided, conversational PRD authoring with three user-confirmation gates.

| Aspect                    | Detail                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Input                     | Feature idea (free text)                                                              |
| Output                    | A `prd.md` + a `prd.json` in `$ARTIFACTS_DIR/prds/`                                   |
| Issue decomposition       | No — stops at the PRD level; does not produce issues or stories                       |
| Dependency handling       | No                                                                                    |
| User validation gate      | Yes — three `approval` gates (foundation, deep-dive, scope) before generating the PRD |
| Issue tracker interaction | None                                                                                  |

**Closeness to `to-issues`**: Excellent user-validation UX, but produces a PRD, not issues. Complementary rather than equivalent.

---

### 3. `archon-create-issue`

**What it does**: Creates a single GitHub issue from a **bug report**, including automated reproduction.

| Aspect                    | Detail                                                    |
| ------------------------- | --------------------------------------------------------- |
| Input                     | Bug description                                           |
| Output                    | One GitHub issue (only if the bug reproduces)             |
| Issue decomposition       | No — single issue only, no slicing                        |
| Dependency handling       | No                                                        |
| User validation gate      | No — gated on reproduction success, not user approval     |
| Issue tracker interaction | GitHub only (`gh issue create`); not local markdown files |

**Closeness to `to-issues`**: Very different purpose. Single-bug, GitHub-only, no decomposition.

---

### 4. `archon-feature-development`

**What it does**: Implements an existing plan file and creates a PR.

| Aspect                    | Detail                                        |
| ------------------------- | --------------------------------------------- |
| Input                     | Path to `$ARTIFACTS_DIR/plan.md`              |
| Output                    | Implementation + PR                           |
| Issue decomposition       | No — consumes a plan, does not produce issues |
| Dependency handling       | N/A                                           |
| User validation gate      | No                                            |
| Issue tracker interaction | None                                          |

**Closeness to `to-issues`**: Downstream consumer, not a decomposition tool.

---

### 5. `archon-plan-to-pr`

**What it does**: Executes an existing plan through implementation, 5-agent review, and PR creation.

| Aspect                    | Detail                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Input                     | Path to `plan.md` (created by `archon-create-plan`)                                                    |
| Output                    | Merged PR                                                                                              |
| Issue decomposition       | No — plan is a flat task list, not a DAG of issues                                                     |
| Dependency handling       | No                                                                                                     |
| User validation gate      | Via `archon-confirm-plan` (verifies that referenced files still exist; it is NOT a design-review gate) |
| Issue tracker interaction | None                                                                                                   |

**Closeness to `to-issues`**: Not relevant.

---

### 6. `archon-architect`

**What it does**: Codebase health sweep — metrics, analysis, plan, simplify, validate, PR.

| Aspect                    | Detail                                |
| ------------------------- | ------------------------------------- |
| Input                     | Optional focus area                   |
| Output                    | PR with architectural simplifications |
| Issue decomposition       | No                                    |
| Dependency handling       | No                                    |
| User validation gate      | No                                    |
| Issue tracker interaction | None                                  |

**Closeness to `to-issues`**: Not relevant.

---

### 7. `archon-issue-review-full`

**What it does**: Comprehensive fix + 5-agent code review pipeline for a single GitHub issue.

| Aspect                    | Detail                                       |
| ------------------------- | -------------------------------------------- |
| Input                     | GitHub issue number / reference              |
| Output                    | PR with fixes + review report                |
| Issue decomposition       | No                                           |
| Dependency handling       | No                                           |
| User validation gate      | No                                           |
| Issue tracker interaction | Reads GitHub, creates PR — not decomposition |

**Closeness to `to-issues`**: Downstream execution, not decomposition.

---

## Sub-commands Relevant to Decomposition

### `archon-ralph-generate` (`.archon/commands/defaults/archon-ralph-generate.md`)

This is the actual decomposition engine used by `archon-ralph-dag`. Key behavior:

- **Phase 4 (Story Breakdown)** explicitly layers stories by: schema/types → backend → UI → integration → tests.
- Enforces sizing rules: each story must be completable in one AI iteration (~15-30 min).
- Produces a `dependsOn` array per story (no cycles, lower priority runs first).
- Acceptance criteria must be pass/fail verifiable, not vague.
- Writes both `prd.md` (narrative context) and `prd.json` (machine-readable story tracker) to `.archon/ralph/{slug}/`.
- Runs **fully autonomous** — no user gate.

### `archon-create-plan` (`.archon/commands/defaults/archon-create-plan.md`)

- Produces a flat `plan.md` with sequential tasks (not a DAG).
- No dependency graph; tasks are ordered by execution necessity.
- No issue tracker integration.

---

## Gap Analysis

| Requirement                                                | `archon-ralph-generate`                       | `archon-interactive-prd`   | Neither — needs custom |
| ---------------------------------------------------------- | --------------------------------------------- | -------------------------- | ---------------------- |
| Accept PRD input                                           | Yes                                           | Yes (produces PRD)         |                        |
| Vertical slice decomposition                               | Yes (layered: schema→backend→UI)              | No                         |                        |
| `blocked_by` / dependency graph                            | Yes (`dependsOn` per story)                   | No                         |                        |
| User validation gate before writing                        | **No**                                        | Yes (3-gate approval flow) |                        |
| Write to local markdown tracker (`docs/issues/<slug>/`)    | **No** (uses `.archon/ralph/{slug}/prd.json`) | **No**                     | Yes                    |
| Issues as standalone markdown files                        | **No**                                        | **No**                     | Yes                    |
| Dependency expressed as `blocked_by` in issue front-matter | **No** (uses `dependsOn` ID refs inside JSON) | **No**                     | Yes                    |

---

## Assessment: Closest Native Workflow

**`archon-ralph-generate` is the closest native analog** to `to-issues` decomposition behavior.

It provides:

- Principled vertical slicing (schema → backend → UI → integration)
- Explicit dependency DAG (`dependsOn[]` per story)
- Sizing discipline (one AI iteration per story)
- Verifiable acceptance criteria rules

It is missing:

- A user-confirmation gate before committing the breakdown
- Writing to the local markdown issue tracker (`docs/issues/<slug>/issue.md`)
- The `blocked_by` front-matter field that our issue format uses
- The 8-state triage label vocabulary (`needs-triage` → `ready-for-agent` etc.)

**`archon-interactive-prd`** provides the missing user-gate UX (3-phase `approval` nodes) but does not slice into issues at all.

---

## Recommendation

### Option A — Adapt `archon-ralph-generate` (preferred)

Adapt the decomposition logic from `archon-ralph-generate` as the core of a new `to-issues` skill:

1. **Import the layering + sizing discipline** verbatim (Phase 4 of `archon-ralph-generate`).
2. **Add one `approval` gate** (borrowed from `archon-interactive-prd`) after the AI produces the draft story list and before any files are written — letting the user review, reorder, or veto slices.
3. **Replace the output target**: instead of `.archon/ralph/{slug}/prd.json`, write one markdown file per issue to `docs/issues/<slug>/issue.md` using our issue template.
4. **Map the dependency format**: `dependsOn: ["US-002"]` → `blocked_by: [other-slug]` in the issue front-matter.
5. **Apply the triage label**: new issues get `needs-triage` by default, or `ready-for-agent` if the user confirms them during the gate.

This approach means we reuse ~70% of the decomposition logic (the hardest part to design) and only need to write:

- The user-gate node
- The output formatter (JSON story → markdown issue)
- The dependency slug resolver

### Option B — Build from scratch

Only warranted if the Archon decomposition logic is too Archon-specific (e.g., hard-coded to Bun/TypeScript projects). Reading `archon-ralph-generate`, the decomposition phases (Phases 1-4) are project-agnostic — they read `CLAUDE.md` to adapt to any codebase. So scratch-build is not justified.

### Option C — Shell out to `archon-ralph-generate`

The `to-issues` skill could invoke `archon-ralph-dag` with `--dry-run` or similar. This is not viable: `archon-ralph-dag` has no dry-run mode and immediately starts implementation. The decomposition command (`archon-ralph-generate`) is an Archon CLI internal; it is not independently invokable from a Claude Code skill.

---

## Summary Table

| Workflow                                         | Decomposition | Dependency DAG |  User Gate   |     Issue Tracker      | Verdict                                 |
| ------------------------------------------------ | :-----------: | :------------: | :----------: | :--------------------: | --------------------------------------- |
| `archon-ralph-dag` (via `archon-ralph-generate`) |      Yes      |      Yes       |      No      | `.archon/ralph/*.json` | **Best base — adapt output + add gate** |
| `archon-interactive-prd`                         |      No       |       No       | Yes (3-gate) |          None          | Good UX pattern for the gate node       |
| `archon-create-issue`                            |      No       |       No       |      No      |      GitHub only       | Not relevant                            |
| `archon-feature-development`                     |      No       |       No       |      No      |          None          | Not relevant                            |
| `archon-plan-to-pr`                              |      No       |       No       |      No      |          None          | Not relevant                            |
| `archon-architect`                               |      No       |       No       |      No      |          None          | Not relevant                            |
| `archon-issue-review-full`                       |      No       |       No       |      No      |     GitHub (reads)     | Not relevant                            |

**Bottom line**: No native Archon workflow covers the full `to-issues` behavior. The right path is to adapt the decomposition logic from `archon-ralph-generate` (layered slicing + `dependsOn` DAG), bolt on a single user-approval gate from `archon-interactive-prd`'s pattern, and replace the `.archon/ralph/` output with our local markdown issue format. A custom workflow is required, but it is not a ground-up build — roughly two-thirds of the design already exists in Archon.
