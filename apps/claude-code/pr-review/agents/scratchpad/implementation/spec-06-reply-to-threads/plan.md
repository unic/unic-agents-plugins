# Plan — spec-06: Reply to threads instead of duplicating

## Step 1 — Implement reply logic in commands/review-pr.md

Demo: Step 10 branches on IS_REREVIEW, uses thread matching, executes all five classification branches, and posts the completion marker after Step 11.

Subtasks:

- Insert thread-matching logic (filePath equality + range overlap ±3 line drift) as a Python helper
- Branch Step 10: when IS_REREVIEW=false, use current flow; when IS_REREVIEW=true, run matching then dispatch by classification
- Implement five classification branches: pending-skip, pending-reply, disputed-reply, addressed-reply+PATCH, obsolete-skip
- Add partial-prior-run detection (check for completion marker absence in PRIOR_THREADS_FILE / on summary thread)
- Add completion marker POST as final action after Step 11

## Step 2 — Verify, changelog, version bump, mark spec done, commit

Demo: pnpm -w check passes, CHANGELOG entry exists, version bumped to 0.6.0, spec marked done, README updated, committed.

Subtasks:

- Run `pnpm -w check`
- Append bullet under `### Added` in CHANGELOG.md `[Unreleased]`
- Run `pnpm bump minor` (→ 0.6.0)
- Run `pnpm verify:changelog`
- Add `**Status: done — 2026-05-06**` to spec-06 file header
- Update README.md spec-06 row: pending → done
- Stage all and commit: `feat(spec-06): reply to threads instead of duplicating (v0.6.0)`
