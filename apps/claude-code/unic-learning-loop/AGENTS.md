# AGENTS.md · unic-learning-loop

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-learning-loop` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It collects what a team learns about its repository from Claude Code sessions into one reviewed rules file.

> Status: the plugin ships the `Stop` hook, the Cadence Gate, from [#528](https://github.com/unic/unic-agents-plugins/issues/528). The `learn` skill and its subagent arrive with [#529](https://github.com/unic/unic-agents-plugins/issues/529), so the command the notice names does not exist yet. The v1 design is the spec [#526](https://github.com/unic/unic-agents-plugins/issues/526).

## The hook

`scripts/cadence-gate.mjs` is the only code in the plugin, and `hooks/hooks.json` registers it on `Stop`. Its tests in `tests/cadence-gate.test.mjs` start it as a process with a payload on stdin and read stdout and the state file. They never import it, so keep the hook one script and test it only as a process. See spec #526, "Testing Decisions".

The hook keeps its state in `unic-learning-loop/` beside the session's transcript, found from the payload's `transcript_path`. It never reads `CLAUDE_PROJECT_DIR` or the working directory. It never sets `decision`, and it exits 0 on every path.

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
