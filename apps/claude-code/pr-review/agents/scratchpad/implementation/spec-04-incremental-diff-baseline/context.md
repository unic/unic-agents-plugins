# Context — spec-04: Incremental diff baseline

## Source

Spec file: `docs/plans/04-incremental-diff-baseline.md`

## Original request summary

Update Step 5 of `commands/review-pr.md` to produce an incremental diff (between prior and latest commit) instead of a full-branch diff when `IS_REREVIEW=true`. Export hunk metadata in structured JSON format to `$TMPDIR` for spec-05 consumption.

## Variables available from prior steps

- `IS_REREVIEW` — set in Step 3.5 (true/false)
- `PRIOR_COMMIT_ID` — set in Step 3.6 (may be empty string if unresolvable)
- `LATEST_COMMIT_ID` — set in Step 3.6 (may be empty string if no iterations)
- `PRIOR_THREADS_FILE` — JSON array of prior bot threads with `status`, `filePath`, `start`, `end`
- Target branch name (from Step 3 PR metadata)

## Repo patterns

- Only file touched: `commands/review-pr.md`
- No build step, no compilation, no tests to run
- Verification: manual review of shell logic + `pnpm -w check` (Biome + Prettier)
- Version impact: minor → bump after implementation

## Integration points

- **Consumed by spec-05**: diff hunk boundaries (file path, start line, end line) must be exported as a JSON array to a temp file. Variable name: `DIFF_HUNKS_FILE`
- **Consumes from spec-03**: `PRIOR_COMMIT_ID`, `LATEST_COMMIT_ID`, `PRIOR_THREADS_FILE`

## Acceptance criteria

1. First-time review behaviour unchanged (IS_REREVIEW=false path uses full-branch diff)
2. Early exit when PRIOR_COMMIT_ID == LATEST_COMMIT_ID: prints pending threads, exits before Steps 6–11
3. Fallback warnings always include both commit IDs when available
4. Diff hunk boundaries exported to `DIFF_HUNKS_FILE` (JSON array) for spec-05

## Constraints

- Only modify `commands/review-pr.md` — do not touch other files
- Do not implement spec-05 (thread classification) — only expose the DIFF_HUNKS_FILE
- No external runtime deps
