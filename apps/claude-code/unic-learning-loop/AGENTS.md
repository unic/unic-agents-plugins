# AGENTS.md · unic-learning-loop

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-learning-loop` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It collects what a team learns about its repository from Claude Code sessions into one reviewed rules file.

> Status: the empty plugin. It ships no hook, skill or subagent yet. The v1 design is the spec [#526](https://github.com/unic/unic-agents-plugins/issues/526), built by [#528](https://github.com/unic/unic-agents-plugins/issues/528) (the `Stop` hook) and [#529](https://github.com/unic/unic-agents-plugins/issues/529) (the `learn` skill and its subagent).

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
```

There is no `typecheck` script yet. `tsc` fails with no input files, so the script and `tsconfig.json` arrive with the first script in #528.

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).
