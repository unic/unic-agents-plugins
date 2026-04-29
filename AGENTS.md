# CLAUDE.md & AGENTS.md

Guidance for any AI agent working in this repository. `CLAUDE.md` is a symlink to this file.

## What this repo is

A pnpm workspace monorepo hosting AI agent plugins developed at Unic. Today it contains Claude Code plugins; the structure supports plugins for other agents (GitHub Copilot, etc.) in the future.

## Workspace layout

```tree
apps/
├── claude-code/              # Claude Code plugins — one dir per plugin
│   ├── pr-review/
│   ├── auto-format/
│   └── confluence-publish/
└── copilot/                  # GitHub Copilot plugins (future)
packages/
├── biome-config/             # @unic/biome-config
├── tsconfig/                 # @unic/tsconfig
└── release-tools/            # @unic/release-tools (bump / sync-version / tag / verify-changelog)
docs/
└── plans/                    # Monorepo-level Ralph spec roadmap (specs 00–13)
```

Each plugin under `apps/<agent>/` also has its own `docs/plans/` for plugin-specific future work.

## Navigation

- Plugin manifests: `apps/<agent>/<plugin>/.claude-plugin/plugin.json` and `marketplace.json`
- Shared release scripts: `packages/release-tools/scripts/`
- Monorepo roadmap: `docs/plans/`
- Process templates: `docs/process/`

## Commands

```sh
pnpm install                            # install all workspace deps
pnpm check                              # Biome + Prettier check (whole tree)
pnpm format                             # Biome + Prettier fix (whole tree)
pnpm ci:check                           # same as check, non-interactive (for CI)
pnpm test                               # run tests across all packages
pnpm typecheck                          # type-check across all packages
pnpm ralph                              # run the monorepo Ralph loop (specs 00–13)

# Per-plugin operations (after spec 03 sets up release-tools)
pnpm --filter <name> bump patch         # bump plugin version
pnpm --filter <name> verify:changelog   # check changelog
pnpm --filter <name> ralph              # run that plugin's own Ralph loop
```

## Tech stack

- **Runtime**: Node.js ≥ 24 LTS (pinned `24.15.0` via `.nvmrc` + `pnpm-workspace.yaml`)
- **Package manager**: pnpm 10 (workspace mode, catalog pinning)
- **Module system**: ESM (`"type": "module"`) throughout
- **Linter/formatter**: Biome 2 for code/JSON; Prettier for Markdown only
- **Type checking**: `tsc --checkJs --noEmit` on `.mjs` files; no compilation step
- **Test runner**: `node:test` built-in

## Cross-platform requirement

Every plugin must work on **macOS, Windows, and Linux**. Use Node.js APIs (`node:path`, `node:fs`, `node:os`) instead of shell commands. CI runs all three OSes × Node 22 and 24.

## Code conventions

- Tabs for indentation in `.mjs`/`.js`/`.ts` files; spaces (2) for `.json`/`.yml`/`.yaml`
- Single quotes, no semicolons, trailing commas ES5-style (enforced by Biome)
- Line width 120 (Biome)
- Prettier for Markdown only
- No TypeScript compilation — `// @ts-check` + JSDoc for type safety

## Versioning

Plugins are versioned independently. `plugin.json` is the source of truth. Use `pnpm --filter <name> bump <patch|minor|major>` — never hand-edit `marketplace.json`.

Tag scheme: `<plugin-name>@<version>` (e.g. `auto-format@0.5.9`).

## Conventional commits

Use package scope: `feat(auto-format): …`, `fix(pr-review): …`, `chore(release-tools): …`, `chore(spec-NN): …`.

## Spec-driven development

All work starts with a spec file under `docs/plans/`. Specs follow this format:

```
# NN. Title
**Priority:** / **Effort:** / **Version impact:** / **Depends on:** / **Touches:**
## Context
## Current behaviour
## Target behaviour
## Affected files
## Implementation steps
## Verification
## Acceptance criteria
## Out of scope
```

`pnpm ralph` runs Ralph Orchestrator, which implements specs one at a time in a loop.

## Do not add

- External runtime deps to plugins unless truly essential (`auto-format` has zero; that's the bar)
- Turborepo or other build orchestrators — plain pnpm workspaces is the current choice
- Features not described in an open spec file — open a spec first

## LICENSE files

**Never create, copy, or delete `LICENSE` files.** The maintainer manages these manually in every package and plugin directory. If a spec step or acceptance criterion requires a `LICENSE` file to exist, warn the maintainer to add it themselves before continuing.
