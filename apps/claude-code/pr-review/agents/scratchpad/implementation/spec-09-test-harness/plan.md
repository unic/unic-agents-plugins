# Plan — spec-09: Test harness

1. **Step 1 — Create the four re-review modules**

   - Create `scripts/re-review/` directory
   - Author `parse-signature.mjs`, `classify-thread.mjs`, `match-finding.mjs`, `detect-prior-review.mjs`
   - Each exports a single pure function; no I/O beyond what the spec describes
   - Demo: `node scripts/re-review/parse-signature.mjs` runs without error

2. **Step 2 — Author fixture JSON files**

   - Create `tests/fixtures/` directory
   - Author all 11 fixture JSON files per the spec's scenario table
   - Fixtures use ADO `pullRequestThreads` response shape (`threadContext`, `comments`, `status`, `id`)
   - Demo: `cat tests/fixtures/threads-pending.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); JSON.parse(d)"` passes

3. **Step 3 — Write test files + update package.json + verify green**

   - Add `"test"` script to `package.json`
   - Write all 4 test files using `node:test` + `node:assert/strict`
   - Cover all representative test cases from the spec
   - Demo: `pnpm --filter pr-review test` — all tests green

4. **Step 4 — Update commands/review-pr.md to call modules via Bash**

   - Replace inline Python/jq logic in Steps 3.5, 5.5, and 10 Path B with `node scripts/re-review/<module>.mjs` calls
   - Pipe JSON in/out; keep Bash variable assignments unchanged
   - Demo: `pnpm -w check` passes

5. **Step 5 — Finalize (verify, mark spec done, commit)**
   - Run `pnpm --filter pr-review test` and `pnpm -w check`
   - Add `**Status: done — 2026-05-06**` to spec file
   - Update `docs/plans/README.md` spec-09 row → done
   - Commit: `chore(spec-09): test harness — node:test + modules`
