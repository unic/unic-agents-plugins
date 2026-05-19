# Plan — spec-01: Normalize Claude Code signature

## Step 1 — Implement and verify signature normalization

- **Demo:** `grep -nF '🤖 _Reviewed by Claude Code_' commands/review-pr.md` returns 0 matches; every runtime location includes `— Iteration`; Notes section has the new detection-prefix note; pnpm -w check passes; CHANGELOG updated; version bumped; `**Status: done**` added to spec; committed.
- **Wave:**
  - Implement all 4 signature changes in `commands/review-pr.md`
  - Add `SIGNATURE_PREFIX` / `SIGNATURE` constant definitions
  - Add Notes entry about detection prefix
  - Run verification greps
  - Run `pnpm -w check`
  - Bump patch version + update CHANGELOG
  - Mark spec done + commit

> This is a single atomic step because the spec is XS and all changes are in one file.
