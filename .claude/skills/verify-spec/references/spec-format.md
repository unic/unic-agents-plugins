# Spec File Format Reference

Spec files live under `docs/issues/` (root or plugin-level) and follow this structure.

## File layout

### Top-level PRD (primary intake format)

```
docs/issues/<slug>/PRD.md
```

`<slug>` is a kebab-case identifier matching the GitHub Issue title. Example: `auto-format-config/PRD.md`.

### Done sub-tasks (vertical slices completed within a PRD)

```
docs/issues/<slug>/done/NN-kebab-case-title.md
```

`NN` is a zero-padded two-digit number. Example: `done/01-end-to-end-notice-pipeline.md`.

## Full template

```markdown
# NN. Title

**Status: open**

**Priority:** P0 | P1 | P2 | P3
**Effort:** XS | S | M | L | XL
**Version impact:** patch | minor | major | none
**Depends on:**
**Touches:** comma-separated list of packages/plugins affected

## Context

Background information explaining why this spec exists and what problem it solves.

## Current behaviour

What the system does today (or what is absent). Be concrete.

## Target behaviour

What the system should do after this spec is implemented. Be concrete.

## Affected files

List of files expected to be created or modified. Can be globs.

## Implementation steps

Numbered checklist of discrete implementation tasks. Each item maps to a concrete
code change. Ralph uses this list to drive implementation.

## Verification

Manual or automated steps to confirm the implementation works end-to-end. These
are broader than acceptance criteria (e.g. "run the full test suite", "open a PR
and confirm CI passes").

## Acceptance criteria

Checklist of testable, binary conditions. Each item must be independently
verifiable by reading files or running commands.

- [ ] Condition A is true
- [ ] Condition B produces output X
- [ ] File Y exists and contains Z

## Out of scope

Explicit list of things this spec intentionally does NOT cover. Helps avoid
scope creep during implementation.
```

## Field reference

**Status** — lifecycle state of the spec. The value is bold-enclosed together with the key (e.g. `**Status: open**`):

- `open` — active, not yet implemented
- `pending` — blocked on a dependency
- `done — YYYY-MM-DD` — implemented and closed; note when verifying but do not skip — the codebase may have regressed

**Priority** — urgency/importance:

- `P0` — urgent, blocks other work
- `P1` — high
- `P2` — medium
- `P3` — low (nice-to-have)

**Effort** — implementation size estimate: `XS | S | M | L | XL`

**Depends on** — prerequisite spec(s). Common forms seen in the wild:

- `none` or `—` — no dependency (em dash and the word "none" are interchangeable)
- `03` — depends on spec 03
- `03, 05` — multiple dependencies
- `spec 03 (reason prose)` — with inline explanation

**Touches** — packages or plugins affected, e.g. `` `packages/release-tools/` ``, `` `apps/claude-code/pr-review/` ``

## Verification strategy by criterion type

| Type                       | How to verify                         |
| -------------------------- | ------------------------------------- |
| File exists                | `ls <path>` or `Read`                 |
| File contains text         | `grep` or `Read` + inspect            |
| Command passes             | Run the command; non-zero exit = FAIL |
| Field present in JSON/YAML | `Read` the file; inspect the field    |
| "X should NOT exist"       | `ls` or `grep`; presence = FAIL       |
| Function/hook behaviour    | Read implementation; reason about it  |

## Notes for verification

- The canonical section heading is `## Acceptance criteria` (sentence case, plural).
  Older specs may use `## Acceptance Criteria` — treat both as equivalent.
- Items may be written as `- [ ]` checkboxes or plain `-` bullets; both are valid.
- Checked items (`- [x]`) in the spec file do not mean the criterion is satisfied —
  always verify against the codebase, not the checkbox state.
- If the spec has no `## Acceptance criteria` section, report that fact and stop.
