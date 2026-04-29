# 00. Normalize Claude Code signature

**Status: pending**

- Priority: P0 (blocks detection)
- Effort: XS
- Version impact: patch
- Depends on: —
- Touches: `commands/review-pr.md`

## Context

Re-review detection works by string-matching a stable signature in existing PR threads. The current command emits `🤖 *Reviewed by Claude Code*` in some places and `🤖 _Reviewed by Claude Code_` in others (asterisk vs underscore italics). Markdown renders both identically, but a substring match must pick a single canonical form first.

## Current behaviour

`commands/review-pr.md` writes the signature in five places (lines ~201, 245, 286, 298, 316–317). At least one location uses underscore italics; the rest use asterisks.

## Target behaviour

Every emitted signature is exactly `🤖 *Reviewed by Claude Code*` (asterisk italics, single trailing newline before any extra metadata).

## Implementation steps

1. Define the canonical signature near the top of `commands/review-pr.md` so future edits reference one constant.
2. Replace every signature occurrence with the canonical form.
3. Add a one-line note in the *Notes* section: "Signature must remain `🤖 *Reviewed by Claude Code*` verbatim — re-review detection greps for it."

## Test cases

- `grep -nF '🤖 *Reviewed by Claude Code*' commands/review-pr.md` prints ≥ 5 matches.
- `grep -nF '🤖 _Reviewed by Claude Code_' commands/review-pr.md` prints 0 matches.

## Acceptance criteria

- All emitted signatures are byte-identical.
- The Notes section documents the requirement.

## Verification

- Run both greps above.
- Read the diff: confirm only signature characters changed.

## Out of scope

- Detection logic itself (spec 01).

## Follow-ups

— none —
