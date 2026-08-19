---
description: Dispatch archon-fix-github-issue for one or more issues, respecting the dependency tree, with standing guardrails and a deduped monitor.
argument-hint: <issue-number> [issue-number ...]
allowed-tools: Bash(gh *), Bash(git *), Bash(archon *), Task
---

# /archon-rollout

Roll out the implementation of the GitHub Issue(s) in `$ARGUMENTS` by dispatching `archon-fix-github-issue` per issue, respecting their dependency tree. Each issue is a tracer-bullet vertical slice; each Archon run forks `develop` in an isolated worktree and opens its own PR back to `develop`.

`$ARGUMENTS` is one or more issue numbers (space- or comma-separated). Examples: `194` (single) · `163 164 165 166` (chain). If `$ARGUMENTS` is empty, ask which issue(s) to roll out and stop.

REPO is `unic/unic-agents-plugins` unless an argument overrides it.

## Step 1 — Derive the plan from the issues (do not ask for what you can infer)

For each issue number, fetch it and derive its parameters:

```sh
gh issue view <n> --repo unic/unic-agents-plugins --json number,title,body,labels
```

From each issue derive:

- **Scope** — the `app:<plugin>` / `pkg:<package>` / `repo` label (drives the `pnpm --filter` target and whether clean-slate applies).
- **Branch name**: `feature/<scope>/<issue#>-<slug>` (see Standing rules #1). `<scope>` is the area label with its tier stripped (`app:unic-pr-review` → `unic-pr-review`, `pkg:release-tools` → `release-tools`, `repo` → `repo`). If an issue has **no** area label, stop and ask rather than guess. `<slug>` is a short verb-first phrase for the _change_ (not the symptom), lowercase-hyphenated, ≤ ~4 words, e.g. `194-remove-identity-matching`. Never `fix/` or `hotfix/` (bugs that target `develop` are `feature/` too; `hotfix/` is reserved for fixes branched off `main`).
- **PR title** — a Conventional Commit from the `bug`/`feature`/etc. type label + the issue title, scoped to the package (e.g. `fix(unic-pr-review): …`).
- **Source-of-truth** — paths the body names as the contract: any `docs/.../PRD.md`, `docs/adr/*.md`, `CONTEXT.md`, or an explicit "source of truth" line.
- **Blockers** — any `blocked by #N` / `depends on #N` in the body. Use these to order the tree.
- **Guarded files** — does the body's affected-file list touch a guarded file (`commands/*.md`, `scripts/**/*.mjs`, `plugin.json`, `CLAUDE.md`/`AGENTS.md`, `README.md` in a plugin)? If yes, the changelog-bump rule applies (see Standing rules #4).

## Step 2 — Foundation check (must pass before dispatching dependents)

Archon forks every run from `develop`. Any ADR / PRD / `CONTEXT.md` change an issue depends on must already be **on `develop`**, or the agent works without it. For each source-of-truth artefact the issue treats as a pre-existing contract:

```sh
git log develop --oneline -1 -- <path/to/artefact>
```

If empty, **stop**: report that the foundation is missing and must land on `develop` (via PR per Gitflow) before dispatch. Do not dispatch that issue or its dependents.

## Step 3 — Present the dispatch plan and confirm

Dispatching spawns autonomous agents and consumes significant tokens, so **always show the plan and get explicit go-ahead before running anything.** Present, per issue: number, scope, blockers, whether it's guarded, the foundation-check result, and the exact dispatch command. State the batch order (which dispatch now in parallel, which wait for a merge). Then ask to proceed.

## Step 4 — Dispatch

Run each `archon workflow run` in the **background** (`run_in_background: true`) — the workflow blocks the shell. Always pass `--branch` **and `--from develop`**.

**`--from develop` is not optional.** `.archon/config.yaml` sets `worktree.baseBranch: develop` and that key now resolves, but the flag is what a reader of the dispatch line can see, and it overrides the file. A run that loses both forks from Archon's stored default branch, `main`, whatever the branch name says. `main` trails `develop` by every unreleased commit, so a run without `--from develop` works against a tree that lacks the ADRs, tests and conventions Step 2 just verified — and Step 2 passes anyway, because it inspects `develop`, not the worktree. After dispatch, before arming the monitor, verify the fork point:

```sh
git -C "$HOME/.archon/workspaces/<org>/<repo>/worktrees/archon/<archon-branch>" rev-parse --short HEAD
git -C <your-checkout> rev-parse --short develop     # the two must match
```

If they differ, the run is on the wrong base: abandon it (`archon workflow abandon <run-id>`), then follow the clean re-run runbook below before re-dispatching.

**The branch you pass is not the branch you get.** Archon derives its own name from yours, prefixes `archon/task-`, and truncates it — often mid-word and often to a trailing `-`:

```
passed   feature/unic-archon-dlc/329-collect-label-mapping-in-setup
created  archon/task-feature-unic-archon-dlc-329-collect-label-mapping-
passed   feature/unic-archon-dlc/294-install-archon-artefacts
created  archon/task-feature-unic-archon-dlc-294-install-archon-artefac
```

`--branch` still matters — it is what makes the issue number and slug legible on the remote — but Standing rule #1's `feature/<scope>/<issue#>-<slug>` describes what you **pass**, not what lands. Read the real name from `archon workflow status` or `git ls-remote --heads origin`, and never assume the branch you named exists.

Two consequences when you inspect that branch locally. A trailing `-` breaks `git show <branch>:<path>`, so fetch it into a name you choose — the refspec needs no quoting, which keeps it working in `cmd.exe` as well as a POSIX shell:

```sh
git fetch origin refs/heads/<real-name>:refs/heads/pr<n>
```

And never reach for `FETCH_HEAD` — any intervening `git fetch origin` repoints it silently, so `git checkout -B work FETCH_HEAD` can land you on `develop` while you believe you are on the PR branch. Check `git rev-parse --short HEAD` against the PR's head commit before you edit anything.

**Parallelism rule:** dispatch concurrently **only** when issues share zero files (different package/plugin, no overlapping module). Issues editing the same file, or one `blocked-by` another, run **serially** — dispatch the next only after the prior PR **merges to `develop`**.

Dispatch command shape (fill the bracketed clauses from Step 1; drop clauses that don't apply):

```sh
archon workflow run archon-fix-github-issue --branch feature/<scope>/<n>-<slug> --from develop "Fix issue #<n> in repo unic/unic-agents-plugins. Read the issue body carefully — the acceptance criteria are exhaustive. Source of truth: <derived paths>. [IF unic-pr-review: CLEAN-SLATE DOCTRINE — write every module fresh from the PRD and ADRs; do NOT load, copy, or pattern-match anything from apps/claude-code/pr-review/.] [IF guarded: run 'pnpm --filter <name> bump patch' and add a CHANGELOG bullet under the new version.] VERIFICATION DISCIPLINE: after EVERY edit, including any self-fix/simplify/format commit, re-run BOTH 'pnpm --filter <name> typecheck' AND 'pnpm --filter <name> test' and confirm both pass — the CI Test job runs test THEN typecheck, so passing tests alone is not a green build. If you rename or remove a function parameter, update its JSDoc @param to match or tsc fails (TS8024/TS7006). Do not report the issue done unless 'gh pr checks' shows every check passing. After both typecheck and tests are green, push and open a PR targeting develop titled '<PR title>'. The PR body MUST open with the line 'Fixes #<n>.' — a bare mention does not close the issue, and an issue that stays open keeps its 'ready-for-agent' label and can be re-dispatched."
```

**The `Fixes #<n>.` line is not a formality.** GitHub closes an issue only on a closing keyword; a prose reference leaves it open. An open issue keeps `ready-for-agent`, which is what `/archon-rollout` selects from — so a merged slice stays takeable and an unattended run can re-dispatch work it merged an hour earlier. PR #334 carried the line and closed #327; PR #342 mentioned #340 in prose and left it open. Issue #345 tracks the durable fix.

## Step 5 — Arm the monitor

Grab the 32-char run IDs (`archon workflow status`, ~5–10s after dispatch), then launch one `Monitor` (persistent). **Key completion on the watched run IDs, never on a global active count** — other rollouts may run concurrently, and the global count both misfires (`[done]` waits on unrelated runs) and lingers (a brief empty gap between serial slices blanks the state and the monitor silently re-attaches to the next run). One `<n>:<run-id>` entry per watched run in `RUNS`.

First confirm the workspace path casing — the org dir mirrors your local checkout and may be `UNIC`, not `unic`:

```sh
ls -d "$HOME/.archon/workspaces/"*/unic-agents-plugins
```

```bash
STATE=/tmp/archon-mon-$$
mkdir -p "$STATE"; touch "$STATE/prev-status"
WS="$HOME/.archon/workspaces/UNIC/unic-agents-plugins"   # <- casing from the ls above
RUNS=(
  "<n>:<run-id>"
)

emit_new() {
  local label="$1" pattern="$2" file="$3" prefix="$4"
  local seenfile="$STATE/seen-$label-$prefix"; touch "$seenfile"
  [ -f "$file" ] || return
  grep -Eo "$pattern" "$file" 2>/dev/null | sort -u | while read -r line; do
    [ -z "$line" ] && continue
    h=$(printf '%s' "$line" | md5)
    grep -q "^$h$" "$seenfile" 2>/dev/null && continue
    echo "$h" >> "$seenfile"
    printf '[#%s %s] %s\n' "$label" "$prefix" "${line:0:200}"
  done
}

while true; do
  # Status of ONLY our watched runs, keyed by id — ignores unrelated rollouts.
  active_ids=$(archon workflow status 2>/dev/null \
    | awk '/^  ID:/{id=$2} /^  Status:/{print id"="$2}')
  mystat=""; any_active=0
  for entry in "${RUNS[@]}"; do
    n="${entry%%:*}"; rid="${entry#*:}"
    st=$(printf '%s\n' "$active_ids" | awk -F= -v id="$rid" '$1==id{print $2}')
    if [ -z "$st" ]; then st="absent"; else any_active=1; fi
    mystat="$mystat #$n=$st"
    file="$WS/logs/$rid.jsonl"
    emit_new "$n" "session limit[^\"]*"                            "$file" "LIMIT"
    emit_new "$n" "Block: apps/claude-code/pr-review[^\"]*"        "$file" "HOOK-TRIP"
    emit_new "$n" "verify-pr-base[^\"]*(failed|timeout|TLS)[^\"]*" "$file" "VERIFY-SKIP"
    emit_new "$n" "git push -u origin [a-zA-Z0-9/_-]+"             "$file" "PUSH"
    emit_new "$n" "(opened|Created) PR #[0-9]+"                    "$file" "PR-OPENED"
  done
  if [ "$mystat" != "$(cat "$STATE/prev-status" 2>/dev/null)" ]; then
    echo "[status]$mystat"; printf '%s' "$mystat" > "$STATE/prev-status"
  fi
  [ "$any_active" = 1 ] && touch "$STATE/was-active"
  # Fire only after a watched run has gone active -> absent (avoids the just-dispatched race).
  if [ "$any_active" = 0 ] && [ -f "$STATE/was-active" ]; then
    echo "[done] all watched runs left the active list"; rm -rf "$STATE"; break
  fi
  sleep 90
done
```

Set `persistent: true` and a `description` naming the watched issues. The keyed `[done]` now fires correctly per batch, but it is still good practice to `TaskStop` a finished slice's monitor before arming the next.

Monitor signals: `LIMIT` (Claude usage cap tripped mid-run — external, re-run after reset) · `HOOK-TRIP` (clean-slate violation — always investigate) · `VERIFY-SKIP` (`verify-pr-base` failed, so the review/self-fix/simplify pipeline was cascade-skipped — the PR is unreviewed, do a clean re-run) · `PUSH` (confirm PR base is `develop`) · `PR-OPENED` (verify on GitHub: `gh pr checks` all green AND the review steps actually ran, then surface for review) · `[status]` (per-run transitions) · `[done]` (all watched runs left the active list).

## Standing rules (always apply)

1. **Branch from `develop`, PR to `develop`.** Always pass `--branch feature/<scope>/<issue#>-<slug>` (derived in Step 1). Follow Gitflow's two-prefix model: develop-targeting work (features **and** bugs) is `feature/`; `hotfix/` is reserved for fixes branched off `main`. Never `fix/`, never target `main`. The Gitflow _topology_ is owned by the "Git branching (Gitflow)" section of the root `AGENTS.md`; the `<scope>/<issue#>-<slug>` naming _within_ the `feature/` namespace is owned by this command.
2. **Foundation on `develop` first** (Step 2). Never dispatch a dependent before its contract is on `develop`.
3. **Clean-slate for `unic-pr-review`.** Issues scoped to `apps/claude-code/unic-pr-review/` share no code/prompts/fixtures/dependency with `apps/claude-code/pr-review/` (deprecated, hook-protected by `.claude/hooks/block-pr-review.mjs`). Put the clean-slate clause in those dispatch prompts verbatim. Other scopes are exempt.
4. **`verify:changelog` merge-gate.** Guarded-file PRs need a version bump + CHANGELOG bullet or CI fails. If a rollout itself introduces/tightens this gate, merge that PR **last**.
5. **Never auto-merge, and verify CI on GitHub — not the workflow's word.** Archon opens PRs; the maintainer reviews and merges each. Don't merge while the run is still active (`archon-fix-github-issue` keeps working post-PR). The workflow's completion summary and its exit code are **both unreliable**: a run has reported "all checks green, mergeable" while CI typecheck was red, and has reported failure when only a transient network node (`verify-pr-base`) failed. Always confirm with `gh pr view <n>` (base `develop`, mergeable) + `gh pr checks <n>` (every check passing, none pending) before calling a slice ready. An issue is done only when its PR is **merged to `develop`** and CI is green there.
6. **Never create or delete `LICENSE` files.**

## When something goes sideways

- **Run off-script** (copied from a forbidden source, ignored an ADR): `archon workflow reject <run-id> "<sharper reminder>"`, then re-dispatch. Read the log at `~/.archon/workspaces/unic/unic-agents-plugins/logs/<run-id>.jsonl`.
- **CI fails on a guarded-file PR:** almost certainly the bump gate — add a bump + CHANGELOG bullet. Expected, not a regression.
- **CI Test job red but tests passed:** the Test job runs `test` then `typecheck`; a green test run with `exit code 2` means `tsc` failed afterwards. Read the log for `error TS####` (a self-fix param rename leaving a stale JSDoc `@param` is a known cause). For a one-line deterministic fix, patch it directly on the branch and push; otherwise clean re-run.
- **Run died on the Claude usage limit** (log: `You've hit your session limit`): external, not a code or workflow defect. Wait for the reset, then re-dispatch — work committed in the worktree before the cap may be recoverable, but a clean re-run is safer.
- **`verify-pr-base` failed (TLS/network):** Archon then **cascade-skips the entire review → self-fix → simplify → report pipeline**, leaving an unreviewed PR that may still be CI-green. Archon **cannot resume a failed run**, so the only way to get those steps is a clean re-run (below). Do not accept the PR just because CI passes.
- **Clean re-run runbook** (botched/partial run, unreviewed PR, or to start fresh): `gh pr close <n> --delete-branch` → `git worktree remove --force <worktree-path>` → `git worktree prune` → `git branch -D <branch>` (local ref survives worktree removal) → confirm `develop` is untouched (`git rev-parse --short origin/develop`) → re-dispatch. Archon forks fresh from `develop` only if the old worktree and branch are gone.
- **An issue's ACs are wrong:** fix the body via `gh issue edit <n>`, re-dispatch.
- **PR landed on `main`:** `gh pr edit <n> --base develop`.
- **Issue state is ground truth** — a slice is done iff its issue is closed / PR merged. `TaskStop` on the monitor does not kill the Archon run.
