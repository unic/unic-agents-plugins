# Contributing

This monorepo uses a Feature-driven development workflow. For the full lifecycle — from idea capture through grilling, PRD, issues, execution, and QA — see **[`docs/process/development-workflow.md`](docs/process/development-workflow.md)**.

New features and fixes are tracked as Features in the GitHub issue tracker; a Feature that keeps a durable file set also gets a `docs/issues/<slug>/` directory. Implementation runs either by hand with `/tdd` or `/implement` per issue, or AFK via `/archon-rollout`, which dispatches the native `archon-fix-github-issue` workflow per issue and respects the `## Blocked by` tree.

## Cross-cutting standards

These rules apply to every package in the monorepo, regardless of agent target.

### Cross-platform

Every plugin must work on **macOS, Windows, and Linux**. Concretely:

- Use Node.js APIs (`node:path`, `node:fs`, `node:os`, `node:child_process`) instead of shell commands.
- No `bash`/`sh`/`zsh` assumptions; no POSIX-only path separators hardcoded.
- CI runs Ubuntu + macOS + Windows × Node 22 + 24.

### Runtime

- **Node.js ≥ 22**. The recommended local version lives in `.nvmrc` (read automatically by nvm/fnm/asdf/volta and by `actions/setup-node` in CI). CI also exercises the matrix on Node 22 and 24.
- **ESM only** — `"type": "module"` in every `package.json`; `.mjs` extension for scripts.
- **No TypeScript compilation step** — write `.mjs` with `// @ts-check` + JSDoc; `tsc --noEmit` for type-checking only.

### Package manager

- **pnpm only** — not npm or yarn.
- All devDeps pinned via the workspace catalog (`catalog:` in `devDependencies`).
- Exact versions, no `^` or `~` ranges (`save-exact=true` in `.npmrc`).

### Code style

Enforced by Biome (`pnpm ci:check`) for `.mjs`/`.js`/`.ts`/`.json`/`.css` and Prettier (`pnpm check:md`) for `.md`:

- Tabs for indentation in code files.
- Single quotes, no semicolons, trailing commas ES5-style (Biome).
- Line width 120 (Biome).
- Markdown: Prettier default prose wrap (`preserve`).

### Commits and versioning

- **Conventional commits** with package scope: `feat(pr-review): …`, `fix(auto-format): …`, `chore(release-tools): …`.
- Each plugin maintains its own `CHANGELOG.md` with `[Unreleased]` discipline.
- **`pnpm --filter <name> bump <patch|minor|major>`** is the only way to change a plugin's version. Never hand-edit `marketplace.json`.
- `pnpm --filter <name> verify:changelog` is enforced in CI; it rejects changes without a version bump + CHANGELOG entry.

### Plugin authoring rules

- Zero external runtime deps unless essential (`auto-format` ships zero; `unic-confluence` has `marked` — that's the bar).
- Zero-config from the user's perspective: no configuration files users must create beyond credentials.
- New plugin work enters through the issue tracker as Features — open a Feature before starting implementation.

### License

LGPL-3.0-or-later for all packages in this monorepo.

## Prerequisites

| Tool            | Version                                         | How to get it                            |
| --------------- | ----------------------------------------------- | ---------------------------------------- |
| Node.js         | ≥ 22 (see `.nvmrc` for the recommended version) | [nodejs.org](https://nodejs.org)         |
| pnpm            | ≥ 10                                            | `npm install -g pnpm`                    |
| Claude Code CLI | latest                                          | [claude.ai/code](https://claude.ai/code) |

Everything else (Biome, Prettier, TypeScript) is a workspace devDependency and installs with:

```sh
pnpm install
```

## Starting new work

All work enters through the issue tracker as a Feature. The recommended flow:

1. Capture the idea — open a GitHub Issue directly, or run `/triage` to walk it through the state machine.
2. Chart the work. If it is too big for one agent session, run `/wayfinder`: it maps the open decisions as a `wayfinder:map` issue with child tickets and resolves them one at a time. If it fits in one session, grill it with `/grill-me` or `/grill-with-docs` instead.
3. Create a spec and tickets with `/to-spec` → `/to-tickets`.
4. Implement each issue with `/tdd` or `/implement`, or dispatch a chain of `ready-for-agent` issues with `/archon-rollout`.
5. Open a PR targeting `develop`.

See [`docs/process/development-workflow.md`](docs/process/development-workflow.md) for the full 8-phase lifecycle.

## Verification commands

```sh
pnpm ci:check                          # Biome CI and Prettier check (Prettier for MD)
pnpm check                             # Format check (Biome & Prettier for MD)
pnpm format                            # Format (Biome & Prettier for MD), writes files
pnpm test                              # tests across all packages
pnpm typecheck                         # type-check across all packages
pnpm --filter <name> verify:changelog  # changelog check for one plugin
```
