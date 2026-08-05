---
name: verify-spec
description: This skill should be used when the user asks to "verify spec auto-format-config", "check acceptance criteria for pr-review-rereview", "is pr-review-ado-fetcher-reliability ready to merge", "run verify-spec on unic-archon-dlc", or invokes /verify-spec with an issue slug or partial name. Locates the matching PRD file in docs/issues/ and checks every acceptance criterion against the current codebase.
argument-hint: '<issue-slug-or-partial> (e.g. auto-format-config or pr-review-rereview)'
user-invocable: true
---

## Purpose

Verify that all acceptance criteria in a spec file are satisfied by the current state of the codebase. Report each criterion as `✓ PASS` or `✗ FAIL` with a one-line evidence note, then summarise whether the spec is ready to be marked done.

## Argument

`$ARGUMENTS` is one of:

- A full issue slug: `auto-format-config`
- A partial slug: `auto-format` (substring match)
- A done sub-task filename: `01-end-to-end-notice-pipeline.md`

## Locating the spec file

**Scope limit: this skill reads spec _files_ only.** Since upstream v1.1, `/to-spec` publishes the spec as a GitHub issue and writes no file, so a Feature specced that way has nothing here to verify. Say so plainly — "this Feature's spec is a GitHub issue, which this skill cannot read yet" — rather than reporting no match, which reads as a missing spec.

Spec files live in `docs/issues/` as `<slug>/PRD.md`. Completed vertical-slice sub-tasks live under `docs/issues/<slug>/done/NN-title.md`.

Search in order:

1. `docs/issues/` at the repo root — match `<slug>/PRD.md`
2. `apps/claude-code/<any-plugin>/docs/issues/` — same structure

Matching rules:

- **Full slug** (`auto-format-config`): look for `docs/issues/auto-format-config/PRD.md`.
- **Partial slug** (`auto-format`): substring match against slug directory names; list all matches and ask which to use if more than one.
- **Done sub-task filename** (`01-end-to-end-notice-pipeline.md` or bare `01`): search `done/` sub-directories under matching slugs.

If no file matches, report that clearly and stop.

## Spec file format

Spec files follow this structure — consult `references/spec-format.md` for full field definitions:

```
# NN. Title
**Status: open**
**Priority:** … **Effort:** … **Version impact:** … **Depends on:** … **Touches:** …
## Context
## Current behaviour
## Target behaviour
## Affected files
## Implementation steps
## Verification
## Acceptance criteria
## Out of scope
```

If the spec's Status is `done`, note it prominently at the top of the output, then proceed with full verification anyway — the codebase may have regressed since the spec was closed, and the purpose of this skill is to verify facts, not trust metadata.

The section to verify is **`## Acceptance criteria`**. Read every line-item under it before starting verification.

## Verifying each criterion

Run all criteria before reporting — do not stop on the first failure.

**File existence:** Use `ls` or `Read` to confirm the path exists.

**File content:** Use `Read` or `grep` to confirm text, fields, or values are present.

**CLI check:** Run the stated command (e.g. `pnpm test`, `pnpm ci:check`) and treat a non-zero exit as FAIL.

**Negative check** ("X should NOT exist"): Confirm absence with `ls` or `grep`.

**Structural check** (JSON/YAML field present): Read the file and inspect the field.

**Behavioral check** (a function/hook does X): Read the implementation and reason about it; mark PASS only when clearly satisfied.

When a criterion is ambiguous, make a best-effort determination and note the ambiguity in the evidence line.

## Output format

For each criterion, output exactly:

```
✓ PASS  <criterion text> — <one-line evidence>
✗ FAIL  <criterion text> — <one-line gap description>
```

Then a summary block:

```
## Summary
Passed: N / Total: M

[Ready / NOT ready] to mark done.

Remaining gaps:
- <FAIL item 1 with specific gap>
- <FAIL item 2 with specific gap>
```

Only include "Remaining gaps" if there are failures. Do not mark the spec done if any criterion fails.

## Additional resources

- **`references/spec-format.md`** — annotated spec template with field definitions
