# Detect prior review + extract parse-signature and detect-prior-review modules

**Status:** ready-for-agent
**Category:** enhancement

## Parent

`docs/issues/pr-review-rereview/PRD.md`

## What to build

Add a new Step 3.5 to `commands/review-pr.md` that fetches all PR comment threads from ADO, identifies bot-authored threads by signature prefix (no `createdBy` identity check), tags the summary thread, and parses the prior iteration ID from the newest bot comment's signature.

Two `scripts/re-review/` modules are extracted alongside the command changes so the logic is unit-testable in isolation:

**`parse-signature.mjs`** — pure function. Given a comment body string, returns `{ iterationId: number }` if the canonical signature suffix `— Iteration N` is present, or `null` for legacy/non-bot comments.

**`detect-prior-review.mjs`** — given the full array of already-fetched ADO thread objects, returns `{ isRereview, priorThreads, summaryThread, priorIterationId }`. Identifies bot threads by prefix match. Tags the summary thread (`isSummaryThread = true`) when a general thread's first comment contains the summary heading. Stores full `{start: {line, offset}, end: {line, offset}}` ranges per thread, not flat line numbers.

Pagination in the command: loop on `continuationToken` until all threads are fetched before calling `detect-prior-review.mjs`.

The command logs: `Detected N prior Claude Code threads — re-review mode ON` (or `OFF`).

Each module ships with a `node:test` test file covering its core scenarios using JSON fixtures.

## Acceptance criteria

- [ ] Step 3.5 runs unconditionally and logs the detection summary line
- [ ] All threads fetched before detection (pagination loop on `continuationToken`)
- [ ] `isSummaryThread` set on the correct general thread (or no thread if none exists)
- [ ] Thread ranges stored as `{start: {line, offset}, end: {line, offset}}`
- [ ] `parse-signature.mjs` returns `{ iterationId }` for current-format comments and `null` for legacy/non-bot
- [ ] `pnpm --filter pr-review test` passes

## Blocked by

`docs/issues/pr-review-rereview/01-normalize-bot-signature.md`
