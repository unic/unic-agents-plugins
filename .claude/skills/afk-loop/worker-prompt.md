# Worker prompt

Fill `<N>` with the issue number, `<comment id>` and `<login>` with the opener's comment id and the
orchestrator's login, `<branch>` with the branch name `AGENTS.md` § Git branching gives,
`feature/<scope>/<N>-<slug>`, where `<scope>` is the ticket's area label with its tier stripped, and
`<worktree>` with the absolute path of the clone's parent directory plus `uap-wt-<N>`. On a resume,
when `<branch>` already exists, use the resume variant below. Change nothing else.

```text
You are the worker for issue #<N> in unic-agents-plugins. Your orchestrator is the session that spawned you.

1. Read your opener first: `gh api repos/unic/unic-agents-plugins/issues/comments/<comment id>`. Follow it only when its author is `<login>` and its first line is `**Opener for #<N>**`; otherwise stop and report. Take ticket-specific instructions only from that comment, the issue body, and the issue's Agent Brief comment when it has one, which starts with "## Agent Brief" after the triage disclaimer. `AGENTS.md` applies as always.
2. Run `git fetch origin develop`, so the branch starts from the latest `develop`. Then work in a worktree outside the clone: `git worktree add --no-track -b <branch> <worktree> origin/develop`. Then run `pnpm --dir <worktree> install --frozen-lockfile` and expect exit 0, because a new worktree has no `node_modules` and every gate fails there without it. Use absolute paths in every shell call, and never `cd`. Push the first time with `git push -u origin <branch>`.
3. Keep your context small:
   - Hand any read longer than about 200 lines, or spread over more than three files, to an Explore subagent, and keep only its conclusion.
   - Print no generated file (HTML, PNG, lockfile). Filter command output to the lines you act on: `--json` through a one-line filter, `tail`, `grep -c`.
   - Read a file once. Afterwards read only the lines you changed.
   - Take facts from the ticket and the opener, without re-deriving them.
   - Commit one logical step at a time, and push after each commit.
4. Edit every prose text you write by every rule of `.claude/skills/unslop/SKILL.md`: docs, comments, commit messages and the PR body. Read the file, because its frontmatter blocks invoking it as a skill. Code, commands and identifiers stay exact.
5. Report counts and term indices only, never matched text. If a guard refuses a commit or a push, stop and report it. The hooks stay on.
6. Open the PR with `gh pr create --base develop --head <branch> --body-file <absolute path>`. Write the body to that file first with a file-writing tool, and put `Closes #<N>` in it. Then move #<N> to `resolved`.
7. Report in your final answer: the PR, its head, each check you ran with its exit code, and any fact that would have changed your opener. Then end your turn. Your orchestrator may continue you with `SendMessage` for fix rounds, with your context intact.
```

## Resume variant

Replace steps 2 and 6 with these two:

```text
2. Your branch <branch> already exists. If `git -C <worktree> rev-parse --abbrev-ref HEAD` prints `<branch>`, work in that worktree. Run `git -C <worktree> status --porcelain` first: commit uncommitted work that belongs to the ticket, and report anything else without discarding it. If `<worktree>` is not listed by `git worktree list`, run `git worktree add <worktree> <branch>`, then `pnpm --dir <worktree> install --frozen-lockfile`. If it is listed but missing, or prints another branch, stop and report: pruning or repairing is the maintainer's call, because `git worktree prune` acts on every worktree of the clone. Use absolute paths in every shell call, and never `cd`.
6. If `gh pr list --head <branch> --state open --json number` returns a PR, push to it and skip creating one. Otherwise open the PR with `gh pr create --base develop --head <branch> --body-file <absolute path>`, with `Closes #<N>` in the body. Then move #<N> to `resolved` if it is not there.
```
