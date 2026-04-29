# Ralph Orchestrator — unic-agents-plugins Roadmap

You are implementing the roadmap for the `unic-agents-plugins` monorepo, one spec at a time.

## Step 1 — Determine what's next

Check the execution order in `docs/plans/README.md`. Then scan spec files in order (00 → 13) and find the first file that does NOT contain the string `**Status: done`.

If **all** specs contain `**Status: done`, output exactly:

```
<promise>LOOP_COMPLETE</promise>
```

…and stop. Do nothing else.

## Step 2 — Read the spec completely

Read the entire spec file before writing any code. Pay special attention to:

- **Current behaviour** — verify the code actually works this way before starting; if it doesn't, add a `## Deviations` section at the bottom of the spec file documenting the discrepancy
- **Out of scope** — list of things you must NOT change in this iteration
- **Depends on** — if a dependency spec is not yet marked done, skip this spec and move to the next one that can be done

## Step 3 — Implement

Follow the "Implementation steps" exactly. If a step's "before" snapshot doesn't match the current file, consult the "Deviations" section (if you wrote one) or document the discrepancy and adapt minimally.

Ground rules (from `docs/plans/README.md`):

- Use `pnpm` for all package operations (not `npm`)
- Tabs for indentation in `.mjs`/`.js`/`.ts` files, spaces for `.json`/`.yml`/`.yaml` (per `.editorconfig`)
- Conventional commits: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`
- Cross-platform: use Node.js APIs (`node:path`, `node:fs`, `node:os`) instead of shell commands; no bash/sh assumptions
- If something can't be followed as written: document it in `## Deviations`, don't silently deviate

## Step 4 — Verify

Run the exact commands in the spec's **Verification** section. Fix any failures before proceeding.

Check every item in **Acceptance criteria**. If any item fails, fix it.

## Step 4.5 — Version bump (conditional)

Check the spec's `**Version impact:**` line:

**`none` (workspace/infrastructure spec)** — skip this step entirely. No CHANGELOG update. Proceed to Step 5.

**`patch` / `minor` / `major` (plugin: `<name>`)** — bump the specified plugin:

1. Append one bullet under the matching subsection of `## [Unreleased]` in `apps/claude-code/<name>/CHANGELOG.md`:

   - `### Breaking` — CLI flag change, exit-code change, on-disk schema change
   - `### Added` — new flag, subcommand, or user-visible feature
   - `### Fixed` — bug fix, refactor, docs, internal tooling

2. Run: `pnpm --filter <name> bump <patch|minor|major>`

3. Run: `pnpm --filter <name> verify:changelog`

## Step 5 — Mark done and commit

1. Add this line immediately after the spec's `# NN. Title` heading (as the second line):

```
**Status: done — YYYY-MM-DD**
```

Replace `YYYY-MM-DD` with today's date.

2. Stage and commit all changes using the appropriate prefix:

- **Workspace specs** (version impact: none): `git commit -m "chore(spec-NN): <short description>"`
- **Plugin specs** (version impact: patch/minor/major): `git commit -m "feat(spec-NN): <short description> (vX.Y.Z)"`
- **Migration specs** (05–07): the `git merge --allow-unrelated-histories` creates a first commit; any post-merge fixups go in a second commit: `git commit -m "feat(spec-NN): finalize <plugin> migration"`

3. **Do not push.** Commits only.

## Step 6 — Stop for this iteration

Output a brief summary of what was implemented and committed. Then stop — Ralph will feed this prompt again for the next spec.

---

## Important constraints

- Implement **one spec per iteration**. Do not implement multiple specs in a single run.
- If a spec requires human judgment (e.g. choosing between two design approaches not covered by the spec), stop, document the question in a `## Questions` section at the bottom of the spec file, and output:
  ```
  <promise>LOOP_COMPLETE</promise>
  ```
  This pauses the loop for human review.
- Do not create any files outside of what the spec describes.
- Do not modify any spec files except to add `**Status: done**`, `## Deviations`, or `## Questions` sections.
