# 01. `dry-run-first` end-to-end

**Status:** ready-for-agent
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`
**Type:** AFK

## Parent

`apps/claude-code/pr-review/docs/issues/pr-review-dry-run-mode/PRD.md` — [#136](https://github.com/unic/unic-agents-plugins/issues/136)

## What to build

Ship the `--dry-run` flag end-to-end for the `IS_REREVIEW=false` half of the matrix. After this slice, `/pr-review:review-pr <fresh-PR-URL> --dry-run` runs every read-side step (preflight, metadata fetch, ADO Fetcher, Doc Context Orchestrator, Review Aspect agents) but never invokes the ADO Writer, and renders the results in the Claude interface with the new `🔍 Dry-run complete: …` Trailer.

Per the PRD's Implementation Decisions, the slice cuts vertically through every layer:

- **Orchestrator argument parsing (`commands/review-pr.md`, Step 2).** Deterministic bash branch scans `$ARGUMENTS` for the literal token `--dry-run` and sets `IS_DRY_RUN=true|false`. Two lines, no new module. If `IS_DRY_RUN=true` and no URL was provided, silently fall through to Pre-PR mode (the flag is a no-op in that combination — no diagnostic). Update the `argument-hint` frontmatter to include `[--dry-run]` and the `description` to mention dry-run as a fourth supported mode.

- **Orchestrator MODE resolution (`commands/review-pr.md`, Step 5).** After parsing the Fetcher's `IS_REREVIEW`, compute the final `MODE` literal from the `IS_DRY_RUN × IS_REREVIEW` matrix. This slice covers only the `IS_REREVIEW=false` half:

  | `IS_DRY_RUN` | `IS_REREVIEW` | `MODE`          |
  | ------------ | ------------- | --------------- |
  | `false`      | `false`       | `first-review`  |
  | `true`       | `false`       | `dry-run-first` |

  (The `IS_REREVIEW=true` half lands in Slice 02.) Echo `Mode detected: $MODE` as today.

- **Orchestrator Step 7 — Writer skip.** Branch on `MODE`. For `MODE=dry-run-first`, skip the ADO Writer invocation entirely and jump to the dry-run rendering path. For `MODE=first-review`, behaviour is unchanged from today.

- **Orchestrator dry-run rendering (new sub-flow within Step 8).** For `MODE=dry-run-first`: render `formatNoticesAsPrePrPreamble(fetcherNotices)` above the findings; render findings in the existing Pre-PR Step E severity-grouped format; print the new dry-run Trailer via `formatTrailer({ mode: 'dry-run-first', findings, notices: fetcherNotices, prUrl })` where `prUrl` is built from `ORG_URL`/`PROJECT`/`PR_ID` identically to the ADO-mode trailer. No new render helpers — planned-actions block is N/A in this slice.

- **`scripts/ado/notices.mjs` — `formatTrailer` extension.** Add a branch that accepts `mode: 'dry-run-first'` and returns:

  ```
  🔍 Dry-run complete: <N> findings (<C> critical, <I> important) · <A> planned thread actions · <W> warning notices · would have posted to <PR URL>
  ```

  `<N>` counts total findings (`critical + important + minor`); the parenthetical excludes minor consistent with the existing trailer behaviour. `<A>` is always `0` in this slice (zero-able segment, rendered as `0 planned thread actions`). `<W>` is the warning-notice count. `<PR URL>` comes from `input.prUrl`. The same branch will be extended to also accept `'dry-run-rereview'` in Slice 02; in this slice, only `'dry-run-first'` is wired.

- **`tests/notices.test.mjs` — coverage for the new MODE.** Three cases at minimum: (1) `dry-run-first` with mixed findings + warnings → assert the exact trailer line; (2) `dry-run-first` with zero findings and zero notices → assert the all-zero-segment line still includes the PR URL; (3) `dry-run-first` with minor-only findings → assert minor count is excluded from the parenthetical.

- **Plugin doctrine fix (`apps/claude-code/pr-review/AGENTS.md`).** Replace the stale line:

  > **Dry-run is a fourth peer mode.** Dry-run sits alongside `review`, `re-review`, and `summary-delta` as a peer Review mode, not a flag on another mode. See [ADR-0017].

  with:

  > **Dry-run is a fourth peer operating mode.** Dry-run sits alongside `pre-pr`, `first-review`, and `re-review` as a peer mode, not a flag on another mode. Internally it resolves to one of two `MODE` literals (`dry-run-first` / `dry-run-rereview`) based on whether a prior Bot Signature is found. See [ADR-0017].

- **CHANGELOG.** Add `[Unreleased] ### Added` entry: _Dry-run mode for fresh PRs. `/pr-review:review-pr <URL> --dry-run` previews findings without posting to Azure DevOps; the new `🔍 Dry-run complete` Trailer carries findings counts and the PR URL that would have been written to._

Out of scope for this slice (lands in Slice 02): everything that depends on the Re-review Coordinator running — Coordinator `MODE` input, posting-block guards, `plannedActions` emission, planned-actions block rendering, `dry-run-rereview` trailer, earlyExit-prints-Trailer behaviour.

End-to-end demoable: `/pr-review:review-pr <fresh-PR-URL> --dry-run` produces severity-grouped findings + `🔍 Dry-run complete: …` Trailer in the Claude interface; `az devops invoke --resource pullRequestThreadComments` is never called; the PR receives no comments. `/pr-review:review-pr <fresh-PR-URL>` (no flag) behaviour is unchanged.

## Acceptance criteria

- [ ] `commands/review-pr.md` Step 2 contains a deterministic bash branch setting `IS_DRY_RUN=true|false` from `$ARGUMENTS`.
- [ ] `commands/review-pr.md` `argument-hint` frontmatter includes `[--dry-run]`.
- [ ] `commands/review-pr.md` Step 5 (or the explicit MODE resolution prose) covers all four matrix cells with `IS_DRY_RUN=true` / `IS_REREVIEW=false` → `MODE=dry-run-first`. (The `IS_REREVIEW=true` rows may be marked "see Slice 02" in this slice's PR.)
- [ ] `commands/review-pr.md` Step 7 skips the ADO Writer when `MODE=dry-run-first`.
- [ ] `commands/review-pr.md` is ≤ 200 lines (orchestrator-thin invariant from ADR 0013).
- [ ] `scripts/ado/notices.mjs` `formatTrailer` accepts `mode: 'dry-run-first'` and returns the documented `🔍 Dry-run complete: …` line including the `<A> planned thread actions` segment (always `0` here) and the PR URL.
- [ ] `tests/notices.test.mjs` covers `dry-run-first` with mixed findings + warnings, zero everything, and minor-only — all asserting exact trailer strings.
- [ ] `apps/claude-code/pr-review/AGENTS.md` doctrine line is updated to the wording above.
- [ ] `CHANGELOG.md` has a new `[Unreleased] ### Added` entry referencing dry-run mode.
- [ ] `IS_DRY_RUN=true` with no URL silently behaves as Pre-PR mode (no error, no diagnostic).
- [ ] `pnpm format`, `pnpm check`, `pnpm --filter pr-review test`, `pnpm --filter pr-review verify:changelog` all pass.
- [ ] No new `az` invocations are introduced (the `tests/fixtures/ado-cli-inventory.mjs` file is unchanged).

## Blocked by

None — can start immediately.
