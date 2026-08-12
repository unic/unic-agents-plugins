---
description: Dispatch archon-comprehensive-pr-review for one or more open PRs, with intent from the linked issue, Gitflow guardrails and a deduped monitor.
argument-hint: <pr-number> [pr-number ...]
allowed-tools: Bash(gh *), Bash(git *), Bash(archon *), Task
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
- **Posts a `gh pr comment`** with the synthesised review.

So a green PR can come back with new commits and a red build. That is why Step 1 records the pre-review head SHA and Step 6 re-verifies against it.

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

Dispatching spawns autonomous agents, consumes significant tokens, and writes to the PR. **Always show the plan and get explicit go-ahead before running anything.** Present, per PR: number, base, linked issue, CI state, pre-review head SHA, what the workflow may push, and the exact dispatch command. Then ask to proceed.

## Step 4 — Dispatch

Run each `archon workflow run` in the **background** (`run_in_background: true`) — the workflow blocks the shell.

Pass `--from develop`. Never pass `--branch`: the scope node checks out the PR head itself, and `--branch` would create an unrelated branch. Without `--from`, Archon auto-detects its worktree base and picks `main` (see Standing rules #1).

**Parallelism rule:** dispatch concurrently only for PRs on different branches. Two runs on one branch is a lost-commit race.

Dispatch command shape (fill the bracketed clauses from Step 1):

```sh
archon workflow run archon-comprehensive-pr-review --from develop \
  "Review the PR https://github.com/unic/unic-agents-plugins/pull/<n>, which implements https://github.com/unic/unic-agents-plugins/issues/<issue>. Gather the intent from issue #<issue> — its acceptance criteria are the contract. Check that the PR actually satisfies EVERY acceptance criterion, then perform a full PR review. GITFLOW: the PR base is 'develop', never 'main'. Do NOT change the PR base. Do NOT merge the PR. If a rebase is needed, rebase onto origin/develop only. Scope: <paths>. Never create or delete LICENSE files. CONTEXT: CI is <green/red> on this PR head, so if you push any fix commit, re-run 'pnpm --filter <name> test', 'pnpm --filter <name> typecheck' AND 'pnpm ci:check' and wait for 'gh pr checks <n>' to be green again before reporting. Pay particular attention to: <emphasis list from Step 1>."
```

Do not write `$anything.output` in the prompt — see Standing rules #2.

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

## Step 6 — Verify what the review did

When the run leaves the active list, do not trust its summary. Check the PR itself:

```sh
gh pr view <n> --repo unic/unic-agents-plugins --json baseRefName,headRefOid,mergeable,mergeStateStatus,commits
gh pr checks <n> --repo unic/unic-agents-plugins
git log --oneline <pre-review-sha>..<new-head-sha>      # what the review pushed
gh pr view <n> --repo unic/unic-agents-plugins --comments | tail -60
```

Report, per PR: base still `develop`, commits the review added, CI state after those commits, and the findings it left open. A review is complete only when the comment is posted **and** CI is green on the new head. If the auto-fix pushed a commit that broke CI, that is the review's fault and the PR is worse than before — say so plainly.

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
