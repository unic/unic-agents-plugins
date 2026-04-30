# unic-agents-plugins

A monorepo of AI agent plugins developed at Unic. Currently hosts Claude Code plugins; structured to accommodate plugins for other agents (GitHub Copilot, etc.) in the future.

## Plugins

| Plugin                                                       | Agent       | Description                            |
| ------------------------------------------------------------ | ----------- | -------------------------------------- |
| [`pr-review`](apps/claude-code/pr-review/)                   | Claude Code | Review Azure DevOps pull requests      |
| [`auto-format`](apps/claude-code/auto-format/)               | Claude Code | Auto-format and lint files after edits |
| [`unic-confluence`](apps/claude-code/unic-confluence/)       | Claude Code | Publish Markdown files to Confluence   |

## Installing plugins (Claude Code)

Add the Unic marketplace once:

```sh
claude marketplace add https://github.com/unic/unic-agents-plugins
```

Then install individual plugins:

```sh
claude plugins install pr-review
claude plugins install auto-format
claude plugins install unic-confluence
```

## Development

**Prerequisites:** Node.js ≥ 24, pnpm ≥ 10, Claude Code CLI (for Ralph).

```sh
pnpm install                           # install all workspace deps
pnpm check                             # Format check (Biome & Prettier for MD)
pnpm format                            # Format (Biome & Prettier for MD), writes files
pnpm test                              # run tests across all packages
pnpm typecheck                         # type-check across all packages
pnpm --filter <name> verify:changelog  # changelog check for one plugin
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow.

## Structure

```
apps/
└── claude-code/          # Claude Code plugins (one dir per plugin)
packages/
├── biome-config/         # @unic/biome-config — shared Biome rules
├── tsconfig/             # @unic/tsconfig — shared TypeScript base config
└── release-tools/        # @unic/release-tools — bump/tag/verify scripts
docs/
└── plans/                # Ralph-iterable spec roadmap
```

## License

LGPL-3.0-or-later — see [LICENSE](LICENSE).
