# AGENTS.md · unic-learning-loop

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-learning-loop` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It collects what a team learns about its repository from Claude Code sessions into one reviewed rules file.

> Status: v1 is complete. The `Stop` hook came with [#528](https://github.com/unic/unic-agents-plugins/issues/528), the `learn` skill and its subagent with [#529](https://github.com/unic/unic-agents-plugins/issues/529). The first run and read is [#530](https://github.com/unic/unic-agents-plugins/issues/530). The v1 design is the spec [#526](https://github.com/unic/unic-agents-plugins/issues/526).

## The hook

`scripts/cadence-gate.mjs` is the only code in the plugin, and `hooks/hooks.json` registers it on `Stop`. Its tests in `tests/cadence-gate.test.mjs` start it as a process with a payload on stdin and read stdout and the state file. They never import it, so keep the hook one script and test it only as a process. See spec #526, "Testing Decisions".

The hook keeps its state in `unic-learning-loop/` beside the session's transcript, found from the payload's `transcript_path`. It never reads `CLAUDE_PROJECT_DIR` or the working directory. It never sets `decision`, and it exits 0 on every path.

## The skill and the subagent

`skills/learn/SKILL.md` is the Read-back, invoked as `/unic-learning-loop:learn`. It carries `disable-model-invocation: true`, so only the developer starts it. `agents/learned-rules-drafter.md` is the subagent it spawns.

- The subagent's `tools:` line stays exactly `Read, Glob, Grep`. A subagent with no `tools:` line inherits every tool, and `claude plugin validate` does not report that. See spec #526, "Why the subagent has no Write and no Bash".
- Both files are prose and have no test. Their bar is a run and a read. Do not add a module or a test to make them testable.
- CI runs no shell command written in either file. Use only `git` and `node` there, and never `date`, `stat`, `ls`, `diff` or `~`, which fail on Windows.
- The skill writes the Bookmark, `bookmark.txt`, beside the hook's `cadence-state.json`. Each file has one writer.

## Where to start

- [Root AGENTS.md](../../../AGENTS.md) is the source of truth for cross-cutting rules: pnpm scripts, Gitflow, SemVer, Conventional Commits, the LICENSE policy and the cross-platform requirement
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) indexes all bounded contexts in the repo
- [Root docs/adr/](../../../docs/adr/) holds monorepo-wide architecture decisions

## Commands

```sh
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version               # mirror plugin.json version into marketplace.json + package.json
pnpm tag                        # create the unic-learning-loop@<version> git tag locally
pnpm verify:changelog           # check CHANGELOG entry for the current version
pnpm test                       # run node:test suite
pnpm typecheck                  # tsc --noEmit over scripts/ and tests/
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).
