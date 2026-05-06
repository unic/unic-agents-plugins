# 00. Pre-flight: ADR-0007 supersession + .prettierignore CHANGELOG guard

**Status: done — 2026-05-06**

- Priority: P0 (blocks every other spec in this feature)
- Effort: XS
- Version impact: none
- Depends on: —
- Touches: monorepo `.prettierignore`, `apps/claude-code/pr-review/docs/adr/0007-summary-rewritten-not-appended.md`,
  new `apps/claude-code/pr-review/docs/adr/0009-summary-delta-as-reply.md`,
  `apps/claude-code/pr-review/docs/adr/README.md`

## Context

Specs 01–09 implement the re-review feature. Two preconditions must be in place
before any of them runs:

1. ADR 0007 records the now-reversed "rewrite summary in place" decision. Spec 07
   replies to the existing summary thread instead. Implementing 01–09 without first
   superseding 0007 leaves the repo with two contradictory decisions of record.
2. The monorepo-root `.prettierignore` does not exclude `**/CHANGELOG.md`. The
   `verify:changelog` script enforces a literal em-dash (`## [X.Y.Z] — YYYY-MM-DD`);
   any `pnpm format` run between now and spec 08 will reflow the em-dash and silently
   break the next bump.

## Current behaviour

- ADR 0007: `**Status:** Accepted (2025-04)`, decision = rewrite-in-place.
- `.prettierignore` (monorepo root): no entry for CHANGELOG files.

## Target behaviour

- ADR 0007: `**Status:** Superseded by 0009 (2026-05)`. Body untouched.
- New `apps/claude-code/pr-review/docs/adr/0009-summary-delta-as-reply.md` created with status
  `Accepted (2026-05) — Supersedes 0007`, recording:
  - **Decision:** the re-review delta is posted as a reply to the existing summary
    thread, identified via `isSummaryThread = true` (set by spec 02).
  - **Fall-back:** if the prior summary thread is missing or deleted, post a fresh
    full summary as a new thread — never attempt to edit an existing comment.
  - **Consequences:** the PR shows one summary thread with reply entries across
    iterations; edit-history of summary comments is no longer load-bearing.
- ADR README updated: 0009 row added, 0007 row marked as superseded.
- `.prettierignore` (monorepo root) gains `**/CHANGELOG.md` under a
  `# Plugin changelogs — em-dash dates must not be reflowed` comment.

## Implementation steps

1. Add the following block to the monorepo-root `.prettierignore`, after the
   existing sections:

   ```
   # Plugin changelogs — em-dash dates must not be reflowed
   **/CHANGELOG.md
   ```

2. Create `apps/claude-code/pr-review/docs/adr/0009-summary-delta-as-reply.md`
   using the ADR format. Key fields:
   - **Status:** `Accepted (2026-05) — Supersedes 0007`
   - **Context:** references ADR 0007; explains that the grilling session (2026-05)
     reversed the "rewrite-in-place" decision in favour of a reply model.
   - **Decision:** reply-to-existing-summary-thread + fall-back to new full summary
     thread when the prior thread is missing (never edit).
   - **Consequences:** as above.

3. Edit `apps/claude-code/pr-review/docs/adr/0007-summary-rewritten-not-appended.md`:
   change **only the Status line** from `Accepted (2025-04)` to
   `Superseded by 0009 (2026-05)`. Leave Context, Decision, and Consequences
   verbatim.

4. Update `apps/claude-code/pr-review/docs/adr/README.md`: add the 0009 entry and
   note 0007 as superseded.

## Verification

- `grep -F '**/CHANGELOG.md' .prettierignore` returns the new line.
- `pnpm format` is a no-op on any `CHANGELOG.md`; `pnpm --filter pr-review verify:changelog` passes.
- First line group of `apps/claude-code/pr-review/docs/adr/0007-…md` shows
  `**Status:** Superseded by 0009 (2026-05)`.
- `apps/claude-code/pr-review/docs/adr/0009-summary-delta-as-reply.md` exists and
  references ADR 0007.
- `apps/claude-code/pr-review/docs/adr/README.md` lists 0009.

## Acceptance criteria

- All four changes land in a single conventional commit:
  `docs(pr-review): supersede ADR 0007 with 0009; guard CHANGELOGs from prettier`
- No plugin version bump, no CHANGELOG entry (docs/policy only).
- Specs 01–09 unblocked.

## Out of scope

- Any code change to `commands/review-pr.md` (specs 01–09 own that).
- The `Re-review` README/CLAUDE.md updates (spec 08 owns those).

## Follow-ups

— none —
