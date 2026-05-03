# Normalize bot signature

**Status:** ready-for-agent
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Update every signature occurrence in `commands/review-pr.md` to a single canonical form: `🤖 *Reviewed by Claude Code* — Iteration N` (asterisk italics, iteration suffix). The detection substring remains `🤖 *Reviewed by Claude Code*` (prefix match) so it stays backwards-compatible with any legacy comments already on live PRs.

Two types of locations must be updated end-to-end:
- **Runtime-emitted** locations (inside JSON payloads written to `/tmp/` in Steps 10 and 11) must emit the full `— Iteration {LATEST_ITERATION_ID}` suffix.
- **Documentation/example** locations (the summary structure markdown block) must switch from underscore to asterisk italics, using a `{N}` placeholder.

A note is added to the Notes section documenting the prefix/full-form distinction so future editors do not break detection.

## Acceptance criteria

- [ ] `grep -nF '🤖 _Reviewed by Claude Code_' commands/review-pr.md` → 0 matches
- [ ] `grep -nF '🤖 *Reviewed by Claude Code*' commands/review-pr.md` → matches at every signature location
- [ ] All runtime-emitted signatures include `— Iteration` followed by a variable reference
- [ ] Notes section documents the invariant prefix and the full emitted form

## Blocked by

None — can start immediately.
