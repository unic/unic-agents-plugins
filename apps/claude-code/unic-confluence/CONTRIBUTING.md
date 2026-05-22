# Contributing

Contributions start as GitHub Issues in the [unic/unic-agents-plugins](https://github.com/unic/unic-agents-plugins/issues) tracker. Open or claim an issue before starting implementation.

## Prerequisites

| Tool            | Version                                         | How to get it                                                          |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Node.js         | ≥ 22 (see `.nvmrc` for the recommended version) | [nodejs.org](https://nodejs.org)                                       |
| pnpm            | ≥ 10                                            | `npm install -g pnpm`                                                  |
| Claude Code CLI | latest                                          | [claude.ai/code](https://claude.ai/code) — required as Ralph's backend |

Everything else (Ralph Orchestrator, Biome, TypeScript) is a project devDependency and installs with:

```sh
pnpm install
```

**ralph-loop** is a Claude Code plugin and must be installed once globally:

```sh
claude plugins install anthropics/claude-plugins-official/plugins/ralph-loop
```

This registers the `/ralph-loop` skill and the session loop hook in Claude Code.

## Planning

All work starts as a GitHub Issue in [unic/unic-agents-plugins](https://github.com/unic/unic-agents-plugins/issues). Open or claim an issue there before touching code. See [`docs/agents/workflow.md`](../../../../docs/agents/workflow.md) in the repo root for the full seven-phase workflow (triage → specs → implementation → PR → release).

## Implementing

1. Branch from `develop` following the Gitflow naming convention (`feature/<slug>`).
2. Implement the changes described in the issue.
3. Add one bullet under the appropriate `## [Unreleased]` subsection in `CHANGELOG.md`.
4. Run `pnpm bump <patch|minor|major>` to reflect the semantic impact.
5. Run the issue's verification/acceptance criteria. Fix all failures.
6. Commit with a conventional commit message: `feat(unic-confluence): description`.

## Finishing your work

1. Verify everything is clean

   - `pnpm format`: Ensure formatting is correct
   - `pnpm check`: biome lint + format check
   - `pnpm test`: run tests
   - `pnpm typecheck`: type check

2. Bump version + add CHANGELOG entry (config/tooling change = patch)

   - `pnpm bump <patch|minor|major>`

3. Stage and commit
   - `git add -A`
   - `git commit -m "<Convention Commit>"`

The `pnpm bump <patch|minor|major>` step is mandatory — `pnpm verify:changelog` (enforced in CI and the pre-push hook) will reject the commit if source files changed without a version bump and dated CHANGELOG entry.

## Code standards

Ground rules are documented in [`CLAUDE.md`](CLAUDE.md). Key points:

- **Tabs** for indentation, **LF** line endings (enforced by `.editorconfig`)
- **pnpm** — not npm; all scripts use `pnpm run <name>`
- **Conventional commits**: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`
- **No TypeScript build step** — pure ESM Node.js; `// @ts-check` + JSDoc for type safety
- **Every commit bumps the version** — `pnpm bump <type>` before committing any source change

## CI checks

PRs must pass:

```sh
pnpm ci:check        # Biome lint + format
pnpm test            # Node built-in test runner
pnpm verify:changelog  # version bumped + CHANGELOG entry present (available after spec 20)
```

A PR that modifies source or user-facing docs without bumping the version will fail CI.
