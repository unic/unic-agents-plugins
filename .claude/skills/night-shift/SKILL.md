---
name: night-shift
description: Run a chain of ready-for-agent issues unattended — dispatch, gate, merge, advance — with explicit gates and stop conditions, and a durable log.
argument-hint: '<issue-number> [issue-number ...]'
disable-model-invocation: true
---

# Night shift

Run a chain of issues to merge without a human present. This composes `/archon-rollout` and
`/archon-pr-review`; it replaces neither. What it adds is the part that has to hold when nobody is
watching: **when may this merge, and when must it stop.**

> **v1 — 2026-08-12.** Written from two supervised runs. The gates below work with what exists
> today. Issue #347 hardens it once #345 (terminal issue state) and #346 (killed-run recovery) land.
> Their absence is why several stop conditions below say "stop and leave it for a human" rather than
> "recover automatically".

**Do not run this without explicit authorisation for the specific issues in the chain.** Autonomous
merge is not a standing permission. It is granted per run, for a named list, and it does not carry
over to the next session.

---

## Before you start

1. **State the chain and get a yes.** Numbers, order, and what you will not do. If the list changes
   mid-run, that is a new authorisation.
2. **Confirm the session can survive.** Monitors and the loop die with the session; Archon runs do
   not. If the terminal closes, runs continue and nothing drives them. Say so before starting.
3. **Write the log somewhere durable.** Not a scratchpad — this repository or the tracker. The
   protocol has been reconstructed from memory once already, and the reconstruction had a defect in
   it (see the gate 2 note below).

---

## Order the chain

Serial unless you can prove otherwise. Two pull requests against one plugin collide on
`plugin.json` and `CHANGELOG.md` regardless of what else they touch, because every guarded change
bumps a version — until the Change Note work in #335 lands. Cross-plugin and repo-scoped work
parallelises today.

Before dispatching slice N+1, slice N must be **merged to `develop`**, not merely green.

Order by dependency first, then priority. A native `blocked_by` relation is the contract; prose in
an issue body is not, and the streams-page generator deliberately refuses to read it.

---

## Per slice

1. **Fast-forward `develop`** so the fork point carries the previous merge.
2. **Dispatch** via `/archon-rollout`. Always `--from develop`, always `--branch`.
3. **Verify the fork point** before anything else — the worktree HEAD must equal `develop`. Archon
   forks from `main` by default whatever the branch name says.
4. **Wait.** Arm a Monitor keyed on the run ID, never on a global active count.
5. **Check the PR base.** Archon has retargeted PRs to `main` after opening them, more than once.
6. **Apply the three gates.**
7. **Merge with a merge commit**, never a squash — the release flow reads `develop → main` merges.
8. **Log one line.** Then the next slice.

---

## The three gates

All three must pass. Any failure stops the chain — it does not skip to the next slice.

### Gate 1 — CI, read from GitHub

`gh pr checks <n>` shows every check passing and none pending.

Never the run's own report. It has claimed "all green, mergeable" while CI typecheck was red, and
has reported failure when only a transient network node failed. The workflow's exit code is
unreliable in both directions.

### Gate 2 — a review that exists, and is newer than the code

A code review **exists**, was submitted **after the current head commit**, and leaves no unresolved
thread.

**Absence is a failure.** This gate was first written as "the review has returned and carries no
unresolved finding" — which a review that never happened satisfies, because it has no findings. On
one observed PR the review took twenty minutes, and for thirteen of those the PR showed no review
_and_ an empty pending-reviewer list, indistinguishable from a silent drop.

```sh
gh pr view <n> --json reviews,headRefOid --jq \
  '[.reviews[] | select(.author.login=="copilot-pull-request-reviewer")] | length'
```

Zero fails. A review older than the head commit fails. A stale review is not evidence about the
code now on the branch.

### Gate 3 — an acceptance-criteria audit in a fresh context

Spawn a subagent that reads the issue and the diff and returns a verdict per criterion, each with
`file:line` evidence. **A verdict without a citation counts as unmet.**

Fresh context is the point: the auditor has not seen the dispatch prompt, so it cannot inherit the
framing that produced the code. Require it to judge, not to comply — an audit that agrees with
everything has told you nothing.

Gates 2 and 3 look for different things and neither subsumes the other. See
`docs/process/ai-development.md` §2.

---

## Stop conditions

Stop the chain, leave everything open, record why. Do not merge, do not dispatch the next slice.

- Any gate fails.
- A run trips the usage limit (`session limit` in its log). External; wait for reset.
- `verify-pr-base` fails — Archon then cascade-skips the entire review, self-fix and simplify
  pipeline, leaving an unreviewed PR that may still be CI-green. Archon cannot resume a failed run.
- **A run leaves the active list without opening a PR.** Check the worktree for unpushed commits
  before assuming it produced nothing — one killed run had three commits and a passing suite. Until
  #346 lands there is no automatic recovery; leave it and report.
- A decision is a design call rather than a mechanical one. Amending an acceptance criterion is
  always a design call.
- Anything requires a credential you do not have. Widening a credential is never the fix.

---

## What this must not do unattended

State these before the run so the boundary is legible in advance, not in the morning.

- **Never amend an acceptance criterion.** If the criteria are wrong, stop. A green pull request
  that faithfully implements a wrong criterion becomes the precedent the next agent reads.
- **Never merge a PR whose run is still in the active list.** `archon-fix-github-issue` keeps
  working after it opens the PR.
- **Never create, copy or delete a `LICENSE` file.**
- **Never push to `develop` or `main` directly**, and never cut a release.
- **Never widen a permission, token or ruleset** to make a gate pass.

---

## Reporting

The morning report is the deliverable. It should let someone reconstruct the night without reading
the transcript:

- What merged, with PR numbers.
- What stopped, at which gate, with the evidence.
- What was found that no criterion asked about.
- What is waiting on a human, and what specifically is being asked.

Report outcomes flat. A slice that failed is not a setback to soften — it is the gate working.

---

## Related

- `.claude/commands/archon-rollout.md` — dispatch shape, fork-point verification, clean re-run runbook
- `.claude/commands/archon-pr-review.md` — the review pass this composes
- `docs/process/ai-development.md` — why a gate that cannot fail is not a gate; reading criteria as a set
- #345 terminal issue state · #346 killed-run recovery · #347 hardening this skill
