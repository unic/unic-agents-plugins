# Context — spec-09: Test harness (node:test + extracted modules)

## Source

Spec file: `docs/plans/09-test-harness.md`

## Summary

Extract the complex re-review logic from `commands/review-pr.md` into importable Node.js modules under `scripts/re-review/`. Build a `node:test` suite with JSON fixtures — no live ADO connection required.

## Version impact

**none** — test infrastructure only. No CHANGELOG update, no version bump.

## Modules to create (`scripts/re-review/`)

1. `parse-signature.mjs` — extracts iteration ID from `🤖 *Reviewed by Claude Code* — Iteration N` suffix
2. `classify-thread.mjs` — four-state classification (addressed/disputed/pending/obsolete)
3. `match-finding.mjs` — finds best-matching prior thread by file+line with ±3 drift
4. `detect-prior-review.mjs` — processes full ADO thread list, identifies bot threads

Each module: single exported function, JSON-in / JSON-out.

## Fixture files to create (`tests/fixtures/`)

11 static JSON files matching ADO `pullRequestThreads` API response format:

- `threads-fresh-pr.json`
- `threads-pending.json`
- `threads-disputed.json`
- `threads-addressed-status.json`
- `threads-addressed-diff.json`
- `threads-obsolete.json`
- `threads-partial-run.json`
- `threads-paginated-p1.json`
- `threads-paginated-p2.json`
- `diff-hunks-no-change.json`
- `diff-hunks-with-changes.json`

## Test files (`tests/`)

- `tests/parse-signature.test.mjs`
- `tests/classify-thread.test.mjs`
- `tests/match-finding.test.mjs`
- `tests/detect-prior-review.test.mjs`

## package.json script to add

```json
"test": "node --test tests/parse-signature.test.mjs tests/classify-thread.test.mjs tests/match-finding.test.mjs tests/detect-prior-review.test.mjs"
```

## Key logic extracted from commands/review-pr.md

### parse-signature logic (from Step 3.5)

Matches `Iteration ([0-9]+)` suffix in comment bodies.

### classify-thread logic (from Step 5.5 Python)

Rules in order:

1. addressed — status in {fixed, wontFix, closed, byDesign, 2,3,4,5} OR active+intersects hunk
2. obsolete — filePath non-null and not in diff (or deleted file = [0,0] hunk)
3. disputed — active, has human reply (comment without sig prefix)
4. pending — active, all comments are bot comments

### match-finding logic (from Step 10 Path B Python)

- File path equality + line range overlap with ±3 drift
- Skip summary threads

### detect-prior-review logic (from Step 3.5 jq)

- Filter threads containing sig prefix
- Tag isSummaryThread (general + starts with "## PR Review Summary", pick max threadId)
- Parse PRIOR_ITERATION_ID from "— Iteration N" suffix

## Acceptance criteria

- `pnpm --filter pr-review test` passes with zero failures
- All four modules exercised by at least one test per classification/scenario
- No test imports `az` or makes network calls

## Repo patterns

- ESM (`"type": "module"`) — use `.mjs` extension
- `node:test` + `node:assert/strict` for tests
- Tabs for indentation, no semicolons, trailing commas
- No TypeScript compilation — `// @ts-check` + JSDoc for type safety
- No external runtime deps
