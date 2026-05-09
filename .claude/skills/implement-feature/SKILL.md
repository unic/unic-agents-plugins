---
name: implement-feature
description: This skill should be used when the user asks to "implement a feature", "run the Feature Runner", "/implement-feature", "implement all issues for <slug>", or "drain the issue queue overnight". Automates the implementation side of the AI-development cycle for one Feature: creates an isolated worktree and branch, runs /tdd on every ready-for-agent issue in dependency order, and opens a PR when done.
---

# Implement Feature

Automate the implementation side of the AI-development cycle for one Feature. Takes a slug, creates an isolated branch, runs `/tdd` on every `ready-for-agent` issue in dependency order, and marks each `resolved` on success.

**Invocation:** `/implement-feature [slug]`

## Quick start

- **Named run** — `/implement-feature pr-review-doc-context-enrichment` — targets a specific Feature slug directly; creates a worktree, runs all `ready-for-agent` issues, opens a PR.
- **Auto-select** — `/implement-feature` with no argument — scans `docs/issues/` and picks the first Feature alphabetically that has at least one `ready-for-agent` issue and no unprepped issues (`needs-triage`, `needs-info`, `needs-specs`). Picks up partial features after a failure fix automatically.
- **Overnight loop** — `/loop /implement-feature` — drains the queue unattended; the runner emits `LOOP_COMPLETE` when no qualifying Feature remains, which terminates the loop.
- **Safe to interrupt** — Ctrl+C during any issue leaves that issue at `ready-for-agent`; re-running resumes from the first unresolved issue.

## Steps

### 0. Resolve the slug

**If a slug argument was provided**, use it directly and proceed to step 1.

**If no argument was provided**, scan `docs/issues/` for qualifying features:

1. Use the Bash tool to list immediate subdirectories of `docs/issues/`:

```
ls -d docs/issues/*/
```

2. For each subdirectory (potential feature slug), use the Bash tool to list its `NN-*.md` files and use the Read tool to check the `**Status:**` line of each one. A feature **qualifies** if:

   - At least one `NN-*.md` file has status `ready-for-agent`, **and**
   - Every `NN-*.md` file has a status in `{ready-for-agent, resolved, closed, rejected, ready-for-human}`.

   Any file with status `needs-triage`, `needs-info`, `needs-specs`, or any unrecognised state **disqualifies the whole feature** — it is not fully prepped for autonomous execution. Features where every file is `resolved`, `closed`, or `rejected` (nothing left to run) are also skipped.

3. Sort the qualifying slugs alphabetically and select the first one.

4. **If no qualifying feature exists**, emit the **LOOP_COMPLETE signal** (see `references/runner-output-formats.md`) on its own line and exit cleanly (no error). Do not output anything after it.

5. **If a qualifying feature was found**, set the slug to that feature's directory name and continue to step 1.

### 1. Resolve the feature directory and assemble the static context bundle

The slug argument maps directly to `docs/issues/<slug>/`. Use the Read tool to confirm the directory exists by reading its file listing. If the directory is missing, stop and report it to the user.

**Read the PRD:** `docs/issues/<slug>/PRD.md`. Scan its content for references matching `apps/claude-code/<plugin>/` (any path that starts with that prefix). This determines the ADR scope:

- **Plugin feature** — one or more `apps/claude-code/<plugin>/` references found → use that plugin's `apps/claude-code/<plugin>/CONTEXT.md` and `apps/claude-code/<plugin>/docs/adr/`. Do **not** also inject root ADRs.
- **Repo/tooling feature** — no such references found → use root `CONTEXT.md` and root `docs/adr/`.

**Read the scoped CONTEXT.md** using the Read tool.

**Read all ADR files** in the scoped ADR directory: list `*.md` files using the Bash tool, then read each one using the Read tool.

**Get the last 5 git commits** using the Bash tool:

```
git log --oneline -5
```

These four items (PRD, CONTEXT.md, ADRs, recent commits) are static — gather them once before the issue loop begins.

### 2. Create the worktree and branch

First, check whether a worktree from a prior run already exists using the Bash tool:

```
ls .claude/worktrees/<slug>
```

- **Exists** — reuse it. The branch `feature/afk/<slug>` already contains the committed work from the previous run. Skip `git worktree add`.
- **Does not exist** — create it using the Bash tool:

```
git worktree add .claude/worktrees/<slug> -b feature/afk/<slug> develop
```

The worktree lands at `.claude/worktrees/<slug>`. All subsequent implementation work happens inside that worktree.

### 3. Collect issues, build the dependency graph, and derive execution order

Use the Bash tool to list **all** `NN-*.md` files in `docs/issues/<slug>/` (including `resolved` and `closed` — they are needed for graph completeness):

```
ls docs/issues/<slug>/[0-9]*.md
```

Use the Read tool to read each file. For every file record:

- Its **numeric prefix** (the `NN` integer from the filename).
- Its **status** (`**Status:**` line).
- Its **`## Blocked by`** list — the filenames or paths referenced there. `## Blocked by: None`, `## Blocked by: None — can start immediately`, or a missing `## Blocked by` section all mean no predecessors.

**Conflict check — halt before executing anything if violated:**

For each issue A that lists issue B in `## Blocked by`: if B's numeric prefix is greater than A's numeric prefix, the dependency contradicts numerical convention. Halt immediately with the **dependency conflict error** (see `references/runner-output-formats.md`), naming both issues.

**Build the execution queue:**

From the dependency graph, compute a topological order over all issues (using `## Blocked by` edges). Filter the topological sequence to only `ready-for-agent` issues — `resolved`, `closed`, and `rejected` issues are satisfied and act as satisfied dependency nodes, not as items to execute.

**Unsatisfied dependency check — halt before executing anything if violated:**

For each `ready-for-agent` issue in the execution queue, inspect its `## Blocked by` list. If any listed blocker has status `ready-for-human`, halt immediately with the **unsatisfied dependency error** (see `references/runner-output-formats.md`), naming both issues.

This ordered list is the execution queue. Record M = number of items in the queue (frozen at this moment — do not recount mid-run).

### 4. Implement each issue via `/tdd`

For each issue file in queue order (N = 1, 2, … M), before invoking `/tdd`, emit the **progress line** (see `references/runner-output-formats.md`) substituting N, M, and the issue title (first `# Heading` line of the issue file).

Invoke the sub-agent using the Agent tool with `subagent_type: general-purpose` — the only stock type with access to both the `Skill` tool (to load `/tdd`) and `Edit`/`Write` tools (to write code). The issue's `## Acceptance criteria` replaces the interactive planning phase — pass it as the pre-approved plan so the agent skips confirmation and proceeds directly to implementation.

Before constructing the prompt, use the Read tool to read all sibling issue files (`docs/issues/<slug>/[0-9]*.md` except the current issue) at their current state — this gives the sub-agent visibility into what is already resolved and what is still pending.

Construct the prompt using the template in `references/tdd-prompt-template.md`, substituting all `<placeholder>` values at runtime. Pass the constructed prompt to the Agent tool. Wait for the agent to return before continuing.

**On failure:** If the Agent call signals failure (throws, returns an error, or explicitly reports it could not complete the issue):

1. Append the **failure note** (see `references/runner-output-formats.md`) to the issue file using the Edit tool, substituting `<slug>`. Do **not** change the `**Status:**` line, which must remain `ready-for-agent`.

2. Stop the runner immediately. Do not execute any subsequent issues — they may depend on a foundation this issue was meant to lay.

3. Report to the user: which issue failed, that the worktree is at `.claude/worktrees/<slug>` on branch `feature/afk/<slug>`, and that no subsequent issues were run.

### 5. Mark each issue resolved

After the Agent call for an issue returns **successfully**, update the issue file using the Edit tool: change the `**Status:** ready-for-agent` line to `**Status:** resolved`.

### 6. Continue until queue is empty

Repeat steps 4–5 for every issue in the queue. When the last issue is resolved, proceed to step 7.

### 7. Open a pull request and clean up

**Push the branch:**

```
git -C .claude/worktrees/<slug> push -u origin feature/afk/<slug>
```

**Derive the PR title** from the PRD's `title` frontmatter field (already read in step 1) and the slug:

```
feat(<slug>): <PRD title>
```

**List the resolved issues** — all `NN-*.md` files in `docs/issues/<slug>/` whose status is now `resolved` (every issue the runner just processed, in numerical order).

**Open the PR** using the Bash tool, passing the **PR body template** (see `references/runner-output-formats.md`) with `<slug>` and the resolved issue list substituted. Run `gh pr create` from inside the worktree (`git -C .claude/worktrees/<slug>`) or pass `--repo` if needed:

```
gh pr create \
  --base develop \
  --title "feat(<slug>): <PRD title>" \
  --body "<PR body template with substitutions>"
```

**Remove the worktree** after the PR is opened successfully:

```
git worktree remove .claude/worktrees/<slug>
```

Report the PR URL and the list of resolved issues to the user.

## Supporting Documentation

- **`references/runner-output-formats.md`** — verbatim strings for the progress line, dependency conflict error, unsatisfied dependency error, failure note, PR body template, and `LOOP_COMPLETE` signal.
- **`references/tdd-prompt-template.md`** — the AFK prompt template passed to the Agent tool for each `/tdd` sub-agent invocation; substitute all `<placeholder>` values at runtime.
