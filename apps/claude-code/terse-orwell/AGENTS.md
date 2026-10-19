# AGENTS.md · terse-orwell

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`terse-orwell` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It keeps Claude concise. It ships the Shared setup, and `/terse-orwell:setup` writes each user's Personal layer. [CONTEXT.md](CONTEXT.md) defines both terms.

## Layout

| Path                            | What it is                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `output-styles/terse-orwell.md` | The output style. It names no user: the Personal layer says who they are                              |
| `context/shared-setup.md`       | The generic behaviour rules. A plugin cannot ship a `CLAUDE.md`, so a hook sends them                 |
| `scripts/inject.mjs`            | The only hook. It answers `SessionStart`, `SubagentStart` and `UserPromptSubmit` by `hook_event_name` |
| `scripts/write-layer.mjs`       | Writes the Personal layer between the markers. `/terse-orwell:setup` is its only caller               |
| `skills/setup/SKILL.md`         | `/terse-orwell:setup`                                                                                 |

## Rules

- `inject.mjs` exits 0 on every path. A hook that fails must not block a session, a prompt or a subagent spawn.
- Both scripts read `CLAUDE_CONFIG_DIR` before `~/.claude`, so a test profile never touches the user's own files.
- `write-layer.mjs` never changes a byte outside the markers. With only one marker in the file it refuses and writes nothing.
- The language hook reads the lines `- Chat language: <x>` and `- Artefact language: <y>`. Keep that format in `skills/setup/SKILL.md` and in the hook together.
- The unslop skill is not bundled: the licence of its upstream path is unverified, and an upstream install keeps it current.
- Keep both scripts free of runtime dependencies and shell commands. Tests start them as processes and never import them.

## Where to start

- [Root AGENTS.md](../../../AGENTS.md) is the source of truth for cross-cutting rules: pnpm scripts, Gitflow, SemVer, Conventional Commits, the LICENSE policy and the cross-platform requirement
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) indexes all bounded contexts in the repo

## Commands

```sh
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version               # mirror plugin.json version into marketplace.json + package.json
pnpm tag                        # create the terse-orwell@<version> git tag locally
pnpm verify:changelog           # check CHANGELOG entry for the current version
pnpm test                       # run node:test suite
pnpm typecheck                  # tsc --noEmit over scripts/ and tests/
```
