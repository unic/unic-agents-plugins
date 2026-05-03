# 01. Normalize Claude Code signature

**Status: pending**

- Priority: P0 (blocks detection)
- Effort: XS
- Version impact: patch
- Depends on: 00
- Touches: `commands/review-pr.md`

## Context

Re-review detection works by substring-matching the canonical signature prefix in existing PR threads. The current command emits `🤖 *Reviewed by Claude Code*` in some places and `🤖 _Reviewed by Claude Code_` in others (asterisk vs underscore italics). Markdown renders both identically, but detection must pick a single canonical prefix first.

Additionally, every comment must now embed the iteration number so future re-reviews can determine which iteration each finding was raised on. The canonical form becomes `🤖 *Reviewed by Claude Code* — Iteration N` where N is the value of `LATEST_ITERATION_ID` at post time.

## Current behaviour

`commands/review-pr.md` writes the signature in multiple places. At least one location (the summary template markdown block, ~line 286) uses underscore italics; the rest use asterisks. No location includes an iteration number.

## Target behaviour

Every emitted signature is exactly `🤖 *Reviewed by Claude Code* — Iteration {N}` (asterisk italics, iteration suffix, single trailing newline before any extra metadata).

Detection logic uses the invariant prefix `🤖 *Reviewed by Claude Code*` as a substring match, so it works against both old-format comments (no iteration suffix) and new-format comments.

## Affected locations in `commands/review-pr.md`

Two distinct types of location must be updated:

1. **Runtime-emitted signatures** — inside JSON payloads written to `/tmp/pr_thread_N.json` and `/tmp/pr_summary.json` (Step 10 and Step 11). These must emit the full `— Iteration {LATEST_ITERATION_ID}` suffix.
2. **Documentation/example blocks** — the summary structure markdown example (~line 283–287) that uses underscore italics. Must be updated to asterisk form. The example may show a placeholder like `— Iteration {N}` rather than a live variable.

## Implementation steps

1. Define two constants near the top of `commands/review-pr.md`:
   - `SIGNATURE_PREFIX` = `🤖 *Reviewed by Claude Code*`
   - `SIGNATURE` = `🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}` (resolved at post time)
2. Replace every runtime-emitted signature with `SIGNATURE`.
3. Replace the underscore-italics occurrence in the documentation example with the asterisk form (using a `{N}` placeholder).
4. Add a note in the *Notes* section: "The detection prefix is `🤖 *Reviewed by Claude Code*` (substring match). The full emitted form is `🤖 *Reviewed by Claude Code* — Iteration N`. Never alter the prefix — re-review detection depends on it."

## Test cases

- `grep -nF '🤖 *Reviewed by Claude Code*' commands/review-pr.md` prints matches at every signature location.
- `grep -nF '🤖 _Reviewed by Claude Code_' commands/review-pr.md` prints 0 matches.
- All runtime-emitted signatures include `— Iteration` followed by a variable or placeholder.

## Acceptance criteria

- All runtime-emitted signatures are byte-identical in structure.
- The Notes section documents both the prefix and the full form.
- No underscore-italics signature remains anywhere in the file.

## Verification

- Run both greps above.
- Read the diff: confirm only signature characters changed and every runtime location now includes the iteration suffix.

## Out of scope

- Detection logic itself (spec 01).

## Follow-ups

— none —
