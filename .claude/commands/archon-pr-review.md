---
description: Dispatch archon-comprehensive-pr-review for one or more open PRs, with intent from the linked issue, Gitflow guardrails and a deduped monitor.
argument-hint: <pr-number> [pr-number ...]
allowed-tools: Bash(gh *), Bash(git *), Bash(archon *), Task, Write
---

# /archon-pr-review

Review the open pull request(s) in `$ARGUMENTS` by dispatching `archon-comprehensive-pr-review` per PR. The workflow runs five review agents in parallel (code-review, error-handling, test-coverage, comment-quality, docs-impact), synthesises the findings, auto-fixes CRITICAL/HIGH issues on the PR branch, and posts a review comment to the PR.

`$ARGUMENTS` is one or more PR numbers (space- or comma-separated). If `$ARGUMENTS` is empty, list the open PRs and ask which to review, then stop.

REPO is `unic/unic-agents-plugins` unless an argument overrides it.

This command is the review counterpart of `/archon-rollout`. Rollout dispatches implementation from an issue; this dispatches review of a PR. Do not merge the two — they take different inputs and have different post-conditions.

## What this workflow writes

Dispatching is **not** read-only. Before you run anything, know that the workflow:

- **Force-pushes the PR branch** if it is behind its base. The `sync` node runs `archon-sync-pr-with-main`, which despite its name rebases onto `$PR_BASE` read from the scope node — not literally `main`. It rebases and resolves conflicts itself, including "auto-resolving" ones it judges SIMPLE.
- **Commits and pushes fixes** for every CRITICAL/HIGH finding, in the `implement-fixes` node. The PR you review is not the PR you get back.
- **Lets the five parallel review agents push too**, before `synthesize` and `implement-fixes` ever run. Observed on PR #307: the review phase committed and pushed a fix at 20:45, mid-review, with `git -C <worktree> push origin <branch>` — and it did so from the **implementation run's** worktree, which was still on disk, not from its own. Two consequences: the head SHA can move at any point after dispatch, and you must not remove an implementation worktree while a review run against its branch is in flight.
- **Posts a `gh pr comment`** with the synthesised review, and a second one with the auto-fix report.

So a green PR can come back with new commits and a red build. That is why Step 1 records the pre-review head SHA and Step 6 re-verifies against it.

## Two markers, written by two actors

The workflow is bundled inside the Archon binary and cannot be edited here, so this command cannot make a run mark its own output. It can only **ask**. That is why there are two markers, written by two different actors, sharing no leading token: a reader matching one never matches the other.

**The run's markers.** Step 4 asks the run to open every comment it posts with one of these as its exact first line. Best-effort — a run may ignore the ask, and Step 6 records that outcome rather than papering over it:

```text
<!-- comprehensive-review-report head=<pre-review-sha> part=review -->
<!-- comprehensive-review-report head=<pre-review-sha> part=fixes -->
```

**This command's marker.** Step 6 writes it itself, as the first line of the single verification comment it posts:

```text
<!-- archon-pr-review-verification run=<run-id> head=<post-review-sha> -->
```

**The workflow posts PR comments and never a PR review.** The string `gh pr review` appears nowhere in the Archon binary; `gh pr comment` appears eight times. So a run adds nothing to `gh pr view --json reviews`, and anything reading that field cannot detect the run at all. On PR #364, where a run completed, every review on the pull request is Copilot's. Read the comments instead.

This query lists how every comment on the PR opens — one output line per comment, wide enough to carry a whole marker:

```sh
gh pr view <n> --repo unic/unic-agents-plugins --json comments --jq ".comments[] | (.body | split(\"\n\")[0])[0:100]"
```

In that output, find `archon-pr-review-verification` for this command's own comment and `comprehensive-review-report` for the run's. The width is 100 because the run's marker is 94 characters and ` part=` opens at column 79 — an 80-character slice shows the marker and hides which half of the run wrote it.

**The quoting of this filter is not verified on `cmd.exe`.** It is the one snippet in this file allowed to hold an inner string literal, and it needs one: reaching a comment's _first_ line takes `split("\n")`, jq offers no literal-free way to split on a newline, and the first line is where both markers live. No other snippet added here may hold one, and the exemption does not extend to a filter that selects on the marker string.

## Step 1 — Derive the plan from the PRs (do not ask for what you can infer)

For each PR number:

```sh
gh pr view <n> --repo unic/unic-agents-plugins --json number,title,body,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,isDraft,closingIssuesReferences
gh pr checks <n> --repo unic/unic-agents-plugins
```

From each PR derive:

- **Base branch** — must be `develop` for feature work. If it is `main`, that is Archon's known base-retarget defect: fix it first with `gh pr edit <n> --base develop`, then continue. A release PR (`develop` → `main`) legitimately targets `main`; do not "fix" that one.
- **Head SHA before review** (`headRefOid`) — record it. You compare against it in Step 6 to see what the review pushed.
- **Linked issue** — from `closingIssuesReferences`, or a `Closes #N` / `Fixes #N` line in the body. The issue's acceptance criteria are the intent contract. If there is no linked issue, say so in the plan: the review runs without an intent check, which is a weaker review.
- **Scope** — which plugin or package the diff touches (`gh pr diff <n> --name-only`). This drives the `pnpm --filter` target for re-verification.
- **CI state** — record whether the PR is green now. A PR that is already red is a poor review subject: the agents will chase build failures instead of design. Fix CI or say why you are proceeding anyway.
- **Emphasis list** — the two or three claims in the PR that are worth targeted scrutiny (an AC that is easy to fake, a cross-platform path, a security boundary). Put these in the dispatch prompt; a generic "review this" wastes the five agents.

## Step 2 — Preconditions (stop rather than guess)

Check all of these before dispatching:

```sh
gh pr view <n> --repo unic/unic-agents-plugins --json state,isDraft,mergeable -q '"state=\(.state) draft=\(.isDraft) mergeable=\(.mergeable)"'
archon workflow status            # is another run already touching this PR's branch?
```

| Condition                                | Action                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| PR is closed or merged                   | Stop. There is nothing to review.                                                                          |
| PR is a draft                            | Ask first. Draft review is legitimate but the auto-fix push may fight the author.                          |
| `mergeable: CONFLICTING`                 | Stop, unless you accept that `sync` will rebase and self-resolve conflicts. Say so explicitly in the plan. |
| Another Archon run holds the same branch | Stop. Two runs pushing one branch lose commits.                                                            |
| The PR author is a human, not Archon     | Ask first. Auto-fix commits land in someone else's PR.                                                     |

## Step 3 — Present the dispatch plan and confirm

Dispatching spawns autonomous agents, consumes significant tokens, and writes to the PR. There are two paths, and the first is the default.

**The human path is the default.** Show the plan, wait for an explicit go-ahead, then dispatch. Present, per PR: number, base, linked issue, CI state, pre-review head SHA, what the workflow may push, and the exact dispatch command. Then ask to proceed. Take this path unless the exception below applies.

**The unattended path is the exception, and one caller may take it:** an unattended run of the `night-shift` skill, which by definition has no human to ask. Every other caller takes the human path above — including an interactive session where the maintainer has merely stepped away.

A `--unattended` flag would record nothing, because an agent can always grant itself a flag. So this path asks for something a flag cannot fake: **the caller states the authorisation that covers this PR** — the date of the authorised run, and the issue numbers that run named. Step 6 copies that statement verbatim onto the `authorisation:` line of the verification comment, so the audit trail exists even where the permission was self-granted.

**A caller that reaches this path with no authorisation to state stops, and dispatches nothing.** Not a weaker authorisation, not a default, not an assumption that last night's grant still holds. Stop, and report that the unattended path was reached with no authorisation to state.

## Step 4 — Dispatch

Run each `archon workflow run` in the **background** (`run_in_background: true`) — the workflow blocks the shell.

Pass `--from develop`. Never pass `--branch`: the scope node checks out the PR head itself, and `--branch` would create an unrelated branch. Without `--from`, Archon auto-detects its worktree base and picks `main` (see Standing rules #1).

**Parallelism rule:** dispatch concurrently only for PRs on different branches. Two runs on one branch is a lost-commit race.

Dispatch command shape (fill the bracketed clauses from Step 1):

```sh
archon workflow run archon-comprehensive-pr-review --from develop \
  "Review the PR https://github.com/unic/unic-agents-plugins/pull/<n>, which implements https://github.com/unic/unic-agents-plugins/issues/<issue>. Gather the intent from issue #<issue> — its acceptance criteria are the contract. Check that the PR actually satisfies EVERY acceptance criterion, then perform a full PR review. GITFLOW: the PR base is 'develop', never 'main'. Do NOT change the PR base. Do NOT merge the PR. If a rebase is needed, rebase onto origin/develop only. Scope: <paths>. Never create or delete LICENSE files. MARKERS: open EVERY comment you post on this PR with an exact first line. For the synthesised review comment that first line is <!-- comprehensive-review-report head=<pre-review-sha> part=review --> and for the auto-fix report it is the same line with part=fixes in place of part=review. Copy the head value exactly as it appears here; do not substitute the current head, which moves during the run. ROLL CALL: in the part=review comment, print two further lines, each opening at the start of its own line. The first opens dimensions-run: and names every review dimension whose agent PRODUCED AN ARTIFACT, meaning it executed and wrote its findings, whatever those findings were. The second opens dimensions-not-run: and names every dimension that produced no artifact. A dimension that ran and found nothing produced an artifact and belongs in dimensions-run. A dimension whose agent crashed, was killed or timed out before writing produced no artifact and belongs in dimensions-not-run, as does a dimension that never executed. Write dimensions-not-run: none only when all five produced an artifact. In both lines, name a dimension by exactly one of these five spellings and by no other string: code-review, error-handling, test-coverage, comment-quality, docs-impact. No prose paraphrase, no title case, no count in place of a name. CONTEXT: CI is <green/red> on this PR head, so if you push any fix commit, re-run 'pnpm --filter <name> test', 'pnpm --filter <name> typecheck' AND 'pnpm ci:check' and wait for 'gh pr checks <n>' to be green again before reporting. Pay particular attention to: <emphasis list from Step 1>."
```

Do not write `$anything.output` in the prompt — see Standing rules #2.

`<pre-review-sha>` is the `headRefOid` Step 1 recorded. Write it into the prompt as a literal, so both of the run's comments carry the same value even though the head moves during the run.

**The marker and the roll call are an ask, not a guarantee.** The workflow is bundled in the Archon binary, so nothing here can make a run comply. A run may post its comments unmarked, or marked and silent on the roll call. Step 6 records each of those outcomes in fixed words rather than inferring a value.

**The roll call is the only published source for the per-dimension result.** What the workflow prints instead is a template constant — `**Reviewed by**: 5 specialised agents` — and its `synthesize` node fires at `trigger_rule: one_success`, so that literal `5` survives a run in which four of the five agents died. Nothing else visible to a reader of the PR names which dimensions produced an artifact. If the run ignores the ask, the fact is unavailable, not inferable — do not reconstruct it from the run's working state or its artifacts directory. That directory lives outside the repository, no reader of the PR can check it, and `archon workflow run --resume` reuses it, so an earlier attempt's files read as this attempt's.

## Step 5 — Arm the monitor

Grab the 32-char run ID (`archon workflow status`, ~5–10s after dispatch), then launch one `Monitor` (persistent), keyed on that run ID — never on a global active count.

First confirm the workspace path casing:

```sh
ls -d "$HOME/.archon/workspaces/"*/unic-agents-plugins
```

Reuse the monitor skeleton from `/archon-rollout` Step 5, with these `emit_new` patterns instead — a review run's risk is what it writes, so watch the writes:

Watch the git and PR writes against a **Bash-only view** of the log, not the whole file. Review findings quote commands like `` `git push` `` in their prose, and those Write-tool lines produce a stream of false GIT-WRITE events — this bit on the first run of this command. Filter first:

```bash
    file="$WS/logs/$rid.jsonl"
    bashonly="$STATE/bash-$n.jsonl"
    grep -F '"tool_name":"Bash"' "$file" > "$bashonly" 2>/dev/null

    emit_new "$n" "session limit[^\"]*"                                 "$file"     "LIMIT"
    emit_new "$n" "node [a-z-]+ failed[^\"]*"                           "$file"     "NODE-FAIL"
    emit_new "$n" "git (rebase|push)( --force)?[^\"]{0,50}"             "$bashonly" "GIT-WRITE"
    emit_new "$n" "gh pr (comment|review|edit|merge) [0-9]+[^\"]{0,40}" "$bashonly" "PR-WRITE"
    emit_new "$n" "(CRITICAL|HIGH): [^\"]{0,120}"                       "$file"     "FINDING"
```

Monitor signals: `LIMIT` (Claude usage cap tripped — external, re-run after reset) · `NODE-FAIL` (read the log) · `GIT-WRITE` (the head moved — expect CI to re-run; confirm with `gh pr view <n> --json headRefOid`) · `PR-WRITE` (a `gh pr merge` here is a bug, investigate immediately; a `gh pr edit --base` means the base moved) · `FINDING` (a CRITICAL/HIGH the auto-fix node will try to fix) · `[done]` (run left the active list).

## Step 6 — Verify what the review did, and post the verification comment

When the run leaves the active list, do not trust its summary. Read the PR itself:

```sh
gh pr view <n> --repo unic/unic-agents-plugins --json baseRefName,headRefOid,mergeable,mergeStateStatus,commits
gh pr checks <n> --repo unic/unic-agents-plugins
git log --oneline <pre-review-sha>..<new-head-sha>      # what the review pushed
gh pr view <n> --repo unic/unic-agents-plugins --json comments --jq ".comments[] | (.body | split(\"\n\")[0])[0:100]"
```

### Select this run's two comments by their marker

Never by heading text, author or recency. A comment is this run's when its **first line** is a `comprehensive-review-report` marker whose `head=` equals the SHA Step 1 recorded and whose `part=` names the comment being read. Find them in the listing above, then open each one. Do not filter on the marker string inside a `--jq` expression.

Heading text cannot do this job. `# 🔍 Comprehensive PR Review` spans 40 pull requests in this repository and only five ever carried an `archon-comprehensive-pr-review` run; PR #307 carries that heading twice, from two different workflows; and the fix report's heading reads `## Fixes Applied` on four PRs and `## Fixes applied` on the fifth. Copying rows verbatim off a marked comment makes both irrelevant.

Where the marker does not deliver, the field takes one of these values, in these words and no others:

| What you found                                                                    | The field reads                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------ |
| no comment matches a `part=`                                                      | `not published by the run`                       |
| more than one comment matches a `part=`                                           | `ambiguous (<count> comments)`, and select none  |
| a matching `part=review` comment that omits the roll-call lines                   | `roll-call lines absent from the marked comment` |
| a matching comment carrying no severity table at all                              | `no severity table in the marked comment`        |
| a matching comment whose severity table carries neither a CRITICAL nor a HIGH row | `no CRITICAL or HIGH row in the marked comment`  |

Never write `unknown`, `0` or `none` in place of a missing source. `none` is a value the run may publish, not one this command substitutes: a run may print `0` as a real count, so an absent table wearing a `0` would read as a clean one.

The last three strings exist rather than folding into the first because the comment _was_ posted and only a part of it is missing. Nothing posted means chase the run; posted-but-silent means the run ignored the ask in Step 4. A human meeting a stalled gate needs to know which.

### Post exactly one verification comment

Write the body to a file and post the file, so no shell quoting stands between you and the exact first line:

```sh
gh pr comment <n> --repo unic/unic-agents-plugins --body-file <path>
```

The shape, first line first:

```text
<!-- archon-pr-review-verification run=<run-id> head=<post-review-sha> -->
run: <run-id>
head-before: <pre-review-sha>
head-after: <post-review-sha>
commits-pushed: <first line of the log between the two SHAs, or none>
<its remaining lines, if any>
dimensions-run: <the run's own line, copied verbatim>
source: the run's own claim
dimensions-not-run: <the run's own line, copied verbatim>
source: the run's own claim
findings-found: <the CRITICAL row of the part=review severity table, copied verbatim>
<the HIGH row, copied verbatim>
source: found by the run, before any fix
fixes-claimed: <the header row of the part=fixes severity table, copied verbatim>
<the CRITICAL row, copied verbatim>
<the HIGH row, copied verbatim>
source: the run's own claim
ci: <the conclusion gh pr checks gives on head-after>
source: CI's word
authorisation: <the caller's statement from Step 3, copied verbatim>
```

`<run-id>` is the 32-character ID Step 5 read from `archon workflow status`. `<post-review-sha>` is `headRefOid` read **after** the run left the active list. `authorisation:` appears on the unattended path only; every other field is always present, and where its source did not deliver it carries one of the five strings above.

**Field format: name, colon, one space, then the value and nothing before it.** Every field opens at column 1, and the value starts immediately after that single space. Nothing may sit between the colon and the value — no source label, no parenthesis, no marker, no emoji. A gate reads a field's value as the text from immediately after `<field-name>: ` to the end of that field's own line, and tests it as a prefix. Under a looser reading, `fixes-claimed: (the run's own claim) not published by the run` satisfies "labelled" and defeats every such test — which is fail-open on the one gate this marker exists to arm.

Where a field is sourced, the source sits on its **own** line directly beneath it, reading `source: <label>`. **Where a value runs to more than one line** — several copied table rows, a multi-commit log — its first line goes on the field's line and the rest follow beneath, above any `source:` line. This covers every multi-line value, tables and logs alike.

The `fixes-claimed:` header row is copied because runs paraphrase it, and the rows alone do not say what the numbers count. Observed shapes: `| Severity | Fixed | Skipped |` on #36, #307 and #364; `| Severity | Fixed | Documented instead | Skipped |` on #298; `| Severity | Fixed | Left for you |` on #310. The bundled template prescribes the first; the runs do not always follow it.

**Three of these fields are the run's own claim, not this command's finding** — which dimensions ran, which did not, and what the auto-fix says it fixed and skipped. Each carries its `source:` line and is copied verbatim. The comment never launders a claim into a fact.

**One thing no field can supply: which CRITICAL and HIGH findings survived the auto-fix.** The `part=review` comment prints what was **found**. The `part=fixes` comment prints what the run **says** it fixed and skipped. Nothing published prints the difference, and the two tables use different column sets, so subtracting one from the other would invent a number. The comment records both side by side and subtracts nothing.

**The comment states no overall verdict.** No `PASS`, no `FAIL`, no `OK`, no word standing for this command's judgment of the review. It records facts and labelled claims so a later reader — human or gate — can decide. A comment that grades itself is the same failure as a workflow reporting its own success, which this repo has been bitten by twice, and it is the shape `docs/process/ai-development.md:51` names. The `ci:` field is the one exception and it stays: it quotes `gh pr checks`, which renders a pass or a fail, and it is labelled as CI's word.

### Then report

Per PR: base still `develop`, commits the review added, CI state after those commits, and the findings it left open. A review is complete only when the verification comment is posted **and** CI is green on the new head. If the auto-fix pushed a commit that broke CI, that is the review's fault and the PR is worse than before — say so plainly.

## Standing rules (always apply)

1. **Always pass `--from develop`.** Archon auto-detects its worktree base and picks `main`, which last moved at the previous release merge. `.archon/config.yaml` sets `baseBranch: develop`, but pass the flag anyway and verify the fork point right after dispatch:

   ```sh
   W=$(archon workflow get <run-id> | awk '/Path:/{print $2}')
   git -C "$W" log --oneline -1        # must be the develop tip
   ```

2. **Never put `$node.output` syntax in a dispatch prompt.** Archon interpolates `$ARGUMENTS` into node prompts and then resolves `$`-prefixed tokens as node references. An unknown reference kills the run at its first node in milliseconds, with no node-level error message. Describe node outputs in prose.

3. **Never `--branch` on a review run.** The workflow checks out the PR head from the scope node.

4. **Never merge, and verify on GitHub — not the workflow's word.** The completion summary and the exit code are both unreliable: a run has reported "all checks green, mergeable" while CI typecheck was red, and has reported failure when only a transient network node failed. The maintainer reviews and merges.

5. **Never create or delete `LICENSE` files.**

## When something goes sideways

- **Run died instantly at the first node:** a `$`-token in the prompt (Standing rules #2). Clean up and re-dispatch with prose.
- **The review force-pushed and CI went red:** read `git log <pre-review-sha>..HEAD`. For a one-line deterministic fix, patch it on the branch and push. Otherwise `git reset --hard <pre-review-sha>` + force-push to restore the reviewed state, and report the review as failed rather than leaving a broken PR.
- **The review rebased onto the wrong base:** check `gh pr view <n> --json baseRefName`. Retarget with `gh pr edit <n> --base develop`, then confirm the branch's merge-base is the develop tip, not the main tip.
- **`sync` auto-resolved a conflict wrongly:** its own rule is "SIMPLE → auto-resolve". Read the rebase's resulting diff against the pre-review SHA before accepting it.
- **Archon cannot resume a failed run.** A clean re-dispatch is the only recovery: no worktree cleanup is needed for review runs (they use a throwaway `task-archon-comprehensive-pr-review-*` worktree), but do confirm the PR branch is in the state you expect first.
