# Ralph driver — `unic-pr-review` re-review feature

You are implementing the **re-review** capability for the `unic-pr-review` plugin, one spec at a time.

## Step 1 — Determine what's next

Open `docs/plans/README.md`. Scan spec files in order (00 → 09) and find the first file whose status is **not** `done`.

If **all** specs contain `**Status: done**`, output exactly:

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

Make the smallest set of edits that fully satisfies the spec's _Acceptance criteria_.

Ground rules:

- Use `pnpm` for all package operations
- Tabs for indentation, LF line endings (per `.editorconfig`)
- Conventional commits: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`
- Cross-platform: use Node.js APIs (`node:path`, `node:fs`, `node:os`) instead of shell commands; no bash/sh assumptions
- Don't refactor outside the spec's _Touches_ list
- Don't invent new specs; if you find missing work, add a `## Follow-ups` line to the current spec and surface it in `docs/plans/README.md` under "Discovered work"
- If something can't be followed as written: document it in `## Deviations`, don't silently deviate

## Step 4 — Verify

Run the exact commands in the spec's **Verification** section. Fix any failures before proceeding.

Check every item in **Acceptance criteria**. If any item fails, fix it.

## Step 4.5 — Version bump (conditional)

Check the spec's `**Version impact:**` line:

**`none`** — skip this step entirely. No CHANGELOG update. Proceed to Step 5.

**`patch` / `minor` / `major`** — bump the plugin:

1. Append one bullet under the matching subsection of `## [Unreleased]` in `CHANGELOG.md`:

   - `### Breaking` — CLI flag change, exit-code change, on-disk schema change
   - `### Added` — new flag, subcommand, or user-visible feature
   - `### Fixed` — bug fix, refactor, docs, internal tooling

2. Run: `pnpm bump <patch|minor|major>`

   This atomically increments `plugin.json` version, mirrors into `marketplace.json`, and promotes `[Unreleased]` → a new dated section.

3. Run `pnpm verify:changelog` to confirm the check passes.

## Step 5 — Mark done and commit

1. Add this line immediately after the spec's `# NN. Title` heading (as the second line):

```
**Status: done — YYYY-MM-DD**
```

Replace `YYYY-MM-DD` with today's date.

2. Stage and commit all changes:

- **`none` specs**: `git commit -m "chore(spec-NN): <short description>"`
- **`patch`/`minor`/`major` specs**: `git commit -m "feat(spec-NN): <short description> (vX.Y.Z)"`

Replace `NN` with the spec number (e.g. `00`, `03`).
Replace `X.Y.Z` with the version output by `pnpm bump`.

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
- Do not modify any spec files except to add `**Status: done**`, `## Deviations`, `## Questions`, or `## Follow-ups` sections.
- Never edit `CLAUDE.md`'s rule list silently — propose the change in the spec instead.
