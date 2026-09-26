---
name: afk-loop
description: Work every ready-for-agent child of a stream, map or parent ticket through to merge, unattended, with native Claude Code loops and subagents.
argument-hint: '<parent-issue> [instructions for this run]'
disable-model-invocation: true
---

# AFK loop

Run it under `/loop` with no interval, so the loop paces itself with `ScheduleWakeup`:

```text
/loop /afk-loop 582 merge authorised, take the p1 tickets first
/loop /afk-loop 582 dry-run
```

`$ARGUMENTS` starts with the **parent**: a stream, a `wayfinder:map` or any parent ticket, written
as `582`, `#582` or the issue URL. Use its number wherever this file says `<parent>`. The rest is
the maintainer's **instructions** for this run. They add to this file and win where the two
disagree, except on the hard rules: the NDA publish guard and everything `AGENTS.md` forbids.

This session is the **orchestrator**. It picks tickets, dispatches subagents, verifies what they
claim, and merges when the gate holds. It writes no implementation file. Workers and reviewers are
background subagents. No other session is opened. `/night-shift` is the Archon-based way to do the
same job, and this skill uses no Archon.

A turn starts from a `ScheduleWakeup` or from a subagent's completion. Each turn reads the **state
file** first, re-measures what it claims, takes the next action, and ends by § Pacing.

## State file

`.orchestration/<parent>/HANDOFF.md`, outside git because `.gitignore` excludes `.orchestration/`.
One `STATE` block, replaced whole after every change, never appended:

- the session that holds the run, and whether the run is active or stopped;
- the merge authority: granted or not, and the words of the instruction that granted it;
- the probe result;
- the current ticket, its opener's comment id, the worker's agent id, the PR and its head, the
  review round, and the time the current wait began;
- tickets merged, stopped, and follow-ups filed during this run;
- the next action.

A worker's report can be wrong and corrected minutes later. Record the correction, not only the
first claim.

## Start of a run

A run starts in any session that did not write the current `STATE` itself: no state file, a
stopped run, or a run a dead session left active. The maintainer typed the `/loop` command, so they
are present. Take the state file's facts as leads to re-measure, and take no authority from it.

1. **Merge authority** comes from this session's own instructions, and nowhere else. It is granted
   when they grant it in words, such as `merge authorised`, and it covers this run and this parent
   only. Outside a dry run, if the queue holds a ticket that ends in a PR and the instructions
   neither grant authority nor say `no merge`, say so in one message: the queue by name and link,
   the merge and cleanup that authority would allow, and § Stop conditions. Tell the maintainer to
   start again with `merge authorised` or `no merge` in the instructions. Then stop.
2. **With `no merge`**, every ticket ends at the merge gate: comment the evidence on the PR and take
   the next ticket. Each worker branches from `origin/develop`, so two PRs can conflict. The
   maintainer resolves that at merge time.
3. **Resume.** If the `STATE` names a current ticket, finish it before the queue. The worker's
   agent id belonged to the dead session, so treat it as gone. Re-measure the branch, the PR and the
   review round, and spawn a new worker on the existing branch when work remains.
4. **Probe**, in under ten minutes, and record each result:
   - Load `PushNotification` with `ToolSearch`. It exists only when Remote Control is on. If it is
     missing, record that and go on: a stop then relies on the state file and the final message.
   - List the subagent types. Expect `pr-review-toolkit:code-reviewer`,
     `pr-review-toolkit:pr-test-analyzer`, `pr-review-toolkit:silent-failure-hunter` and
     `pr-review-toolkit:comment-analyzer`. They come from a user-level plugin. If they are missing,
     look for its agent files under `~/.claude/plugins/cache/*/pr-review-toolkit/*/agents/`, and
     paste each body into a `general-purpose` subagent's prompt. If neither exists, the probe fails.
   - Spawn one background `general-purpose` subagent that runs
     `git worktree add --no-track -b <probe branch> <path> origin/develop` to a path outside the
     clone, reports `git -C <path> rev-parse --show-toplevel`, and removes the worktree and the
     branch. `--no-track` needs `-b`: with `--detach` git exits 128. Pass no
     `isolation: "worktree"`, because the tool then picks the path.
   - Count the lines of the NDA term list, `$UNIC_NDA_DENYLIST` or else
     `~/.config/unic/nda-denylist.txt`, without printing them. An unreadable list fails the probe.
     An empty list is a deliberate opt-out: record it.

## Dry run

When the instructions say `dry-run`, the run writes only to its state file and the scratchpad. It
publishes nothing, claims and labels no ticket, spawns no worker or reviewer, and merges nothing.
The probe runs without its worktree step. In one pass:

1. Run § Start of a run, and report the authority the instructions would grant.
2. Read the queue, and for each ticket in order give what the run would do: the opener, drafted in
   the scratchpad, the branch name, the worker prompt filled, and the files the ticket names.
3. Write the `STATE` block a real run would hold at that point, and name the `ScheduleWakeup` delay
   it would choose.
4. Report, then stop.

## Queue

1. Fetch the parent's sub-issues in one call, with pagination, into the scratchpad:
   `gh api --paginate repos/unic/unic-agents-plugins/issues/<parent>/sub_issues > <file>`. Check
   its exit code. A failed read stops the run with its own reason, never as an empty queue.
2. For each child that is open and unassigned, fetch it with its own `gh api` call and check that
   exit code too. Keep it when `issue_dependencies_summary.blocked_by` is 0 and it carries
   `ready-for-agent`. Check the shape: a spec issue from `/to-spec` also carries `ready-for-agent`
   and is not implementable (`docs/agents/triage-labels.md`).
3. Order by priority label, `p0` first, then by the parent's sub-issue order.

Read the queue from the tracker at the start of every ticket, never from the state file or from
memory. Work one ticket at a time.

## One ticket

1. **Claim and check freshness.** Assign the ticket to yourself with `gh issue edit <n> --add-assignee @me`.
   List the open PRs that touch its files. A PR from outside this run is no blocker: record it in the
   `STATE` block and in the opener, because whichever PR merges second takes the conflict.
2. **Opener.** Write it in the shape of `docs/agents/dispatching-and-learning.md` § The shape that
   has worked. Its first line is `**Opener for #<N>**`. For an unattended run, replace the shape's
   report-back clause with this: the worker reports in its final answer, as `worker-prompt.md` step 6
   says, and stops after the handover. Leak-check it, then post it, and record its comment id and
   your login. Mark any older opener on the ticket "**Stale — do not follow**" in place.
3. **Worker.** Spawn one background `general-purpose` subagent with the filled
   [`worker-prompt.md`](worker-prompt.md). Keep its agent id and continue it with `SendMessage` for
   each fix round.
4. **Verify the handover.** A handover is valid when the PR exists, its head is on
   `origin/<branch>`, its base is `develop`, its body holds `Closes #<N>`, and § Verification
   passes. A worker that returns without a valid handover, because it crashed, named a PR that does
   not exist, or had a push refused, stops the ticket: comment the reason on it, unassign yourself,
   and stop the run.
5. **Review rounds.** In each round, spawn the four reviewers in parallel, in the background, each
   with the filled [`reviewer-prompt.md`](reviewer-prompt.md). A round is complete when all four
   return the prompt's final line. Spawn a reviewer that returns without it once more, and stop the
   run if it fails again. Round 1 always runs. Round 2 runs on the head that round 1's fixes
   produced, and only when round 1 led to a fix. Round 3 runs only when round 2 found a new Critical
   or High. Three rounds is the limit.
6. **Triage each round yourself.** Re-measure the one or two findings that matter most, against the
   current head. Then sort each finding:
   - **fix now**: anything Critical or High, anything that leaks or fails open, any false claim in a
     doc, and any CI failure. Send the full text to the worker. Reviewers report to you only, so the
     worker never reads them.
   - **another open ticket**, when that ticket owns the file or the question: comment there.
   - **follow-up ticket**: Medium and below that is not fix-now (§ Follow-up tickets).
7. **Copilot, once, last.** After the last review round is fixed, request the Copilot review.
   `docs/agents/agent-tool-traps.md` § The Copilot reviewer has the mutation and the bot id. If no
   review arrives within 30 minutes, record that and go on. Read the body whole, including
   `Suppressed comments`, and triage it as in step 6.
8. **Review the last fixes.** When commits landed after the last complete round, from a round
   whose fixes no later round read or from Copilot, spawn `pr-review-toolkit:code-reviewer` once on
   those commits alone. Triage it as in step 6. Its fixes end the reviewing.
9. **Threads.** Answer every open review thread, then resolve it: fixed, with the fixing commit;
   deferred, with the follow-up ticket's link; refuted, with the evidence. Leave a review
   workflow's own summary thread open.
10. **Merge**, when § Merge gate holds and the run has merge authority, with
    `gh pr merge <n> --merge --match-head-commit <verified head>`.
11. **After the merge.** Confirm the merge commit is on `origin/develop`. Close the ticket with
    `gh issue close <n>` and confirm its state is `CLOSED`, because a ticket that stays open keeps
    every ticket it blocks out of the queue. Move its label from `resolved` to `closed`. Remove the
    worker's worktree, local branch and remote branch after checking each is clean and an ancestor
    of `origin/develop`. Replace the `STATE` block. Take the next ticket.

## Follow-up tickets

A follow-up ticket is a finding this run defers. File it by the rules of `docs/agents/issue-tracker.md`,
`docs/agents/labels.md` and `docs/agents/triage-labels.md`:

- a sub-issue of the parent, with a native `blocked_by` on the current ticket when it depends on it;
- one type label, one area label, a priority label, and `needs-triage`;
- a body with `## Problem` and `## Acceptance criteria`;
- a triage-notes comment that starts with `> *This was generated by AI during triage.*` and records
  what you reproduced and how.

The loop leaves every follow-up at `needs-triage`. It enters the queue only when someone moves it to
`ready-for-agent`, because that label is the human's approval (`AGENTS.md` § Feature-driven
development). The instructions for a run may widen this, for example "take `p3` follow-ups without
asking", and that widening lasts for the run.

## Merge gate

All of these, on the head about to merge:

- the head is the one § Verification last checked, and the base is `develop`;
- every job `.github/workflows/ci.yml` defines at that head is present among the PR's checks, and
  every check concluded `SUCCESS`, `SKIPPED` or `NEUTRAL`. An empty or partial list is pending. Any
  other conclusion is a failure. `develop` has no branch protection, so this gate is the only CI
  guard, and `MERGEABLE` says nothing about CI;
- `mergeable` is `MERGEABLE`;
- a complete review round, or step 8, read every commit on the head;
- no finding rated Critical or High is open, from any review;
- every review thread is resolved;
- the leak check passed on the PR's added lines, every commit message with its author, the title,
  the body, and every text this run posted;
- the ticket is on `resolved`.

## Verification, every time a head moves

- `gh pr view` for the head, the base, `mergeable` and every check by name.
- The **leak check** runs on every text before this run publishes it, and on the PR at the gate.
  Save the text to a file in the scratchpad. The command that wrote it must exit 0 and the file must
  be non-empty, or the check fails. Then run the guards' own matcher:
  `node .githooks/nda-match.mjs leak-check <file> 2> <file>.err`. Exit 0 is clean. Exit 1 is a match
  or an unreadable term list: tell the two apart by the `.err` file without printing it, and report
  a match by location only. For the PR's added lines, save `gh pr diff` and pass `pre-commit` as the
  label, which drops the deleted lines. For any other text, any label but `pre-commit` works. A
  `grep` for whole words is no substitute, because the matcher also finds a term in `camelCase` and
  at other boundaries.
- Re-run the ticket's key claim yourself, from the file at the PR head (`git show` into the
  scratchpad).
- After a docs fix, grep the head for the sentence the fix removed.

## Stop conditions

To stop, call `ScheduleWakeup` with `stop: true`, send a `PushNotification` if the probe loaded it,
and write the reason in the state file. Stop when any of these happens:

- the queue is empty: post the report (§ Report) first;
- the queue read fails, the probe fails, or the NDA term list is unreadable;
- a worker returns without a valid handover, or a reviewer fails twice;
- a guard refuses a commit, and the only way on is to switch the hooks off;
- the leak check finds a match in anything published or about to be published;
- a Critical or High is still open after round 3 and its fix;
- CI fails twice in a row on the same check after a fix attempt;
- one wait outlasts its limit: 60 minutes for CI, for Copilot beyond its 30, or for `mergeable`
  to leave `UNKNOWN`, and 90 minutes for a subagent to complete;
- a merge conflict that is not a mechanical rebase;
- a finding shows that the ticket's criteria are wrong or contradict each other;
- an error that no rule in this file covers.

## Pacing

End every turn that does not stop with exactly one `ScheduleWakeup`, with `/afk-loop $ARGUMENTS`
verbatim as its prompt. `/loop` keeps the arguments only because this prompt passes them back. A
turn that ends with neither a wake-up nor a stop ends the loop without a notification.

- While a subagent works, wake after about 1200 seconds as a fallback. Its completion starts a turn
  anyway.
- While waiting on CI or Copilot, wake after about 300 seconds.
- Keep bulky output in subagents and take their conclusions. Replace the `STATE` block after each
  merge and at each stop, so a new session can resume from it. Never `/compact`.

## Report

Leak-check it, post it as a comment on the parent when the run stops, and give the maintainer a
summary. It is done when someone can reconstruct the run from it without the transcript:

- what merged, with PR numbers;
- what stopped, at which condition, with the evidence;
- for each ticket not merged, its state label and its assignee as the run leaves them;
- the follow-up tickets filed, by name and link;
- what waits on a human, and the question.

## When the ticket touches the NDA guards

The NDA guards are `.githooks/`, `.claude/hooks/block-nda-terms.mjs`, and the documents that
describe them: `AGENTS.md` § The NDA publish guard and ADR-0036. A ticket that changes them tests a
guard with a term, so:

- every ticket, test, commit message, comment and example uses a synthetic term;
- append the NDA block of [`reviewer-prompt.md`](reviewer-prompt.md) to every reviewer's prompt;
- a probe that pushes this repository's history to an empty remote is refused for every term the
  history already holds, and the NDA fixtures hold several. Make up a fresh term for each such probe,
  confirm `git log --all -S <term>` prints nothing, and check that the clean control passes.

## Traps this loop has met

- Reviewer subagents of one session share its scratchpad. Each reviewer probes in its own
  subdirectory, which `reviewer-prompt.md` names.
- In `zsh`, `set -- $var` does not split words, and a colon after a parameter can start a modifier:
  with `B=origin`, `$B:tmp` prints `originmp`. Write `"${B}:tmp"`.
