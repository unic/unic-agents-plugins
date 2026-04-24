# Contributing

This project uses a spec-driven development workflow. New features and fixes are described in self-contained spec files under `docs/plans/`. Implementation is either automated with **Ralph Orchestrator** (recommended) or done by hand following the same steps.

## Prerequisites

| Tool | Version | How to get it |
|---|---|---|
| Node.js | ≥ 24 (Active LTS) | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 10 | `npm install -g pnpm` |
| Claude Code CLI | latest | [claude.ai/code](https://claude.ai/code) — required as Ralph's backend |

Everything else (Ralph Orchestrator, Biome, TypeScript) is a project devDependency and installs with:

```sh
pnpm install
```

**ralph-loop** is a Claude Code plugin and must be installed once globally:

```sh
claude plugins install anthropics/claude-plugins-official/plugins/ralph-loop
```

This registers the `/ralph-loop` skill and the session loop hook in Claude Code.

## Planning — Writing a spec

All work starts with a spec file. This applies whether you plan to run Ralph or implement manually.

### 1. Pick a number

Check the execution order table in [`docs/plans/README.md`](docs/plans/README.md) for the current highest spec number. Create `docs/plans/NN-short-slug.md` with the next sequential number.

### 2. Fill in the required headers

```markdown
# NN. Title

**Priority:** P0 | P1 | P2
**Effort:** XS | S | M | L
**Version impact:** patch | minor | major
**Depends on:** (spec numbers this must land after, or "none")
**Touches:** (comma-separated list of files/dirs affected)
```

**Version impact** is used by Ralph (and human contributors) to know which `pnpm bump` argument to pass when committing. Follow the SemVer policy in [`docs/plans/README.md`](docs/plans/README.md).

### 3. Fill in the required sections

| Section | What to write |
|---|---|
| `## Context` | Why this change is needed; what problem it solves |
| `## Current behaviour` | Exact code snippets or behaviour *before* the change. Ralph uses this to verify the starting state. |
| `## Target behaviour` | What the code/behaviour should look like *after* |
| `## Affected files` | Table: file path → Create / Modify / Delete |
| `## Implementation steps` | Numbered steps with exact "before → after" diffs or code to write. No ambiguity. |
| `## Verification` | Shell commands to run and their expected output |
| `## Acceptance criteria` | Checkbox list — Ralph checks each item before committing |
| `## Out of scope` | Explicit list of things NOT to change in this spec |

Good specs are **self-contained** — Ralph has no memory of previous runs or conversations. Include actual code snapshots; don't rely on "as discussed".

### 4. Register the spec

In `docs/plans/README.md`:
- Add a row to the **Execution order** table.
- Add any ordering constraints to the **Cross-cutting dependencies** section.

## Implementing with Ralph Orchestrator

Once specs are in place, Ralph implements them one at a time in a loop.

```sh
# From the repo root:
pnpm ralph
```

Ralph reads `ralph.yml`, which points to `PROMPT.md` as its prompt. Each loop iteration:

1. Claude Code scans `docs/plans/` in order and finds the first spec without `**Status: done**`.
2. Reads the spec fully and verifies the "Current behaviour" snapshot matches.
3. Implements the "Implementation steps" exactly.
4. Adds a CHANGELOG entry, runs `pnpm bump <type>`, and runs `pnpm verify:changelog`.
5. Marks the spec `**Status: done — YYYY-MM-DD**` and commits `feat(spec-NN): description (vX.Y.Z)`.
6. Outputs a summary, then stops. Ralph feeds the prompt again for the next spec.

### Stopping and resuming

- **Stop early**: `Ctrl+C`. The current spec may be partially implemented — check `git status` before continuing.
- **Resume**: `pnpm ralph` again. Ralph scans for the first unfinished spec and picks up there.
- **Paused for review**: if a spec has a `## Questions` section, Claude emits `LOOP_COMPLETE` and Ralph stops. Read the question, update the spec with your answer, remove the `## Questions` section, and run `pnpm ralph` again.
- **All done**: when all specs are `**Status: done**`, Claude emits `LOOP_COMPLETE` and Ralph exits.

### After a Ralph run

```sh
git log --oneline   # review what was committed
git push            # push when satisfied
```

Ralph never pushes — that is always a manual step.

### Configuration

The `pnpm ralph` script runs `ralph run -c ralph.yml -H builtin:code-assist`. Key settings (`ralph.yml`):

| Setting / flag | Value | Meaning |
|---|---|---|
| `-c ralph.yml` | config file | Explicit path to the Ralph config (avoids ambiguity if multiple configs exist) |
| `-H builtin:code-assist` | hat | Runs Claude Code in code-assist mode, optimised for implementation tasks |
| `cli.backend` | `claude` | Uses the Claude Code CLI as the underlying agent |
| `event_loop.prompt_file` | `PROMPT.md` | The orchestration prompt fed to Claude on every iteration |
| `event_loop.completion_promise` | `LOOP_COMPLETE` | Sentinel string that ends the loop |
| `event_loop.max_iterations` | `100` | Hard cap on loop iterations |
| `event_loop.max_runtime_seconds` | `14400` | 4-hour safety timeout |

## Implementing manually (without Ralph)

Follow the same steps Ralph would take:

1. Find the first unstarted spec (no `**Status: done**`) in the execution order table.
2. Read the spec fully — check "Depends on" and "Current behaviour" before touching any code.
3. Follow the "Implementation steps" exactly. If the "before" snapshot doesn't match what you see, note the discrepancy in a `## Deviations` section.
4. Add one bullet under the appropriate `## [Unreleased]` subsection in `CHANGELOG.md`.
5. Run `pnpm bump <patch|minor|major>` (matches the spec's `**Version impact:**` line).
6. Run the spec's "Verification" commands. Fix all failures.
7. Check every item in "Acceptance criteria".
8. Mark the spec done — add `**Status: done — YYYY-MM-DD**` as the second line (after the title).
9. Commit everything: `git add -A && git commit -m "feat(spec-NN): description (vX.Y.Z)"`.

## Code standards

Ground rules are documented in [`docs/plans/README.md`](docs/plans/README.md) and [`CLAUDE.md`](CLAUDE.md). Key points:

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
