# 0036. Split the NDA guards by what each sees

**Status:** Accepted (2026-09)

## Context

This repository is public, and one client of the DLC work is under an NDA. Two guards keep its terms off GitHub: the git hooks in `.githooks/` and the Claude hook `.claude/hooks/block-nda-terms.mjs`.

The Claude hook decided what to scan by parsing the command string. For a commit, it resolved every directory the command could commit in and read each one's staged diff. To avoid reading a commit message as shell, it stripped `-m` arguments and heredoc bodies. Every fix to that parser added a form, and every review found the next form it missed. [#579](https://github.com/unic/unic-agents-plugins/issues/579) lists 17 such findings plus three from [#580](https://github.com/unic/unic-agents-plugins/issues/580). They fall into three groups:

- The parser missed a form, such as `sh -c`, `/usr/bin/git`, `--body-file=<path>` or a CRLF heredoc.
- The parser saw a commit that was not there. A draft written with `cat <<EOF` that quoted a `git -C <path> commit` example was refused, because the hook tried to read a staged diff in a directory that does not exist.
- The hook read the staged diff before git staged anything, so `commit -a` and a commit with a pathspec showed it an empty diff.

Meanwhile a push scanned only the command string, never the commits it sent. A commit made with `--no-verify`, by `am`, `cherry-pick` or `merge`, or in another clone was pushed unchecked.

## Decision

Each guard covers what it can see, and nothing more.

- **Git guards what git writes and sends.** `pre-commit` and `commit-msg` run inside git and see the real staged content and message, whatever the command string says. `pre-push` scans every commit a push sends: the whole commit object, headers and message, and the added lines of its patch, a merge commit against its first parent, both ref names and an annotated tag's object. `pre-push` is the git guard that matters, and the commit hooks are an early warning.
- **The Claude hook guards what git never sees.** That is the text of `gh` and `glab` commands and the files they name. For git, it checks only that `pre-push` will run. It refuses `--no-verify`, its abbreviations and `hookspath` in any command text, and `send-pack`. It refuses a push unless this clone's `pre-push` will run: a push from outside any repository, from another repository even one with correct hooks, from a clone whose `core.hooksPath` is not its main work tree's `.githooks`, or whose `.githooks` lacks an executable `pre-push` or `nda-push.mjs`.
- **The Claude hook parses no commit directory.** It reads no staged diff and strips no message and no heredoc.
- **Parsing is limited to `gh` and `glab`, and it reads more than it needs.** A missed read is a leak. An extra read costs nothing, because the hook refuses only when it finds a term. So the hook splits a `gh` or `glab` command on a fixed set of characters and reads every piece that is an existing file.

Where a choice exists, the scans read more. A remote sha that is not a local commit is left out of the exclusion rather than failing the listing. The exclusion by `refs/remotes/<remote>/*` is the one place a scan can read less: a remote-tracking ref that holds a commit the remote does not have hides that commit, as the gaps below say. Deleted lines do not count in either git hook, because the deleted text is already published and refusing it would block the commit that removes a term.

The change ships as one pull request. Removing the Claude hook's commit scan before `pre-push` scans pushed commits would open a window in which a commit with a term goes out unchecked.

### Alternatives rejected

- **Parse fully.** Keep the parser and fix each form as it is found. The review history showed the list of forms has no end: shell quoting, heredocs, `sh -c`, aliases and variables each add more, and each fix introduced the next miss. A shell parser inside the hook would be a second shell whose disagreements with the real one are the leaks.
- **Read more of every directory form.** Keep the commit scan, and read the staged diff of every path in the command that resolves to an existing directory, as proposed in [a review comment on #579](https://github.com/unic/unic-agents-plugins/issues/579#issuecomment-5840700871) that came before the grilling. That removes most missed forms and refuses nothing that names no directory. Its real cost is that the hook runs before git stages anything, so it still cannot see what `commit -a` or a commit with a pathspec writes. `pre-commit` runs after git stages and sees it.
- **Scan what is about to be published.** Make the Claude hook compute what a `git push` will send. That repeats the job `pre-push` does with git's own answer, from outside git and with a guess at the remote state. `pre-push` receives the exact ref lines, so the scan belongs there.

## Consequences

- The Claude hook refuses some commands on purpose: any command text that holds `--no-veri`, a prefix of `--no-verify`, or `hookspath`, including `git config --get core.hooksPath` and a `grep` for it, and any `gh` or `glab` command that also runs `cd` or `pushd`. The maintainer runs an authorised one with `!`.
- `pre-push` reads every commit a push sends, so the first push to an empty remote scans the whole history.
- These gaps are accepted. `AGENTS.md` § "The NDA publish guard" carries the same list:
  - `git commit -n` skips the commit hooks, and the Claude hook does not detect it, because in `push` the same `-n` means `--dry-run`. `pre-push` catches the commit.
  - A push that the command points at another repository, such as `git -C <other clone> push`, or through any option or environment variable that changes git's directory, is checked against the cwd's config, not the other repository's.
  - A git alias that pushes holds no `push` word, so the Claude hook does not check it. `git -c include.path=<file> push`, where the file sets `core.hooksPath`, switches the hooks off without the word the hook looks for.
  - `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_SYSTEM` are not checked, because the clone's local `core.hooksPath` overrides both. Do not add them.
  - A quote or a backslash inside `--no-verify` or `hooksPath`, such as `git push --no-"verify"`, `git -c core.hooks""Path=…` or `git -c core.hooks\Path=…`, splits the word the Claude hook looks for. The hook does not refuse that command, and the command can switch the git hooks off.
  - A `gh` file is not read when it is named through a shell variable, a glob, a brace expansion or a backslash-escaped space, or read after `env --chdir=<dir>`.
  - A file whose lowercased basename is `gh`, `glab`, `gh.exe` or `glab.exe` is never read, whether or not it is the executable.
  - A non-ASCII term in Latin-1 or UTF-16 content is not found. The second read without NUL bytes covers UTF-16 in the ASCII range only.
  - The Claude hook's matcher is `Bash`, so a command run through the `PowerShell` tool on Windows is not checked.
  - `pre-commit` does not see the author or the committer of a commit. `pre-push` reads both, so it catches a term there.
  - A Git Bash path such as `/c/Users/x/body.md` after `--body-file` does not resolve on Windows, so the file is not read. Use a Windows path or `!`.
  - Compressed content, such as a `.gz`, `.zip` or `.docx` file, is scanned as its compressed bytes, so a term inside it is not found by any guard.
  - A remote-tracking ref that holds a commit the remote does not have makes `pre-push` scan less: a ref set by hand, one left over after a leaked commit was deleted from the remote, or one fetched from another URL than the push goes to.
  - In a worktree, git runs the hooks the main work tree has checked out. While the main work tree is on `main`, the `pre-push` with the NDA scan runs only once it reaches `main`.
  - When `node` is missing, the Claude hook's entry in `.claude/settings.json` exits 2 and blocks every `Bash` command, so the session can run no shell command until `node` is on `PATH`.
  - A person who pushes with `--no-verify` outside an agent session skips every git hook. The Claude hook sees `Bash` only, so a publish through an MCP tool is unguarded. An Archon workflow node inherits no ambient settings, so a Box almost certainly runs without the Claude hook. Measure that before dispatching a Box that could publish.
- `AGENTS.md` § "The NDA publish guard" describes the checks and names these gaps. It links here for the reasoning.
