# 0036. Split the NDA guards by what each sees

**Status:** Accepted (2026-09)

## Context

This repository is public, and one client of the DLC work is under an NDA. Two guards keep its terms off GitHub: the git hooks in `.githooks/` and the Claude hook `.claude/hooks/block-nda-terms.mjs`.

The Claude hook decided what to scan by parsing the command string. For a commit, it worked out every directory the command could commit in, from `cd`, `pushd`, `git -C`, `--work-tree`, `--git-dir` and `GIT_DIR=`, and read the staged diff of each. To avoid reading a commit message as shell, it stripped `-m` arguments and heredoc bodies. Every fix to that parser added a form, and every review found the next form it missed. [#579](https://github.com/unic/unic-agents-plugins/issues/579) lists 17 such findings plus three from [#580](https://github.com/unic/unic-agents-plugins/issues/580). They fall into three groups:

- The parser missed a form, such as `sh -c`, `/usr/bin/git`, `--body-file=<path>`, `commit -a` or a CRLF heredoc.
- The parser saw a commit that was not there. A draft written with `cat <<EOF` that quoted a `git -C <path> commit` example was refused, because the hook tried to read a staged diff in a directory that does not exist.
- The hook read the staged diff before git staged anything, so `commit -a` and a commit with a pathspec showed it an empty diff.

Meanwhile a push scanned only the command string, never the commits it sent. A commit made with `--no-verify`, by `am`, `cherry-pick` or `merge`, or in another clone left unchecked.

## Decision

Each guard covers what it can see, and nothing more.

- **Git guards what git writes and sends.** `pre-commit` and `commit-msg` run inside git and see the real staged content and message, whatever the command string says. `pre-push` scans every commit a push sends: its message and the added lines of its patch, a merge commit against its first parent, both ref names and an annotated tag's object. `pre-push` is the git guard that matters, and the commit hooks are an early warning.
- **The Claude hook guards what git never sees.** That is the text of `gh` and `glab` commands and the files they name. For git, it checks only that `pre-push` will run. It refuses `--no-verify` and `hookspath` in any command text, and a push from a repository whose `core.hooksPath` is not its main work tree's `.githooks`.
- **The Claude hook parses no commit directory.** It reads no staged diff and strips no message and no heredoc.
- **Parsing is limited to `gh` and `glab`, and it reads more than it needs.** A missed read is a leak. An extra read costs nothing, because the hook refuses only when it finds a term. So the hook splits a `gh` or `glab` command on a fixed set of characters and reads every piece that is an existing file.

The scans read more, never less, where a choice exists. A stale remote-tracking ref widens what `pre-push` reads. A remote sha missing from the local object store is left out of the exclusion rather than failing the listing. Deleted lines do not count in either git hook, because the deleted text is already published and refusing it would block the commit that removes a term.

The change ships as one pull request. Removing the Claude hook's commit scan before `pre-push` scans pushed commits would open a window in which a commit with a term leaves unchecked.

### Alternatives rejected

- **Parse fully.** Keep the parser and fix each form as it is found. The review history showed the list of forms has no end: shell quoting, heredocs, `sh -c`, aliases and variables each add more, and each fix introduced the next miss. A shell parser inside the hook would be a second shell whose disagreements with the real one are the leaks.
- **Read more of every directory form.** Resolve every path-like token as a possible commit directory and read its staged diff. This fails the other way: a token that names no repository is refused, which is the heredoc-draft false positive at a larger scale, and it still cannot see content that git stages after the hook runs.
- **Scan what is about to be published.** Make the Claude hook compute what a `git push` will send. That repeats the job `pre-push` does with git's own answer, from outside git and with a guess at the remote state. `pre-push` receives the exact ref lines, so the scan belongs there.

## Consequences

- The Claude hook refuses some commands on purpose: any command text that holds `--no-verify` or `hookspath`, including `git config --get core.hooksPath` and a `grep` for it, and any `gh` or `glab` command that also runs `cd` or `pushd`. The maintainer runs an authorised one with `!`.
- `pre-push` reads every commit a push sends, so the first push to an empty remote scans the whole history.
- These gaps are accepted:
  - `git commit -n` skips the commit hooks and is not detected, because in `push` the same `-n` means `--dry-run`. `pre-push` catches the commit.
  - A push run against another clone, such as `git -C <other clone> push`, is checked against the cwd's config, not the other clone's.
  - `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_SYSTEM` are not checked, because the clone's local `core.hooksPath` overrides both.
  - A `gh` path held in a shell variable is not read.
  - A Git Bash path such as `/c/Users/x/body.md` after `--body-file` does not resolve on Windows, so the file is not read.
  - In a worktree, git runs the hooks the main work tree has checked out. While the main work tree is on `main`, the `pre-push` with the NDA scan runs only once it reaches `main`.
- `AGENTS.md` § "The NDA publish guard" describes the checks and names these gaps. It links here for the reasoning.
