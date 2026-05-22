# 13. Formal dry-run mode

- Priority: P1
- Effort: M
- Version impact: minor (new user-visible operating mode)
- Depends on: 12
- Touches: `commands/review-pr.md`, new `docs/adr/0017-dry-run-as-fourth-peer-mode.md`, `docs/adr/README.md`, `docs/plans/README.md`, `CHANGELOG.md`, `README.md`, `CLAUDE.md`

## Context

The 2026-05-14 dry-run captured in `docs/conversations/pr-review-dry-run-01.txt` invoked the plugin with the natural-language instruction *"Make a dry-run PR review. DO NOT POST ANY COMMENT TO THE PR! Only report inline"*. The plugin had no formal dry-run mode, so the orchestrator improvised: it inlined `az` data fetches (compounding spec 12's Step 4 bug), skipped the `pr-review:ado-fetcher` agent, and never invoked the ADO Writer. The end-user got useful findings but only by accident — the documented spec was bypassed entirely.

A formal mode replaces natural-language pleading with a documented CLI flag. The LLM-as-orchestrator no longer has to interpret "DO NOT POST"; it branches on `MODE=dry-run` and skips Writer invocation deterministically.

Dry-run is conceptually a peer of pre-PR / first-review / re-review (not an orthogonal flag), per ADR 0017: it shares pre-PR's *rendering* layer and first-review/re-review's *fetch + analyse* layer. Making it a peer mode keeps the branching uniform across the orchestrator.

## Current behaviour

- Three modes: `pre-pr` (no URL), `first-review` (URL, no prior signature), `re-review` (URL, prior signature found).
- ADO Writer is invoked in `first-review` and `re-review`.
- The Trailer reads `✅ Review posted: ...` (ADO modes) or `✅ Pre-PR review complete: ...` (pre-PR).
- There is no way to preview Writer output for an ADO PR without posting.

## Target behaviour

- A fourth mode, `dry-run`, is selected when the orchestrator's argument parsing finds a `--dry-run` flag anywhere in `$ARGUMENTS`.
- The flag does **not** suppress the `<PR URL>` argument: dry-run requires a URL. `--dry-run` with no URL is a usage error.
- Mode resolution order in Step 2:
  1. No URL → `pre-pr`.
  2. URL + `--dry-run` flag → `dry-run` (Fetcher still runs to determine whether a prior signature exists; this drives Coordinator inclusion in Step 7 but does not split dry-run into two sub-modes).
  3. URL + prior bot signature in threads → `re-review`.
  4. URL + no prior bot signature → `first-review`.
- Dry-run runs Steps 3–6 identically to first-review / re-review (preflight, metadata fetch, Fetcher, Doc Context, Review Aspects fan-out).
- In Step 7, if the Fetcher reported `IS_REREVIEW: true`, the Coordinator runs and performs Thread Classification. The Coordinator's reply-posting branch is skipped (no ADO writes). `freshFindings` is still computed and assigned to `FINDINGS_JSON`.
- The ADO Writer is **never** invoked when `MODE=dry-run`.
- Step 8 in dry-run mode prints findings using pre-PR Step E's format (severity-grouped, `[severity] /path L<start>–<end>` headers, title, body). Notices from Fetcher + Coordinator are rendered above findings via `formatNoticesAsPrePrPreamble`.
- Trailer for dry-run reads: `🔍 Dry-run complete: <N> findings (<criticals> critical, <importants> important) · <warnings> warning notices · would have posted to <PR URL>`.

## Affected files

| File | Change |
|---|---|
| `commands/review-pr.md` | Step 2: parse `--dry-run` flag from `$ARGUMENTS`; set `IS_DRY_RUN=true` before mode detection. Step 4: unchanged. Step 5: Fetcher runs in dry-run mode the same way it does for first-review / re-review. After Fetcher returns, if `IS_DRY_RUN=true` set `MODE=dry-run` (overriding the `first-review` / `re-review` value from the Fetcher's result block — but preserving `IS_REREVIEW`). Step 7: branch on `IS_DRY_RUN`; if true, run Coordinator only when `IS_REREVIEW=true` and only to compute `freshFindings`; skip Writer. Step 8: when `MODE=dry-run`, call `formatTrailer({ mode: 'dry-run', ... })` and render findings via pre-PR Step E. |
| `docs/adr/0017-dry-run-as-fourth-peer-mode.md` | New ADR — peer mode vs orthogonal flag trade-off; sibling-of-pre-PR rendering. |
| `docs/adr/README.md` | Add row 0017. |
| `docs/plans/README.md` | Add row 13. |
| `scripts/ado/notices.mjs` | Extend `formatTrailer` to accept `mode: 'dry-run'` and emit the `🔍 Dry-run complete: ...` line. Add tests in `tests/notices.test.mjs`. |
| `tests/notices.test.mjs` | New test cases for the dry-run trailer. |
| `CHANGELOG.md` | `Added` entry under `[Unreleased]`. |
| `README.md` | Document the `--dry-run` flag with one usage example. |
| `CLAUDE.md` | Note that the orchestrator must never invoke ADO Writer when `MODE=dry-run`. |

`CONTEXT.md` already documents `Dry-run mode` and the agent-invocation matrix — no edit required.

## Implementation steps

### 1. Write ADR 0017

Decision: dry-run is a fourth peer mode, not a boolean flag. Alternative considered: a `DRY_RUN` boolean orthogonal to mode (`first-review-dry-run`, `re-review-dry-run`). Rejected because re-review-dry-run still needs Coordinator output and a single mode label keeps the orchestrator's branching readable. Mode resolution honours `--dry-run` after URL parsing; `IS_REREVIEW` survives the override to drive Coordinator inclusion.

### 2. Update `formatTrailer` in `scripts/ado/notices.mjs`

Accept `mode: 'dry-run'`. Emit:

```
🔍 Dry-run complete: <N> findings (<criticals> critical, <importants> important) · <warnings> warning notices · would have posted to <PR URL>
```

Add `node:test` cases mirroring the existing first-review trailer test: empty findings, mixed severities, mixed notices.

### 3. Rewrite Step 2 in `commands/review-pr.md`

Add `--dry-run` flag parsing after URL parsing:

```bash
IS_DRY_RUN=false
if echo "$ARGUMENTS" | grep -q -- "--dry-run"; then IS_DRY_RUN=true; fi
```

If `IS_DRY_RUN=true` and no URL was found: emit usage error and stop.

### 4. Rewrite Step 5 parsing in `commands/review-pr.md`

After parsing `ADO_FETCHER_RESULT`, apply the dry-run override:

```bash
if [ "$IS_DRY_RUN" = "true" ]; then MODE=dry-run; fi
```

`IS_REREVIEW`, `PRIOR_ITERATION_ID`, `SUMMARY_THREAD_ID` are preserved exactly as the Fetcher reported them — they still drive Coordinator inclusion in Step 7.

### 5. Rewrite Step 7 in `commands/review-pr.md`

Branch on `MODE`:

- `MODE=re-review` → unchanged (Coordinator runs, Writer runs).
- `MODE=first-review` → unchanged (no Coordinator, Writer runs).
- `MODE=dry-run` →
  - If `IS_REREVIEW=true`: run Coordinator (same prompt, same result-block parsing). On `earlyExit: true`, jump to Step 8 with `FINDINGS_JSON = []`. Otherwise reassign `FINDINGS_JSON = freshFindings`.
  - Skip Writer invocation entirely.

### 6. Rewrite Step 8 in `commands/review-pr.md`

Add a branch at the top:

```
If MODE=dry-run:
  - Merge Fetcher and Coordinator notices via `mergeNotices`.
  - Print notices via `formatNoticesAsPrePrPreamble`.
  - Print findings grouped by severity using the pre-PR Step E format.
  - Call `formatTrailer({ mode: 'dry-run', findings, notices, prUrl })`.
  - Stop.
```

The existing first-review / re-review and pre-PR branches stay intact.

### 7. Update `README.md`

One usage example:

```sh
# Preview the review without posting comments
/pr-review:review-pr https://dev.azure.com/org/proj/_git/repo/pullrequest/1234 --dry-run
```

Document that dry-run on a PR with prior bot signatures runs Thread Classification but does not post Replies.

### 8. Update `CLAUDE.md`

Add a single bullet under "Command conventions": *When `MODE=dry-run`, the orchestrator MUST NOT invoke `pr-review:ado-writer` or call any ADO write endpoint. Coordinator runs in classify-only mode (no Reply posting).*

### 9. Update READMEs and CHANGELOG

- `docs/plans/README.md`: add row 13.
- `docs/adr/README.md`: add row 0017.
- `CHANGELOG.md`: under `[Unreleased]`, add `### Added` entry: *`--dry-run` flag. Runs all read-side review steps (Fetcher, Doc Context, Review Aspects, Thread Classification on re-review-eligible PRs) and renders findings to the Claude interface without posting to ADO.*

## Verification

- `/pr-review:review-pr <fresh PR URL> --dry-run` → Mode `dry-run`; Fetcher runs; review aspect agents run; Writer is not invoked; findings render in Step E format; Trailer reads `🔍 Dry-run complete: ...`.
- `/pr-review:review-pr <re-review-eligible PR URL> --dry-run` → Coordinator runs; classification output is included in the rendered Notices; no Replies posted; no thread status PATCH issued.
- `/pr-review:review-pr --dry-run` (no URL) → usage error.
- `/pr-review:review-pr <PR URL>` (no `--dry-run`) → existing behaviour unchanged.
- Confirm via instrumented test: no calls to `az devops invoke --resource pullRequestThreads` with method `PATCH`/`POST` from any agent when `MODE=dry-run`.

## Acceptance criteria

- [ ] `--dry-run` is documented in `README.md` with one example.
- [ ] Step 2 parses `--dry-run` and sets `IS_DRY_RUN`.
- [ ] Step 5 overrides `MODE=dry-run` after Fetcher returns.
- [ ] Step 7 skips Writer for `MODE=dry-run`; runs Coordinator only when `IS_REREVIEW=true`.
- [ ] Step 8 renders dry-run findings in pre-PR Step E format with the dry-run Trailer.
- [ ] `formatTrailer({ mode: 'dry-run', ... })` exists and is tested.
- [ ] ADR 0017 exists and explains peer-mode-not-flag trade-off.
- [ ] `CLAUDE.md` documents the no-write invariant.
- [ ] CHANGELOG `[Unreleased]` has an `Added` entry.

## Out of scope

- A dry-run mode for pre-PR. Pre-PR already doesn't write to ADO; dry-run is meaningless there.
- A "diff dry-run" that only renders new findings since the last review. Re-review-dry-run already covers this via the Coordinator's `freshFindings`.
- Persisting dry-run output to a file. Future enhancement, not required now.
