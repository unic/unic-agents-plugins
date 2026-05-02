# 08. Test harness — node:test + extracted modules

**Status: pending**

- Priority: P1
- Effort: M
- Version impact: none (test infrastructure only)
- Depends on: 05
- Touches: `scripts/re-review/`, `tests/`

## Context

The re-review feature (specs 01–06) contains complex logic for thread detection, classification, and matching. Without an automated test harness, regressions can only be caught during a live review run. This spec extracts the core logic into importable Node.js modules and provides a `node:test` suite with JSON fixtures — no live ADO connection required.

All prior references to specific production PRs as test targets are replaced by named fixture scenarios. Production PRs must never be used as test dependencies.

## Modules to extract

Each module lives under `scripts/re-review/` and exposes a single exported function with a JSON-in / JSON-out contract. The `commands/review-pr.md` command calls these via Bash, piping JSON.

### `parse-signature.mjs`

```
input:  string (comment body)
output: { iterationId: number } | null
```

Extracts the iteration number from the canonical signature suffix `— Iteration N`. Returns null for legacy comments or non-bot comments.

### `classify-thread.mjs`

```
input:  { thread: PriorThread, diffHunks: DiffHunk[], signaturePrefix: string }
output: 'addressed' | 'disputed' | 'pending' | 'obsolete'
```

Applies the four-state classification rules (spec 04). Pure function — no I/O.

### `match-finding.mjs`

```
input:  { finding: Finding, priorThreads: PriorThread[], driftLines?: number }
output: PriorThread | null
```

Returns the best-matching prior thread using file path equality and line-range overlap with ±`driftLines` (default 3) tolerance. Pure function — no I/O.

### `detect-prior-review.mjs`

```
input:  { threads: RawADOThread[], signaturePrefix: string }
output: { isRereview: boolean, priorThreads: PriorThread[], summaryThread: PriorThread | null, priorIterationId: number | null }
```

Processes the full paginated thread list from ADO, identifies bot threads, tags the summary thread, parses the prior iteration ID. Does not call the ADO API — receives already-fetched thread data.

## Fixture scenarios

Fixtures live under `tests/fixtures/` as static JSON files. Each filename maps to a scenario name used in test descriptions.

| Fixture file | Scenario |
|---|---|
| `threads-fresh-pr.json` | No prior bot threads — first-time review |
| `threads-pending.json` | Bot threads present, no human replies, status active |
| `threads-disputed.json` | Bot threads with human replies |
| `threads-addressed-status.json` | Bot threads with ADO status `fixed` |
| `threads-addressed-diff.json` | Bot threads with active status; line range in diff hunk |
| `threads-obsolete.json` | Bot threads on a file not in the diff |
| `threads-partial-run.json` | Bot threads present, no completion marker for current iteration |
| `threads-paginated-p1.json` | First page (100 threads, includes continuationToken) |
| `threads-paginated-p2.json` | Second page (remaining threads, no continuationToken) |
| `diff-hunks-no-change.json` | No hunks (identical commits) |
| `diff-hunks-with-changes.json` | Hunks covering lines 40–45 in one file |

Fixture JSON shapes match the ADO `pullRequestThreads` API response format (including `threadContext`, `comments`, `status`, `id`).

## Test files

Each module has a corresponding test file under `tests/`:

- `tests/parse-signature.test.mjs`
- `tests/classify-thread.test.mjs`
- `tests/match-finding.test.mjs`
- `tests/detect-prior-review.test.mjs`

## Representative test cases

### parse-signature

- Current format `🤖 *Reviewed by Claude Code* — Iteration 3` → `{ iterationId: 3 }`.
- Legacy format `🤖 *Reviewed by Claude Code*` (no suffix) → `null`.
- Human comment with no signature → `null`.

### classify-thread

- Thread with ADO status `fixed` (no diff needed) → `addressed`.
- Thread with active status and line range intersecting a diff hunk → `addressed`.
- Thread with active status, human reply present → `disputed`.
- Thread with active status, no human replies, line not in diff → `pending`.
- Thread on a file absent from diff → `obsolete`.
- Multi-line thread (lines 10–15) with hunk at lines 12–13 → `addressed`.
- General thread (filePath null) with human reply → `disputed`.
- General thread (filePath null) with no human replies → `pending`.

### match-finding

- Finding at file A line 42 with prior thread at file A lines 42–42 → match.
- Finding at file A line 44 with prior thread at file A lines 42–42 (within ±3 drift) → match.
- Finding at file A line 50 with prior thread at file A lines 42–42 (outside drift) → no match.
- Finding at file B with prior thread at file A → no match.
- Multi-line finding at lines 10–15 with prior thread at lines 12–20 (overlapping) → match.

### detect-prior-review

- Fresh PR fixture → `isRereview=false`, `priorThreads=[]`.
- Pending threads fixture → `isRereview=true`, count matches, `isSummaryThread` set.
- Paginated fixture (p1 + p2 combined) → all threads collected.
- Partial-run fixture (no completion marker) → `isRereview=true`, downstream caller handles partial-run logic.

## Implementation steps

1. Create `scripts/re-review/` directory; add the four `.mjs` modules.
2. Create `tests/fixtures/` and author the fixture JSON files.
3. Write the four test files using `node:test` and `node:assert/strict`.
4. Add `"test": "node --test tests/**/*.test.mjs"` to `package.json` scripts (or verify it already runs via workspace `pnpm test`).
5. Update `commands/review-pr.md` to call the modules via Bash at the appropriate steps.

## Acceptance criteria

- `pnpm --filter pr-review test` passes with zero failures.
- All four modules are exercised by at least one test per classification/scenario.
- No test imports `az` or makes network calls.

## Verification

- Run `pnpm --filter pr-review test` from the monorepo root — all tests green.
- Delete one fixture file and confirm the corresponding test fails with a clear message.

## Out of scope

- End-to-end tests against a live ADO organisation.
- Testing the `commands/review-pr.md` Markdown orchestration layer directly.

## Follow-ups

— none —
