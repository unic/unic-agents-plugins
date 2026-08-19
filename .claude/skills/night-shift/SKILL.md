---
name: night-shift
description: Merge a chain of issues unattended, under gates that fail closed.
argument-hint: '<issue-number> [issue-number ...]'
disable-model-invocation: true
---

# Night shift

Merge a chain of issues without a human present. This composes `/archon-rollout` and
`/archon-pr-review`; it replaces neither. What it adds is the part that has to hold when nobody is
watching: **when may this merge, and when must it stop.**

Every gate below is written to **fail closed** — not having run fails it. A gate that fails open
reports success for work it never did, and it does so most convincingly on the night nobody reads
the output. `docs/process/ai-development.md` §2 carries the three real instances this repo has
already shipped.

> **v1 — 2026-08-12.** Written from two supervised runs. Issue #347 hardens it once #345 (terminal
> issue state) and #346 (killed-run recovery) land. Their absence is why several stop conditions
> below hand back to a human rather than recovering.

Run only with explicit authorisation for the issues named in this invocation. Autonomous merge is
granted per run, for a named list, and expires with the session.

---

## Before you start

1. **State the chain and get a yes.** Numbers, order, and the boundary. A changed list is a new
   authorisation.
2. **Confirm the session can survive.** Monitors and the loop die with the session; Archon runs do
   not. If the terminal closes, runs continue and nothing drives them. Say so before starting.
3. **Open the log in a durable place** — this repository or the tracker. This protocol was once
   reconstructed from memory, and the reconstruction shipped a gate that failed open.

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

Take the chain in order and go. Nothing is audited before dispatch — `/to-tickets` settled the
criteria with a human in the session that wrote them, and re-reading them days later in a fresh
context is a worse first opinion, not a second one. The gates below run after the code exists, which
is where they earn their cost.

1. **Fast-forward `develop`** so the fork point carries the previous merge.
2. **Dispatch** via `/archon-rollout`. Always `--from develop`, always `--branch`.
3. **Verify the fork point** before anything else — the worktree HEAD must equal `develop`. Two
   things aim it there, `--from develop` and `worktree.baseBranch` in `.archon/config.yaml`. Lose
   both and Archon forks from its stored default branch, `main`.
4. **Wait.** Arm a Monitor keyed on the run ID, never on a global active count.
5. **Check the PR base.** Archon has retargeted PRs to `main` after opening them, more than once.
6. **Apply the three gates.** All three, in full, before any merge.
7. **Merge**, per `AGENTS.md`'s merge rule.
8. **Log one line**, naming the slice, the gate verdicts and the merge commit. Then the next slice.

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

**Absence fails this gate.** It was first written as "the review has returned and carries no
unresolved finding" — which fails open, because a review that never happened has no findings. On one
observed PR the review took twenty minutes, and for thirteen of those the PR showed no review _and_
an empty pending-reviewer list, indistinguishable from a silent drop.

Both commands must answer before the gate passes. Run both — the first cannot see threads, and the
second cannot see staleness.

```sh
# 1. A review newer than the head commit. Answer must be >= 1.
gh pr view <n> --json reviews,commits --jq '
  (.commits[-1].committedDate) as $head
  | [.reviews[] | select(.author.login == "copilot-pull-request-reviewer" and .submittedAt > $head)]
  | length'

# 2. Unresolved threads. Answer must be 0.
gh api graphql -f query='query($n:Int!){repository(owner:"unic",name:"unic-agents-plugins"){
  pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved}}}}}' -F n=<n> \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)] | length'
```

`0` from the first fails the gate, and it is the same answer whether the review never ran or ran
against older code — which is the point. Comparison happens inside `jq`, not the shell: `[ "$a" \> "$b" ]`
is not portable, and zsh rejects it outright.

A resolved thread means someone answered the finding. Resolving without replying passes this check
while leaving the next reader a question with no answer.

### Gate 3 — an acceptance-criteria audit in a fresh context

Spawn a subagent that reads the issue and the diff and returns a verdict per criterion, each with
`file:line` evidence. **A verdict without a citation counts as unmet.**

Fresh context is the point: the auditor has not seen the dispatch prompt, so it cannot inherit the
framing that produced the code. Require it to judge, not to comply — an audit that agrees with
everything has told you nothing.

Gates 2 and 3 look for different things and neither subsumes the other. See
`docs/process/ai-development.md` §2.

---

## Hand back

On any condition below: leave the pull request open, record the condition and its evidence, and
stop. The next slice waits. State this list at the start of the run, so the boundary is legible in
advance rather than in the morning.

- **A gate fails.**
- **A run trips the usage limit** (`session limit` in its log). External; it resumes after the reset.
- **`verify-pr-base` fails.** Archon then cascade-skips the whole review, self-fix and simplify
  pipeline, leaving an unreviewed PR that may still be CI-green. Archon cannot resume a failed run.
- **A run leaves the active list without opening a PR.** Inspect the worktree for unpushed commits
  before concluding it produced nothing — one killed run held three commits and a passing suite.
  Recovery is #346; until then this hands back.
- **The next move is a design call.** Amending an acceptance criterion is always one — a green pull
  request that faithfully implements a wrong criterion becomes the precedent the next agent reads.
- **The next move needs a credential this session lacks.** Hand back; the credential stays as it is.
- **A run is still in the active list.** Its PR waits — `archon-fix-github-issue` keeps working
  after it opens one.

Everything `AGENTS.md` forbids applies here unchanged and is not restated: branch topology, direct
pushes, `LICENSE` files, squash merges. Cutting a release is a human act.

---

## Reporting

The report is the deliverable. It is done when someone can reconstruct the night from it without
opening the transcript — every slice accounted for, whether it merged or not:

- What merged, with PR numbers.
- What handed back, at which condition, with the evidence.
- What was found that no acceptance criterion asked about. This is where a night pays for itself:
  the audit reads code against the ticket, the review reads code against itself, and what only one
  of them sees is the finding.
- What waits on a human, and the specific question being asked.

A slice that handed back is the gate working. Say so plainly and move on.

---

## Related

- `.claude/commands/archon-rollout.md` — dispatch shape, fork-point verification, clean re-run runbook
- `.claude/commands/archon-pr-review.md` — the review pass this composes
- `docs/process/ai-development.md` §2 — gates that fail open, and why the AC audit and the code review each miss what the other catches
- #345 terminal issue state · #346 killed-run recovery · #347 hardening this skill
