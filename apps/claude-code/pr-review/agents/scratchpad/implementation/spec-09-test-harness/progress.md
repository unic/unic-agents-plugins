# Progress — spec-09: Test harness

## Current Step

Step 5 — Finalize (mark spec done, commit)

## Active Wave

(none — step-04 complete)

## Verification Notes

### Step 1 — Modules created and verified

- `node scripts/re-review/parse-signature.mjs` → OK
- `node scripts/re-review/classify-thread.mjs` → OK
- `node scripts/re-review/match-finding.mjs` → OK
- `node scripts/re-review/detect-prior-review.mjs` → OK
- `pnpm -w check` → PASSES ✅

## Completed Steps

- **Step 1** — Created `scripts/re-review/` with all four `.mjs` modules. Each exports one pure function, no I/O. Biome + Prettier pass.
- **Step 2** — Authored all 11 fixture JSON files under `tests/fixtures/`. All parse cleanly via `node -e JSON.parse(...)`. `pnpm -w check` passes.
- **Step 3** — Wrote all 4 test files using `node:test` + `node:assert/strict`. Added `"test"` script to `package.json`. 25 tests pass, 0 failures. `pnpm -w check` passes.
- **Step 4** — Replaced inline python3/jq logic in `commands/review-pr.md` with `node --input-type=module` calls importing from the four modules via `file://${CLAUDE_PLUGIN_ROOT}/scripts/re-review/<module>.mjs`. Sections replaced: Step 3.5 Parse bot threads (→ `detect-prior-review.mjs`), Step 3.5 Set detection variables (→ jq on DETECT_JSON), Step 5.5 (→ `classify-thread.mjs`), Step 10 Path B partial-run check (→ node inline), Step 10 Path B thread matching (→ `match-finding.mjs`). Both `pnpm -w check` and `pnpm --filter pr-review test` pass ✅.

### Step 2 verification

- `for f in tests/fixtures/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"; done` → all 11 OK ✅
- `pnpm -w check` → PASSES ✅

### Fixture design notes

- `diff-hunks-with-changes.json` covers `/src/feature.ts` lines 40–45 and `/src/api.ts` lines 1–10
  - `threads-addressed-diff.json` thread at `/src/feature.ts:42` → intersects hunk → `addressed`
  - `threads-pending.json` thread at `/src/api.ts:42` → file in diff but line 42 not in hunk [1–10] → `pending`
  - `threads-obsolete.json` thread at `/src/legacy.ts:10` → file absent from diff → `obsolete`
- `threads-paginated-p1.json` has 5 bot threads + `continuationToken`; p2 has 3 more (including summary)
- `threads-partial-run.json` has a summary thread with no `✅ Review complete` completion marker
