# Complete test fixture suite

**Status:** resolved
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Author the complete set of JSON fixture files and finalize the `node:test` suite so all four extracted modules are covered across all eleven fixture scenarios. Earlier issues include inline unit tests for each module's happy path; this issue completes the edge-case coverage and ensures all scenarios are represented as named fixtures.

**Fixture files to create under `tests/fixtures/`:**

| File                            | Scenario                                                        |
| ------------------------------- | --------------------------------------------------------------- |
| `threads-fresh-pr.json`         | No prior bot threads                                            |
| `threads-pending.json`          | Bot threads, active status, no human replies                    |
| `threads-disputed.json`         | Bot threads with human replies                                  |
| `threads-addressed-status.json` | Bot threads with ADO status `fixed`                             |
| `threads-addressed-diff.json`   | Bot threads, active status, line range in diff hunk             |
| `threads-obsolete.json`         | Bot threads on file not present in diff                         |
| `threads-partial-run.json`      | Bot threads present, no completion marker for current iteration |
| `threads-paginated-p1.json`     | First page (100 threads + `continuationToken`)                  |
| `threads-paginated-p2.json`     | Second page (remaining threads, no token)                       |
| `diff-hunks-no-change.json`     | Empty hunk set (identical commits)                              |
| `diff-hunks-with-changes.json`  | Hunks covering a known line range                               |

Fixture JSON shapes must match the ADO `pullRequestThreads` API response format (including `threadContext`, `comments`, `status`, `id` fields).

**Test coverage to complete or add:**

- `detect-prior-review.test.mjs`: paginated scenario (p1 + p2 combined), partial-run detection, summary thread tagging.
- `classify-thread.test.mjs`: multi-line range intersection, general thread edge cases, all ADO non-active status codes.
- `match-finding.test.mjs`: outside drift tolerance, multi-line finding vs single-line thread, no-match cases.
- `parse-signature.test.mjs`: iteration number boundary values, malformed suffix.

No test may import `az` or make any network calls.

## Acceptance criteria

- [ ] All 11 fixture files present under `tests/fixtures/`
- [ ] `pnpm --filter pr-review test` passes with zero failures
- [ ] Every fixture scenario exercised by at least one test assertion
- [ ] Deleting any single fixture file causes at least one test to fail with a clear message

## Blocked by

- `docs/issues/pr-review-rereview/02-detect-prior-review.md`
- `docs/issues/pr-review-rereview/05-classify-existing-threads.md`
- `docs/issues/pr-review-rereview/06-reply-to-threads.md`
