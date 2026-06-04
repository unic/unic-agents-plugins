---
title: First-review computes a real line-level diff without a local branch checkout
created: 2026-06-04
---

# PRD: First-review computes a real line-level diff without a local branch checkout

**Status:** ready-for-agent
**Category:** feature
**Scope:** unic-pr-review
**GitHub:** [#196](https://github.com/unic/unic-agents-plugins/issues/196)

---

## Problem Statement

As a Unic Reviewer, I run `/unic-pr-review:review-pr <PR-URL>` against an open Azure DevOps Pull Request and expect a real line-level Review. Today I get a "diff unavailable" Notice instead. The ADO Fetcher's Step 6 unconditionally sets `rawDiff = ""` and `diffUnavailable = true` for `first-review` (and `first-review-fallback`) Mode, so the diff-unavailable guard in the orchestrator suppresses every Review Aspect agent and the Intent Assessor. The agent frontmatter even states the limitation: "Line-level diff is deferred in this preview."

The only Modes that currently produce a real line-level Review are **Pre-PR Mode** (no URL, `git diff origin/<base>...HEAD` — requires the branch checked out locally) and **Re-review Mode** (URL with a prior Bot Signature — `git diff <priorSHA> <currentSHA>` via local git). So a Reviewer cannot get a real _first_ Review of an open PR from its URL; they must check the branch out locally and run Pre-PR Mode. This is surprising and undocumented as an intended constraint.

## Solution

As a Unic Reviewer, a first Review launched from a PR URL produces a real line-level Review without my checking out the branch. The ADO Fetcher reuses Re-review's proven checkout-free mechanism: the commit SHAs a first Review needs are already in the data it fetches. Every PR iteration (Revision) carries `commonRefCommit` (the merge base) and `sourceRefCommit` (the source tip). Step 6 computes the merge-base-relative diff with `git diff <commonRefCommit> <sourceRefCommit> --unified=3` after a single `git fetch origin` — the two-dot equivalent of `base...source`, matching what Pre-PR Mode produces with `origin/<base>...HEAD`. No branch checkout is required.

Because this requires running inside a clone of the PR's repo, the Fetcher first verifies the local clone matches the PR via a remote-URL match before fetching. If no local remote matches, or the `git diff` fails, or `commonRefCommit` is absent, the Fetcher falls back to today's `diffUnavailable: true` + structural Notice (issue #176) — the Reviewer is never given a false "clean" verdict. Rationale is recorded in ADR-0012.

## User Stories

1. As a Unic Reviewer, I want `/review-pr <PR-URL>` on a fresh PR to produce a real line-level Review, so that I no longer have to check the branch out locally and run Pre-PR Mode.
2. As a Unic Reviewer, I want the first-review diff to be the merge-base-relative diff (`commonRefCommit...sourceRefCommit`), so that it shows exactly the changes the PR introduces — equivalent to Pre-PR Mode's `origin/<base>...HEAD`.
3. As a Unic Reviewer, I want the diff computed by commit SHA after `git fetch origin`, so that no branch checkout and no working-tree mutation is required.
4. As a Unic Reviewer, I want the Review Aspect agents (`code-reviewer`, `silent-failure-hunter`, etc.) and the Intent Assessor to run on a real first-review diff and emit Findings, so that I get a substantive Review rather than a "diff unavailable" Notice.
5. As a Unic Reviewer running from inside a clone of a _different_ repo than the PR's, I want the Fetcher to detect the mismatch and fall back to `diffUnavailable` rather than fetch the wrong `origin` and show me a misleading or empty diff, so that I am never given a false "clean" verdict.
6. As a Unic Reviewer running outside any clone of the PR's repo, I want the existing `diffUnavailable: true` + structural Notice preserved, so that the degraded case stays honest.
7. As a Unic Reviewer re-reviewing a force-pushed PR (`first-review-fallback`), I want the same merge-base diff computed from the latest Revision, so that a force-push that erased history still yields a real Review.
8. As a Unic Reviewer, I want a missing `commonRefCommit` to fall back to `diffUnavailable` rather than the Fetcher improvising a base, so that I never see a diff computed against the wrong starting point.
9. As a maintainer, I want the fiddly remote-URL comparison (https vs ssh, `.git` suffix, host casing, embedded credentials) extracted into a pure, unit-tested helper, so that the repo-match correctness guarantee lives in deterministic code rather than agent prose.
10. As a maintainer, I want `first-review` and `first-review-fallback` to share one diff-computation branch in Step 6, so that there is no duplicated diff logic to drift.
11. As a maintainer, I want the git fetch+diff sequence to mirror Re-review's Step 6 exactly (`git fetch origin` once → diff → fall back on failure), so that the change reuses a proven path with no new failure modes.
12. As a maintainer, I want the rationale (commit-SHA diff via local git over the ADO REST diff API, the in-clone requirement, the repo-match guard, the deferred REST fallback) captured in ADR-0012, so that the surprising "why must I be in a clone for a first review?" constraint is not a mystery to a future reader.
13. As a maintainer, I want the agent frontmatter `description` ("Line-level diff is deferred in this preview") corrected and the CHANGELOG updated, so that the docs no longer advertise a limitation that has been removed.

## Implementation Decisions

**Diff source and semantics (ADR-0012)**

- First Review (and `first-review-fallback`) reuses Re-review's checkout-free mechanism: `git fetch origin` + `git diff` by commit SHA. Rejected alternative, recorded in ADR-0012: the ADO REST diff API — it returns changed-line ranges, not unified hunks, so the diff would have to be synthesised from reconstructed file content (heavier, separate correctness risk). Deferred to a follow-up.
- The diff is **two-dot** `git diff <commonRefCommit> <sourceRefCommit> --unified=3`, sourced from the **latest** Revision (`revisions.value[last]`). `commonRefCommit` is trusted as ADO's merge base — so the two-dot result equals `target...source` and is reproducible without recomputing the base locally. `--unified=3` matches Re-review and the aspect agents' expectations.
- A **missing `commonRefCommit`** falls back to `diffUnavailable`; the Fetcher never substitutes the target tip or improvises a base.

**Repo-match guard (ADR-0012)**

- Before any fetch, the Fetcher resolves the expected remote from `prMetadata.repository.remoteUrl` and matches it against the local remotes. No match → `diffUnavailable: true` + the structural Notice; no fetch is attempted.
- This makes first-review **stricter** about wrong-clone detection than Re-review, which still does a blind `git fetch origin`. The consistency gap is a documented follow-up, not part of this change.

**Fetch sequence**

- Mirrors Re-review's Step 6 exactly: `git fetch origin` once → `git diff <commonRefCommit> <sourceRefCommit> --unified=3` → on git failure, set `rawDiff = ""`, `diffUnavailable = true`, add a warning. No targeted-SHA rescue and no full-vs-shallow special-casing — added only if real runs prove the merge base goes missing.

**Mode collapse**

- `first-review` and `first-review-fallback` collapse to a single Step 6 branch (`MODE !== "re-review"`) producing the merge-base diff from the latest Revision. `first-review-fallback` makes **no** attempt to delta against the vanished prior Revision — it produces the full merge-base diff like a fresh first Review. Fallback-specific Notice handling stays in the orchestrator, untouched.

**Module sketch**

- New deep module — a pure helper exporting `remotesMatch(adoRemoteUrl, localRemoteUrls) -> boolean`. Simple interface, no I/O, normalises https/ssh forms, the `.git` suffix, host casing, and embedded credentials before comparing. The ADO Fetcher invokes it by shelling to `node`, the same way Step 4a shells to `parse-prior-signature.mjs`.
- Modified — the ADO Fetcher agent: rewrite the Step 6 non-re-review branch (real diff + repo-match guard + preserved fallback), and correct the frontmatter `description` line 3.
- Unchanged — `mode-detector` (Mode selection is untouched) and `notices` (the diff-unavailable Notice still fires verbatim on genuine fallback, just less often).

**Out-of-scope, deferred**

- The ADO REST diff fallback for the no-clone / headless case is a separate follow-up issue.
- Applying the repo-match guard to Re-review (consistency) is a separate follow-up issue.

## Testing Decisions

A good test here asserts **external behaviour** — given an ADO remote URL and a set of local remote URLs, does `remotesMatch` return the right boolean? — not the internal normalisation steps. Prior art: the pure-helper unit suites in `tests/` (e.g. `base-branch-resolver.test.mjs`, `parse-prior-signature.test.mjs`, `intent-check-merger.test.mjs`), which exercise a pure function over a matrix of inputs with `node:test` + `node:assert/strict`.

- **`remotesMatch` helper** — the sole new test. Full normalisation matrix: https vs ssh forms of the same repo match; trailing `.git` is ignored; host casing is ignored; embedded credentials (`https://user:token@host/...`) are stripped before comparison; a genuinely different repo does not match; matching against multiple local remotes succeeds if any one matches; an empty local-remote list returns false.
- **The git fetch+diff procedure is not unit-tested** — it is agent prose (LLM-executed), not a JS function. It is verified by a **live first-review run** against a real ADO PR, the same way Re-review's diff was validated (issue #196 cites a live `FZAG/dxp` PR #5612 run). No existing test pins "first-review ⇒ `diffUnavailable: true`", so removing the stub breaks nothing; the `notices` and `mode-detector` suites stay green untouched.

## Out of Scope

- **ADO REST diff fallback** for the no-clone / headless / cron case — deferred to a follow-up issue. When not in a matching clone, the existing `diffUnavailable: true` + structural Notice is preserved.
- **Applying the repo-match guard to Re-review** — Re-review still fetches blindly; aligning it is a separate consistency follow-up.
- **Large-diff handling** — a first-review merge-base diff is the full PR, which on a large PR feeds a large diff to every aspect agent. This is a pre-existing property of Pre-PR Mode (ADR-0009), not introduced here; a uniform size guard across both Modes is a candidate follow-up if large-PR Reviews prove unreliable.
- **Identity resolution / `ReadExtended Users` permission handling** — a separate concern (cosmetic `displayName` fallback only; does not affect diff fetching).
- **Re-review Mode** — already produces a real diff; untouched.

## Further Notes

- Acceptance criteria are tracked in this PRD (the User Stories and Implementation/Testing Decisions above are authoritative); GitHub issue #196 is a thin pointer to this file.
- Rationale lives in [ADR-0012](../../adr/0012-checkout-free-first-review-diff.md), already written and indexed.
- Related: #148 (built the original stubbed preview), #176 (the structural "diff unavailable" signal this change makes rarely fire), #151/#152 (the re-review delta-diff mechanism this reuses), #77 (Pre-PR Mode, the local-checkout workaround this removes the need for).
- After merge, bump the plugin version (`pnpm --filter unic-pr-review bump <patch|minor>`) and add a dated CHANGELOG entry per the release flow.
