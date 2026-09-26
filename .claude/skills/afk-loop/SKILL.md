---
name: afk-loop
description: Work every ready-for-agent child of a stream, map or parent ticket through to merge, unattended, with native Claude Code loops and subagents.
argument-hint: '<parent-issue> [instructions for this run]'
disable-model-invocation: true
---

# AFK loop

Run it under `/loop` with no interval, so the loop paces itself with `ScheduleWakeup`:

```text
/loop /afk-loop 582 take the p1 tickets first
```

`$ARGUMENTS` starts with the **parent**: the issue number of a stream, a `wayfinder:map` or any
parent ticket. The rest is the maintainer's **instructions** for this run. They add to this file and
win where the two disagree, except on the hard rules: the NDA publish guard and everything
`AGENTS.md` forbids.

This session is the **orchestrator**. It picks tickets, dispatches subagents, verifies what they
claim, and merges when the gate holds. It writes no implementation file. Workers and reviewers are
background subagents. No other session is opened. `/night-shift` is the Archon-based way to do the
same job, and this skill uses no Archon.

`/loop` re-invokes this skill on every wake-up with the same arguments. Each invocation reads the
**state file** first, re-measures what it claims, then takes the next action.

## State file

`.orchestration/<parent>/HANDOFF.md`, outside git because `.gitignore` excludes `.orchestration/`.
One `STATE` block, replaced whole after every change, never appended:

- the merge authority: granted or refused, when, and the exact words;
- the probe result;
- the current ticket, the worker's agent id, the PR and its head, the review round;
- tickets merged, handed back, and follow-ups filed during this run;
- the next action.

A worker's report can be wrong and corrected minutes later. Record the correction, not only the
first claim.

## First invocation: authority and probe

The first invocation is the one with no state file, or with one whose `STATE` says an earlier run
stopped. The maintainer is present for it.

1. **Read the queue** (§ Queue) and the parent's body.
2. **Ask for merge authority** when the queue holds any ticket that ends in a PR, which is the usual
   case. In prose, one message:
   - the parent and the queue as it stands, by name and link;
   - that the queue grows only with tickets someone moves to `ready-for-agent` during the run;
   - the request: merge each PR with `gh pr merge <n> --merge` when § Merge gate holds, then remove
     its worktree, local branch and remote branch;
   - § Stop conditions, so the boundary is visible before the run.

   End the turn there, with no `ScheduleWakeup`. When the answer arrives, record it in the state
   file and continue. The authority covers this run and this parent only.
3. **Without merge authority**, each ticket ends at the merge gate. Comment the evidence on the PR,
   and take the next ticket only when it is not blocked by the unmerged one and touches none of its
   files. Otherwise stop (§ Stop conditions).
4. **Probe**, in under ten minutes, and record both results:
   - List the subagent types. Expect `pr-review-toolkit:code-reviewer`,
     `pr-review-toolkit:pr-test-analyzer`, `pr-review-toolkit:silent-failure-hunter` and
     `pr-review-toolkit:comment-analyzer`. They come from a user-level plugin, not from this
     repository. If they are missing, use `general-purpose` subagents and paste each agent file's
     body into the prompt.
   - Spawn one background `general-purpose` subagent that runs `git worktree add --no-track` to a
     path outside the clone, reports `git -C <path> rev-parse --show-toplevel`, and removes the
     worktree. Pass no `isolation: "worktree"`, because the tool then picks the path.

## Queue

The queue is the parent's sub-issues that are open, unassigned, unblocked
(`issue_dependencies_summary.blocked_by` is 0) and labelled `ready-for-agent`. `docs/agents/issue-tracker.md`
§ Wayfinding operations has the query. Check the shape too: a spec issue from `/to-spec` also
carries `ready-for-agent` and is not implementable (`docs/agents/triage-labels.md`).

Order by priority label, `p0` first, then by the parent's sub-issue order. Read the queue from the
tracker at the start of every ticket, never from the state file or from memory. Work one ticket at a
time.

## One ticket

1. **Claim and check freshness.** Assign the ticket to yourself with `gh issue edit <n> --add-assignee @me`.
   Confirm no open PR touches its files.
2. **Opener.** Write it in the shape of `docs/agents/dispatching-and-learning.md` § The shape that
   has worked, with two changes for an unattended run: the worker reports in its final answer, not
   by message, and it stops after the handover. Leak-check it (§ Verification), then post it on the
   ticket. Mark any older opener on the ticket "**Stale — do not follow**" in place.
3. **Worker.** Spawn one background `general-purpose` subagent with the filled
   [`worker-prompt.md`](worker-prompt.md). Keep its agent id and continue it with `SendMessage` for
   each fix round.
4. **Verify the handover** (§ Verification).
5. **Review rounds.** In each round, spawn the four reviewers in parallel, in the background, each
   with the filled [`reviewer-prompt.md`](reviewer-prompt.md). Rounds 1 and 2 always run, round 2
   on the head that round 1's fixes produced. Round 3 runs only when round 2 found a new Critical or
   High. Three rounds is the limit.
6. **Triage each round yourself.** Re-measure the one or two findings that matter most, against the
   current head. Then sort each finding:
   - **fix now**: anything Critical or High, anything that leaks or fails open, any false claim in a
     doc. Send the full text to the worker. Reviewers report to you only, so the worker never reads
     them.
   - **another open ticket**, when that ticket owns the file or the question: comment there.
   - **follow-up ticket**: Medium and below that is not fix-now (§ Follow-up tickets).
7. **Copilot, once, last.** After the last review round is fixed, request the Copilot review.
   `docs/agents/agent-tool-traps.md` § The Copilot reviewer has the mutation and the bot id. If no
   review arrives within 30 minutes, record that and go on. Read the body whole, including
   `Suppressed comments`, and triage it as in step 6. No review round follows it.
8. **Threads.** Answer every open review thread, then resolve it: fixed, with the fixing commit;
   deferred, with the follow-up ticket's link; refuted, with the evidence. Leave a review
   workflow's own summary thread open.
9. **Merge**, when § Merge gate holds and the run has merge authority.
10. **After the merge.** Confirm the merge commit is on `origin/develop`. Move the ticket from
    `resolved` to `closed`. Remove the worker's worktree, local branch and remote branch after
    checking each is clean and an ancestor of `origin/develop`. Replace the `STATE` block. Take the
    next ticket.

## Follow-up tickets

A follow-up ticket is a finding this run defers. File it by the rules of `docs/agents/issue-tracker.md`,
`docs/agents/labels.md` and `docs/agents/triage-labels.md`:

- a sub-issue of the parent, with a native `blocked_by` on the current ticket when it depends on it;
- one type label, one area label, a priority label, and `needs-triage`;
- a body with `## Problem` and `## Acceptance criteria`, written with the synthetic term only;
- a triage-notes comment that starts with `> *This was generated by AI during triage.*` and records
  what you reproduced and how.

The loop leaves every follow-up at `needs-triage`. It enters the queue only when someone moves it to
`ready-for-agent`, because that label is the human's approval (`AGENTS.md` § Acceptance criteria are
prose). The instructions for a run may widen this, for example "take `p3` follow-ups without asking",
and that widening lasts for the run.

## Merge gate

All of these, on the head about to merge:

- every CI check has a conclusion, and none is a failure;
- `mergeable` is `MERGEABLE`;
- no finding rated Critical or High is open, from any review;
- every review thread is resolved;
- the leak check gives 0 on the added lines, every commit message, the title, the body and every
  comment this run posted;
- the ticket is on `resolved`.

## Verification, every time a head moves

- `gh pr view` for the head, `mergeable` and every check by name. A check with no conclusion is
  pending.
- The leak check with the real term list, counts only: read the list into a temporary file and print
  `grep -c`. Print no match.
- Re-run the ticket's key claim yourself, from the file at the PR head (`git show` into the
  scratchpad).
- After a docs fix, grep the head for the sentence the fix removed.

## Stop conditions

Call `ScheduleWakeup` with `stop: true`, send a `PushNotification`, and write the reason in the state
file when any of these happens:

- the queue is empty: post the report (§ Report) first;
- the probe fails;
- a guard refuses a commit, and the only way on is to switch the hooks off;
- the leak check finds a match in anything published or about to be published;
- a Critical or High is still open after round 3 and its fix;
- CI fails twice in a row on the same check after a fix attempt;
- a merge conflict that is not a mechanical rebase;
- a finding shows that the ticket's criteria are wrong or contradict each other;
- the next move needs merge authority the run lacks.

## Pacing

On every wake-up, pass `/afk-loop $ARGUMENTS` verbatim as the `ScheduleWakeup` prompt.

- While a subagent works, wake after about 1200 seconds as a fallback. Its completion re-invokes the
  loop anyway.
- While waiting on CI or Copilot, wake after about 300 seconds.
- Keep bulky output in subagents and take their conclusions. Replace the `STATE` block after each
  merge and at each stop, so a new session can resume from it. Never `/compact`.

## Report

Post it as a comment on the parent when the run stops, and give the maintainer a summary. It is
done when someone can reconstruct the run from it without the transcript:

- what merged, with PR numbers;
- what stopped, at which condition, with the evidence;
- the follow-up tickets filed, by name and link;
- what waits on a human, and the question.

## Traps this loop has met

- Reviewer subagents of one session share its scratchpad. Each reviewer probes in its own
  subdirectory, which `reviewer-prompt.md` names.
- The repository history carries `zorblax` in the NDA test fixtures. A probe that pushes this
  repository's history to an empty remote is refused for them. Use a term absent from the history,
  such as `vorpleminx`, and check that the clean control passes.
- In `zsh`, `set -- $var` does not split words, and `$B:path` eats a leading letter. Write
  `"${B}:path"`.
