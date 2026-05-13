# B1. `parse-write-response` helper + ADO Writer applies HTTP-tier mapping to all writes + `*.err` streaming

**Status:** needs-triage
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`
**Type:** AFK

## Parent

`docs/issues/pr-review-platform-failure-handling/PRD.md`

## What to build

Route every ADO write call site in the ADO Writer through one canonical helper. Apply the HTTP-tier mapping consistently. Fix the H1 retroactive auth gap and the `*.err` retention policy.

Implementation cuts through every layer:

- **New helper** `scripts/ado/parse-write-response.mjs` — pure function `({ httpExit, responseText, errStream }) → { ok: true, id } | { ok: false, tier, kind, message }`. Composes `classify-http-error` (from A2) with response-`id` parsing. Used by every ADO write call site. With unit tests covering happy path, 200/201 with valid `id`, 401, 403, 404, 409, 5xx, network exit-code, malformed JSON body, missing `id` field on 200 response.
- **ADO Writer prompt** — every `az devops invoke` POST/PATCH call site routed through the new helper:
  - inline POST (Step 1) — including the threadContext-fallback path
  - summary POST (Step 2 first-review)
  - delta reply POST (Step 2 re-review)
  - completion marker POST (Step 3)
- **Tier handling per call site:**
  - `ok: true` → record the `id`, increment counters, continue (today's H1 behaviour, now formalised through the helper).
  - `ok: false, tier: 'aborted'` (401/403) → emit stderr message ("ERROR: <message>. Try `az devops login` to re-authenticate.") and exit non-zero. The orchestrator surfaces the abort in the Trailer.
  - `ok: false, tier: 'degraded'` (5xx/network/4xx) → push a Notice (`kind: inline-post | summary-post | patch-to-fixed`-equivalent for delta/completion marker) to the Writer's `NOTICES` array, continue to next call site.
- **`*.err` retention policy** — at the moment of failure, stream the contents of the per-call `*.err` file to the Writer's stderr (so the failure text is adjacent to the Notice that references it). Cleanup step at the end of the Writer is unconditional — no retention based on counts.
- **Writer result block** — `ADO_WRITER_RESULT_START/END` gains a `NOTICES: [...]` array so the orchestrator can merge Writer-emitted notices with Fetcher-emitted notices for the Summary.
- **Orchestrator** — merges the Writer's `NOTICES` into the combined array passed to subsequent rendering steps if needed; the Trailer notice counts already reflect all merged notices per A1.
- **CHANGELOG** — `[Unreleased]` Added entry for `parse-write-response.mjs`; Changed entries for the Writer call sites; Fixed entry retroactively covering the H1 inline-POST auth gap and the `*.err` streaming policy.

End-to-end demoable: invoke `/pr-review:review-pr` against a PR while the local `az devops login` token is revoked. The Claude interface ends with `❌ Review aborted: auth — <message>` after the first failing write. Restore auth, simulate a 5xx (e.g. malformed REPO_ID), and the Summary renders `## Notices` with `⚠ inline-post: Failed to post inline comment at /src/foo.ts:42 (HTTP 503).` plus the `*.err` content visible in stderr above the Notice.

## Acceptance criteria

- [ ] `scripts/ado/parse-write-response.mjs` exists with full unit-test coverage (≥ 10 cases).
- [ ] Every `az devops invoke` POST/PATCH in `.agents/ado-writer.md` routes through the new helper.
- [ ] 401 or 403 from any write call aborts the Writer with a clear stderr message; the orchestrator's Trailer line reads `❌ Review aborted: auth — ...`.
- [ ] 5xx, network, and other-4xx from any write call emits a DEGRADED Notice; the Writer continues to the next call site.
- [ ] `*.err` file content is streamed to stderr at the moment of failure; cleanup at the end is unconditional.
- [ ] `ADO_WRITER_RESULT_START/END` emits a `NOTICES` array.
- [ ] The H1 inline-POST path (from PR #29) inherits the canonical mapping — auth failures no longer log-and-continue.
- [ ] `commands/review-pr.md` is ≤ 200 lines.
- [ ] `pnpm format`, `pnpm check`, `pnpm --filter pr-review test`, `pnpm --filter pr-review verify:changelog` all pass.

## Blocked by

`docs/issues/pr-review-ado-fetcher-reliability/02-classify-http-error-and-work-items.md`
