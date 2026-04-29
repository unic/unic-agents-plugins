# Ralph Orchestrator — unic-claude-code-format Roadmap

You are implementing the roadmap for the `unic-claude-code-format` Claude Code plugin, one spec at a time.

## Step 1 — Determine what's next

Check the execution order in `docs/plans/README.md`. Then scan spec files in order (00 → 11) and find the first file that does NOT contain the string `**Status: done`.

If **all** specs contain `**Status: done**, output exactly:

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
- Use `pnpm` (after spec 00 lands; before it's done use `npm` only for spec 00 itself)
- Tabs for indentation, LF line endings (per `.editorconfig` once it exists)
- Conventional commits: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`
- **Never hand-edit** `.claude-plugin/marketplace.json` version — use `pnpm bump` once available (spec 07)
- If something can't be followed as written: document it in `## Deviations`, don't silently deviate

## Step 4 — Verify

Run the exact commands in the spec's **Verification** section. Fix any failures before proceeding.

Check every item in **Acceptance criteria**. If any item fails, fix it.

## Step 4.5 — Bump version + CHANGELOG

1. Read the spec's `**Version impact:** patch|minor|major` line at the top of the spec file.
   If the line is absent, infer: breaking CLI/contract change → `major`; new flag/feature → `minor`; bug fix, refactor, docs → `patch`.

2. Append **one bullet** to the matching subsection under `## [Unreleased]` in `CHANGELOG.md`, replacing the `- (none)` placeholder on first use:
   - `### Breaking` — on-disk file schema change, plugin-to-hook contract change
   - `### Added` — new feature, new configuration option, new extension support
   - `### Fixed` — bug fix, refactor, docs, internal tooling

3. Once `pnpm bump` is available (spec 07), run it instead of manually editing CHANGELOG.md:
   ```sh
   pnpm bump <patch|minor|major>
   ```
   Until then, manually update `.claude-plugin/plugin.json` version and add the CHANGELOG bullet.

4. If `pnpm verify:changelog` is available (spec 08), run it:
   ```sh
   pnpm verify:changelog
   ```

## Step 5 — Mark done and commit

1. Add this line immediately after the spec's `# NN. Title` heading (as the second line):

```
**Status: done — YYYY-MM-DD**
```

Replace `YYYY-MM-DD` with today's date.

2. Stage and commit all changes:

```sh
git add -A
git commit -m "feat(spec-NN): <short description of what was implemented>"
```

Replace `NN` with the spec number (e.g. `00`, `03`) and write a clear description.

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
