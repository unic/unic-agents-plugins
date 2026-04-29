# Contributing

This monorepo uses a spec-driven development workflow. New features and fixes are described in self-contained spec files under `docs/plans/`. Implementation is automated with **Ralph Orchestrator** (recommended) or done by hand following the same steps.

## Cross-cutting standards

These rules apply to every package in the monorepo, regardless of agent target.

### Cross-platform

Every plugin must work on **macOS, Windows, and Linux**. Concretely:

- Use Node.js APIs (`node:path`, `node:fs`, `node:os`, `node:child_process`) instead of shell commands.
- No `bash`/`sh`/`zsh` assumptions; no POSIX-only path separators hardcoded.
- CI runs Ubuntu + macOS + Windows × Node 22 + 24.

### Runtime

- **Node.js ≥ 24** (Active LTS). Version pinned via `pnpm-workspace.yaml#useNodeVersion` and `.nvmrc`.
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

- Zero external runtime deps unless essential (`auto-format` ships zero; `confluence-publish` has `marked` — that's the bar).
- Zero-config from the user's perspective: no configuration files users must create beyond credentials.
- Every plugin uses the spec-driven workflow: `docs/plans/` + `ralph.yml` + `PROMPT.md` per the template in `docs/process/` (coming in spec 05).

### License

LGPL-3.0-or-later for all packages in this monorepo.

## Prerequisites

| Tool            | Version           | How to get it                                                          |
| --------------- | ----------------- | ---------------------------------------------------------------------- |
| Node.js         | ≥ 24 (Active LTS) | [nodejs.org](https://nodejs.org)                                       |
| pnpm            | ≥ 10              | `npm install -g pnpm`                                                  |
| Claude Code CLI | latest            | [claude.ai/code](https://claude.ai/code) — required as Ralph's backend |

Everything else (Ralph Orchestrator, Biome, Prettier, TypeScript) is a workspace devDependency and installs with:

```sh
pnpm install
```

**ralph-loop** is a Claude Code plugin and must be installed once globally:

```sh
claude plugins install anthropics/claude-plugins-official/plugins/ralph-loop
```

## Writing a spec

All work starts with a spec file. See the existing specs under `docs/plans/` for examples.

### 1. Pick a number

Check `docs/plans/README.md` for the current highest spec number. Create `docs/plans/NN-short-slug.md`.

### 2. Required metadata

```markdown
# NN. Title

**Priority:** P0 | P1 | P2
**Effort:** XS | S | M | L
**Version impact:** none | patch (plugin: <name>) | minor (plugin: <name>) | major (plugin: <name>)
**Depends on:** (spec numbers, or "none")
**Touches:** (comma-separated files/dirs)
```

### 3. Required sections

| Section                   | What to write                            |
| ------------------------- | ---------------------------------------- |
| `## Context`              | Why this change is needed                |
| `## Current behaviour`    | Exact code/behaviour _before_ the change |
| `## Target behaviour`     | What it should look like _after_         |
| `## Affected files`       | Table: path → Create / Modify / Delete   |
| `## Implementation steps` | Numbered steps with before → after diffs |
| `## Verification`         | Shell commands + expected output         |
| `## Acceptance criteria`  | Checkbox list                            |
| `## Out of scope`         | Explicit list of things NOT to change    |

Good specs are **self-contained** — Ralph has no memory of prior runs. Include actual code snapshots.

### 4. Register the spec

Add a row to the execution order table in `docs/plans/README.md`.

## Running Ralph

```sh
pnpm ralph
```

Ralph reads `ralph.yml`, which points to `PROMPT.md`. Each iteration implements one spec, commits, and stops. Run `pnpm ralph` again for the next spec.

- **Stop early**: `Ctrl+C`
- **Resume**: `pnpm ralph` again — it finds the first unfinished spec
- **Paused for review**: a `## Questions` section in a spec means Ralph emitted `LOOP_COMPLETE` — answer the question, remove the section, re-run

## Running manually (without Ralph)

Follow the steps in `PROMPT.md` yourself, replacing Ralph's role.

## Running per-plugin Ralph loops

Each plugin also has its own `ralph.yml` + `PROMPT.md` for plugin-specific development. Run from inside the plugin directory:

```sh
cd apps/claude-code/pr-review
pnpm ralph
```

## Verification commands

```sh
pnpm ci:check                          # Biome CI and Prettier check (Prettier for MD)
pnpm check                             # Format check (Biome & Prettier for MD)
pnpm format                            # Format (Biome & Prettier for MD), writes files
pnpm test                              # tests across all packages
pnpm typecheck                         # type-check across all packages
pnpm --filter <name> verify:changelog  # changelog check for one plugin
```
