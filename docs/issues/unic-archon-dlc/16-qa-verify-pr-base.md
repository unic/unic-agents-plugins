# QA workflow: add verify-pr-base guard after merge-pr

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

`qa.yaml` currently calls `merge-pr` (which runs the configured tracker's merge CLI command) but does not verify the PR targets the correct base branch first. If the PR was opened against the wrong target — e.g. `main` instead of `develop` on a Gitflow project — the merge silently ships to the wrong branch.

Add a `verify-pr-base` bash node that runs before `merge-pr`:

1. Reads the configured branching strategy from `.archon/unic-dlc.config.json`.
2. Derives the expected base branch (`develop` for Gitflow, `main` for GitHub Flow).
3. For GitHub tracker: calls `gh pr view --json baseRefName` and compares.
4. For ADO tracker: calls `az repos pr show` and compares `targetRefName`.
5. For Jira / local: logs a warning and continues (no CLI to query PR base).
6. If the base is wrong: logs a clear error with the expected vs actual branch names and exits non-zero, preventing `merge-pr` from running.

This is a YAML-only addition of one `bash` node with an inline shell snippet — no lib modules or tests are added.

## Acceptance criteria

- [ ] `qa.yaml` has a `verify-pr-base` bash node with `depends_on: [uat-gate]`.
- [ ] `merge-pr` has `depends_on: [verify-pr-base]`.
- [ ] For GitHub and ADO trackers, the node exits non-zero with a clear message if the PR base does not match the expected branch.
- [ ] For Jira and local trackers, the node logs a warning and exits zero (no-op).
- [ ] `pnpm check` passes at repo root after the change.

## Blocked by

None — can start immediately.
