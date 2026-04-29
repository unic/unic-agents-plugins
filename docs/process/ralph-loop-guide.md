# Ralph Loop Guide

## What is the Ralph loop?

Ralph Orchestrator is a Claude Code plugin that runs specs from `docs/plans/` one at a time. Each iteration implements one spec, commits, and stops. Re-running the loop picks up the next unfinished spec.

## Key files

- **`ralph.yml`** — Loop configuration: which model to use, which `PROMPT.md` to load, concurrency settings.
- **`PROMPT.md`** — The objective injected into each Ralph iteration. For the monorepo root, it instructs Ralph to scan specs in order and implement the first one not marked `**Status: done**`.

## Starting a loop

From the monorepo root (implements the next pending spec):

```sh
pnpm ralph
```

From inside a plugin directory (runs that plugin's own development loop):

```sh
cd apps/claude-code/pr-review
pnpm ralph
```

## Stopping and resuming

- **Stop early**: `Ctrl+C` — safe at any point; the current spec is left in progress.
- **Resume**: `pnpm ralph` again — Ralph finds the first spec without `**Status: done**` and continues.

## Paused for human review

When Ralph encounters a decision that requires human judgment, it:

1. Adds a `## Questions` section to the bottom of the spec file.
2. Emits `LOOP_COMPLETE`, which pauses the loop.

To resume: answer the question in the spec file, remove the `## Questions` section, then run `pnpm ralph` again.

## Single-spec-per-iteration discipline

Ralph implements **one spec per run**. This keeps commits atomic and makes it easy to review, revert, or re-run a single change. Do not modify `PROMPT.md` to skip this discipline.

## Writing new specs

Use `docs/process/spec-template.md` as the canonical starting point. Register the new spec in `docs/plans/README.md`.
