---
name: verify-spec
description: This skill should be used when the user asks to "verify spec 15", "check acceptance criteria for spec N", "is spec 14 ready to merge", "run verify-spec on 08", "check if spec 15 is done", or invokes /verify-spec with a spec number or filename. Locates the matching spec file and checks every acceptance criterion against the current codebase.
argument-hint: "<spec-number-or-filename> (e.g. 15 or 15-release-tools-tests.md)"
user-invocable: true
---

## Purpose

Verify that all acceptance criteria in a spec file are satisfied by the current state of the codebase. Report each criterion as `✓ PASS` or `✗ FAIL` with a one-line evidence note, then summarise whether the spec is ready to be marked done.

## Argument

`$ARGUMENTS` is one of:

- A bare spec number: `15`
- A full filename: `15-release-tools-tests.md`
- A partial name: `release-tools`

## Locating the spec file

Search in order:

1. `docs/plans/` at the repo root
2. `apps/claude-code/<any-plugin>/docs/plans/`

Matching rules:

- **Bare number** (`15`, `1`): interpret as an exact numeric prefix. `15` matches `15-*` only; `1` matches `01-*` only (left-zero-pad to two digits). It does NOT substring-match `10-`, `11-`, etc.
- **Partial name** (`release-tools`): substring match against the filename.
- **Full filename** (`15-release-tools-tests.md`): exact match.

If more than one file matches, list the candidates and ask which to use. If no file matches, report that clearly and stop.

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
