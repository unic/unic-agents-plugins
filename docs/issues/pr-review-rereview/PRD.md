# PRD: pr-review — Incremental Re-review

**Status:** closed
**Plugin:** `apps/claude-code/pr-review`
**Specs:** `apps/claude-code/pr-review/docs/plans/00` through `08`

---

## Problem Statement

When a developer runs `/unic-pr-review:review-pr` on a PR that Claude Code has already reviewed, the command duplicates every comment thread regardless of whether the issues have since been addressed, disputed, or left pending. On a PR that has gone through two or three iteration cycles this creates dozens of duplicate bot comments, buries human discussion, wastes tokens re-analysing code that has not changed, and makes it impossible to track review progress across iterations.

## Solution

Teach the plugin to detect prior reviews before posting anything, classify each existing thread by its current state, and act on that classification instead of posting blindly. The command focuses its diff analysis on commits introduced since the last review, replies to existing threads rather than creating duplicates, and posts a compact delta summary instead of a second full-length summary. When nothing has changed since the last review, the command exits early after printing a console reminder of outstanding threads — no ADO comments are posted.

## User Stories

1. As a developer iterating on a PR, I want the plugin to detect that it already reviewed an earlier version so that I do not see duplicate comment threads on every re-run.
2. As a developer iterating on a PR, I want the plugin to focus only on commits I pushed since the last review so that the review noise is proportional to what I actually changed.
3. As a developer who fixed an issue the bot raised, I want the corresponding thread to be automatically resolved so that my PR conversation reflects the current state of the code without manual thread management.
4. As a developer who fixed an issue and left a comment in the thread saying "Fixed", I want the bot to recognise that I acted on the feedback even if I did not formally resolve the thread in Azure DevOps.
5. As a developer who pushed a new commit that touches the same lines the bot flagged, I want the bot to treat those threads as addressed even if the ADO status is still active.
6. As a developer who disagreed with a bot finding and replied to explain why, I want the bot to acknowledge my reply on re-review rather than re-asserting the same finding.
7. As a developer, I want the bot's dispute acknowledgement to remind me to mark the thread resolved in ADO when I think the conversation is done.
8. As a developer whose PR has threads for code that has since been deleted or moved out of the diff entirely, I want those threads to be left alone without a new reply cluttering the conversation.
9. As a developer, I want new findings discovered on re-review to be posted as fresh threads so that genuinely new issues are still surfaced.
10. As a developer, I want every new thread — whether from a first review or a re-review — to carry the iteration number in the bot signature so that I can tell at a glance when each finding was raised.
11. As a developer who pushed a trivial follow-up commit with no changed lines near any prior finding, I want the command to tell me "nothing new to review" and exit cleanly rather than posting empty noise.
12. As a developer, I want the console output on a no-change early exit to list the outstanding pending threads so I know what still needs attention.
13. As a developer running the plugin from the CLI, I want to see a completion marker at the end of the run so that I can confirm the review finished successfully.
14. As a code reviewer reading the PR, I want to see a single summary comment that reflects the current state of the review rather than a stack of historical summaries accumulating with each re-run.
15. As a code reviewer, I want the re-review delta summary to tell me how many issues were resolved, how many are disputed, and how many are still pending so that I can track progress at a glance.
16. As a code reviewer, I want the delta summary to only appear when something actually changed during the re-review run so that my notifications are not triggered by no-op runs.
17. As a plugin operator recovering from a crashed mid-run, I want the next run to detect the incomplete prior run and treat it as a fresh review for the current iteration rather than silently skipping unposted findings.
18. As a plugin operator, I want all bot threads to be detected regardless of how many threads a long-lived PR has accumulated so that no prior findings are missed due to API pagination limits.
19. As a plugin operator, I want the bot to work correctly regardless of which team member's PAT was used to post the original review so that re-reviews are not blocked by an identity mismatch.
20. As a plugin operator, I want the command to handle PRs with threads that span multiple lines or are anchored to a partial line selection so that multi-line findings are correctly matched across iterations.
21. As a plugin operator on a PR that was force-pushed and rebased, I want the command to fall back to a full diff review with a clear warning rather than crashing silently.
22. As a plugin operator, I want the command to work correctly when the PR has only a single iteration (a brand-new PR) so that first-time reviews are unaffected by the re-review logic.

## Implementation Decisions

### Modules

The re-review logic is extracted from `commands/review-pr.md` into four standalone Node.js modules, each with a single responsibility and a JSON stdin/stdout interface. The Markdown command remains a thin orchestrator that calls these modules via Bash.

**Prior review detector**
Fetches all comment threads for the PR, following pagination tokens until all threads are retrieved. Identifies bot threads by substring-matching the canonical signature prefix. Tags the bot-authored general thread that contains the summary structure as the summary thread. Parses the iteration number from the most recent bot comment's signature. Outputs a structured record of prior threads, each carrying a full line range (start line, start offset, end line, end offset), ADO thread status, comment list, a summary-thread flag, and the derived prior iteration ID.

**Signature parser**
Given a comment body, extracts the iteration number from the canonical signature suffix. Returns null for legacy comments that pre-date the iteration-in-signature format. Pure function, no I/O.

**Thread classifier**
Given a single prior thread and the set of diff hunks from the incremental baseline, classifies the thread into one of four states: addressed, disputed, pending, or obsolete. ADO thread status is the primary signal: a non-active status means addressed. For active threads, line-range intersection with the diff hunks is the secondary addressed signal. Human replies (any comment without the signature prefix) make a thread disputed. No file path in diff means obsolete. No human replies and no diff intersection means pending. Pure function, no I/O.

**Finding matcher**
Given a new finding (file path and line range) and the list of prior threads, returns the best-matching prior thread. Matching uses file path equality and line-range overlap with a ±3 line drift tolerance on both endpoints. Returns null if no prior thread matches.

### Canonical signature evolution

The signature format changes from `🤖 *Reviewed by Claude Code*` to `🤖 *Reviewed by Claude Code* — Iteration N`. The detection substring remains `🤖 *Reviewed by Claude Code*` so that existing pre-format comments are still recognised. Every new comment posted by the plugin — whether from a first review or a re-review — carries the iteration suffix.

### Iteration ID resolution

The latest iteration ID is fetched from the ADO iterations API. The prior iteration ID is derived by parsing the iteration number from the newest prior bot comment's signature. A timestamp-based fallback (compare iteration `createdDate` fields against the newest prior thread's timestamp) handles legacy comments that lack the iteration suffix.

### Incremental diff baseline

When a prior review is detected, the diff is scoped to commits between the prior iteration's `sourceRefCommit` and the latest iteration's `sourceRefCommit`. When both commit IDs are identical, the command exits early after printing outstanding pending threads. When the prior commit cannot be fetched (force-push / garbage collection), the command falls back to a full diff with a warning that includes both commit IDs.

### Thread classification rules

- **Addressed:** ADO thread status is not `active`, OR (status is `active` AND the thread's line range intersects a changed hunk in the incremental diff).
- **Disputed:** status is `active` AND at least one comment in the thread does not contain the signature prefix.
- **Pending:** status is `active` AND no human replies.
- **Obsolete:** the thread's file path does not appear in the PR diff at all.
- Dispute acknowledgement replies remind the author to mark the thread resolved in ADO.

### Reply vs duplicate policy

For each finding on re-review: match against prior threads using the finding matcher. If matched, act on the classification (reply for disputed/addressed/pending with new evidence; skip for pending unchanged; leave alone for obsolete). If unmatched, post a fresh thread. No reply cap — all threads receive replies in a single run.

### Summary comment policy

The existing summary thread is located by its summary-thread flag. On re-review with activity (new threads, replies, or resolutions), a reply is posted to the summary thread with a compact delta: counts of new, resolved, disputed, and pending findings, and a bullet list of new finding titles. When nothing changed, no comment is posted. The full summary is never duplicated.

### Run completion marker

The final action of every successful run is to post a reply to the summary thread containing `✅ Review complete — Iteration N (N findings posted)`. Absence of this marker for the current iteration is treated as a partial prior run; the command falls back to first-review mode for that iteration.

### ADO API resources

- Thread status changes (active → fixed): PATCH `pullRequestThreads` resource.
- Reply content: POST to `pullRequestThreadComments` resource.
- Thread status codes: 1 = active, 2 = fixed, 3 = wontFix, 4 = closed, 5 = byDesign, 6 = pending.

### Release process

Version bump uses `pnpm --filter pr-review bump minor`. CHANGELOG entries must be added to the `[Unreleased]` section before running the bump script. The monorepo `.prettierignore` must include `**/CHANGELOG.md` to prevent Prettier from reformatting the em-dash date suffixes that `verify:changelog` enforces.

## Testing Decisions

### What makes a good test

Tests assert external behaviour of each module given controlled inputs — they do not test internal branching or implementation details. Inputs are JSON fixtures representing real ADO API response shapes. Outputs are the module's return value or side effects. A test should read as a sentence: "given threads where author replied, classifier returns disputed."

### Modules under test

All four extracted modules are tested:

- **Signature parser:** round-trips for current format, null for legacy format, null for non-bot comments.
- **Thread classifier:** one test per classification state; edge cases for mixed conversation (bot then human then bot), force-pushed file, thread spanning multiple lines, partial-line offset threads.
- **Finding matcher:** exact match, range-overlap match within drift tolerance, no match, multi-line range matching.
- **Prior review detector:** fresh PR (no prior threads), single-page result, paginated result requiring continuation, summary thread tagging, partial-run detection (missing completion marker).

### Fixture files

Fixtures are static JSON files representing captured ADO API response shapes, one file per scenario. Scenarios cover: fresh PR, pending threads, disputed threads (human reply present), addressed threads (line in diff hunk), obsolete threads (file removed), paginated thread list (split across two pages), and partial-run state (no completion marker).

### Prior art

The test structure mirrors `packages/release-tools/scripts/verify-changelog.test.mjs` and `bump-version.test.mjs` — `node:test` built-in, no external dependencies, fixtures as imported JSON, assertions via `node:assert/strict`.

## Out of Scope

- GitHub PR support (separate future feature).
- Vote on PR (approve/reject) after review.
- PR description generation from diff.
- Marketplace publishing (separate manual step outside this feature).
- Graphical diff visualisation or HTML comment formats.
- Automatic retry on ADO rate-limit responses (acceptable edge case).

## Further Notes

**ADR 0007 conflict:** ADR 0007 (accepted 2025-04) states the summary comment is "edited (rewritten)" on re-review. The grilling session (2026-05-02) resolved this as "reply to the existing summary thread" after weighing rewrite vs reply. ADR 0007 should be superseded by a new ADR recording this updated decision before implementation begins.

**PR 5509:** This was a real production PR used as an informal smoke test during initial development. It must not be referenced in specs, tests, or documentation. All test scenarios must use fixture files.

**Cross-user PAT:** Detection relies on signature substring only — no `createdBy` identity check. The plugin works correctly when different team members' PATs are used across review runs.

**Legacy comments:** Comments posted before the iteration-in-signature format are still detected (prefix match). Their prior iteration ID falls back to timestamp-based lookup.
