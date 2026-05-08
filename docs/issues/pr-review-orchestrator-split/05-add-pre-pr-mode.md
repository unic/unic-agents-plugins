# Add Pre-PR mode

**Status:** needs-triage
**Category:** enhancement

## Parent

`docs/issues/pr-review-orchestrator-split/PRD.md`

## What to build

Implement the Pre-PR operating mode in the orchestrator. When `/pr-review:review-pr` is invoked without a PR URL, the command:

1. Diffs the current local branch against its upstream target (e.g. `git diff origin/<default-branch>...HEAD`).
2. Reads key changed files (same skip-list as today: generated files, serialization YAMLs, etc.).
3. Launches the same `pr-review-toolkit` review aspect agents as the ADO modes, passing the local diff and file contents. Doc Context is skipped (no work items or Confluence pages to fetch without a PR).
4. Aggregates findings and presents them in the Claude interface as a structured list (severity, file, line, title, body) — no ADO calls are made.
5. Prints a clear completion message when done.

No ADO credentials are required and no ADO calls are made in this mode. The pre-PR Review uses the same review aspect agent selection logic as ADO modes (aspect filter from `$ARGUMENTS` applies).

## Acceptance criteria

- [ ] Running the command without a URL enters Pre-PR mode with a console message confirming the mode
- [ ] The diff used is the local branch diff against its upstream target
- [ ] Review aspect agents receive the local diff and changed file contents
- [ ] Findings are presented in the Claude interface with severity, file path, line range, title, and body
- [ ] No ADO API calls are made in this mode
- [ ] The aspect filter argument (e.g. `code`, `errors`, `all`) is respected in pre-PR mode
- [ ] `pnpm test` passes; `pnpm format` produces no diff

## Blocked by

- `docs/issues/pr-review-orchestrator-split/04-refactor-orchestrator.md`
