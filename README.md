# unic-agents-plugins

A monorepo of AI agent plugins developed at Unic. Currently hosts Claude Code plugins; structured to accommodate plugins for other agents (GitHub Copilot, etc.) in the future.

## Plugins

| Plugin                                                 | Agent       | Description                                                                                         |
| ------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------- |
| [`pr-review`](apps/claude-code/pr-review/)             | Claude Code | Review Azure DevOps pull requests                                                                   |
| [`auto-format`](apps/claude-code/auto-format/)         | Claude Code | Auto-format and lint files after edits                                                              |
| [`unic-confluence`](apps/claude-code/unic-confluence/) | Claude Code | Publish Markdown files to Confluence                                                                |
| [`unic-archon-dlc`](apps/claude-code/unic-archon-dlc/) | Claude Code | Archon-powered AI development lifecycle (explore → plan → build → qa → cleanup → triage)            |
| [`unic-pr-review`](apps/claude-code/unic-pr-review/)   | Claude Code | AI-powered PR reviews with Atlassian intent checking, confidence-scored findings, and Approval Loop |

## Installing plugins (Claude Code)

Add the Unic marketplace once (run inside `claude`):

```
/plugin marketplace add https://github.com/unic/unic-agents-plugins
```

Then install individual plugins:

```
/plugin install pr-review@unic-agent-plugins
/plugin install auto-format@unic-agent-plugins
/plugin install unic-confluence@unic-agent-plugins
/plugin install unic-archon-dlc@unic-agent-plugins
/plugin install unic-pr-review@unic-agent-plugins
```

## Development

**Prerequisites:** Node.js ≥ 22 (see `.nvmrc` for the recommended version), pnpm ≥ 10, Claude Code CLI (for Ralph).

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
├── adr/                  # Architectural Decision Records
├── agents/               # Agent skill documentation (issue-tracker, labels, branching, domain, workflow)
├── inbox/                # Retired idea-capture notes (historical)
├── issues/               # Grilled and scoped feature issues
├── process/              # Process and workflow guides
└── research/             # Research notes and explorations
```

## License

LGPL-3.0-or-later — see [LICENSE](LICENSE).
