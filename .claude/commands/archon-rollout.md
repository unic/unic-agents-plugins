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

Run each `archon workflow run` in the **background** (`run_in_background: true`) — the workflow blocks the shell. Always pass `--branch`.

**Parallelism rule:** dispatch concurrently **only** when issues share zero files (different package/plugin, no overlapping module). Issues editing the same file, or one `blocked-by` another, run **serially** — dispatch the next only after the prior PR **merges to `develop`**.

Dispatch command shape (fill the bracketed clauses from Step 1; drop clauses that don't apply):

```sh
archon workflow run archon-fix-github-issue --branch fix/issue-<n> "Fix issue #<n> in repo unic/unic-agents-plugins. Read the issue body carefully — the acceptance criteria are exhaustive. Source of truth: <derived paths>. [IF unic-pr-review: CLEAN-SLATE DOCTRINE — write every module fresh from the PRD and ADRs; do NOT load, copy, or pattern-match anything from apps/claude-code/pr-review/.] [IF guarded: run 'pnpm --filter <name> bump patch' and add a CHANGELOG bullet under the new version.] After 'pnpm --filter <name> test' and 'pnpm --filter <name> typecheck' are green, push and open a PR targeting develop titled '<PR title>'."
```

## Step 5 — Arm the monitor

Grab the 32-char run IDs (`archon workflow status`, ~5–10s after dispatch), then launch one deduped `Monitor` (persistent; exits when all watched runs leave the active list). One `LABEL:logpath` entry per run in `RUNS`:

```bash
STATE=/tmp/archon-mon-$$
mkdir -p "$STATE"; touch "$STATE/prev-status"
RUNS=(
  "<n>:$HOME/.archon/workspaces/unic/unic-agents-plugins/logs/<run-id>.jsonl"
)

emit_new() {
  local label=$1 pattern=$2 file=$3 prefix=$4
  local seenfile="$STATE/seen-$label"; touch "$seenfile"
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
  status_now=$(archon workflow status 2>/dev/null \
    | awk '/^  ID:/{id=substr($2,1,8)} /^  Status:/{s=$2} /^  Age:/{print id"="s"@"$2}' \
    | sort | tr '\n' ' ')
  status_key=$(printf '%s' "$status_now"          | sed -E 's/@[^ ]*//g')
  prev_key=$(cat "$STATE/prev-status" 2>/dev/null | sed -E 's/@[^ ]*//g')
  if [ "$status_key" != "$prev_key" ]; then
    echo "[status] ${status_now:-no active workflows}"
    printf '%s' "$status_now" > "$STATE/prev-status"
  fi
  for entry in "${RUNS[@]}"; do
    label="${entry%%:*}"; file="${entry#*:}"
    emit_new "$label" "Block: apps/claude-code/pr-review[^\"]*" "$file" "HOOK-TRIP"
    emit_new "$label" "gh pr create[^\"\\\\]{0,400}"             "$file" "PR-CREATE"
    emit_new "$label" "git push -u origin [a-zA-Z0-9/_-]+"       "$file" "PUSH"
    emit_new "$label" "(opened|Created) PR #[0-9]+"              "$file" "PR-OPENED"
  done
  active=$(archon workflow status 2>/dev/null | grep -cE "^  Status:.*running" || echo 0)
  if [ "$active" = "0" ] && [ -s "$STATE/prev-status" ]; then
    echo "[done] no active workflows"; rm -rf "$STATE"; break
  fi
  sleep 120
done
```

Set `persistent: true` and a `description` naming the watched issues. **One monitor per active batch** — when dispatching the next serial slice, `TaskStop` the prior monitor (its `[done]` won't have fired for the new run) and arm a fresh one.

Monitor signals: `HOOK-TRIP` (clean-slate violation — always investigate) · `PUSH` (confirm PR base is `develop`) · `PR-CREATE`/`PR-OPENED` (fetch, check guardrails + CI, surface for review) · `[status]` (real transitions only) · `[done]` (all runs left the active list).

## Standing rules (always apply)

1. **Branch from `develop`, PR to `develop`.** Always `--branch <name>`. Never target `main`.
2. **Foundation on `develop` first** (Step 2). Never dispatch a dependent before its contract is on `develop`.
3. **Clean-slate for `unic-pr-review`.** Issues scoped to `apps/claude-code/unic-pr-review/` share no code/prompts/fixtures/dependency with `apps/claude-code/pr-review/` (deprecated, hook-protected by `.claude/hooks/block-pr-review.mjs`). Put the clean-slate clause in those dispatch prompts verbatim. Other scopes are exempt.
4. **`verify:changelog` merge-gate.** Guarded-file PRs need a version bump + CHANGELOG bullet or CI fails. If a rollout itself introduces/tightens this gate, merge that PR **last**.
5. **Never auto-merge.** Archon opens PRs; the maintainer reviews and merges each. Don't merge while the run is still active (`archon-fix-github-issue` keeps working post-PR). An issue is done only when its PR is **merged to `develop`** and CI is green there.
6. **Never create or delete `LICENSE` files.**

## When something goes sideways

- **Run off-script** (copied from a forbidden source, ignored an ADR): `archon workflow reject <run-id> "<sharper reminder>"`, then re-dispatch. Read the log at `~/.archon/workspaces/unic/unic-agents-plugins/logs/<run-id>.jsonl`.
- **CI fails on a guarded-file PR:** almost certainly the bump gate — add a bump + CHANGELOG bullet. Expected, not a regression.
- **An issue's ACs are wrong:** fix the body via `gh issue edit <n>`, re-dispatch.
- **PR landed on `main`:** `gh pr edit <n> --base develop`.
- **Issue state is ground truth** — a slice is done iff its issue is closed / PR merged. `TaskStop` on the monitor does not kill the Archon run.
