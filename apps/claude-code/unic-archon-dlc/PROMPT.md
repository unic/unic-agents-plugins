# Ralph Orchestrator — unic-archon-dlc Roadmap

You are implementing the roadmap for the `unic-archon-dlc` Claude Code plugin, one spec at a time.

## Step 1 — Determine what's next

Check the execution order in `docs/plans/README.md`. Then scan spec files in order and find the first file that does NOT contain the string `**Status: done`.

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

Check the spec's `**Version impact:**` line to choose the implementation approach:

**`none` (workspace/infrastructure spec)** — implement directly. Follow the "Implementation steps" exactly.

**`patch` / `minor` / `major` (plugin spec)** — use `/tdd` to drive implementation. Treat the spec's "Implementation steps" as guidance; the spec's **Acceptance criteria** are the target.

Ground rules:

- Use `pnpm` for all package operations
- Tabs for indentation in `.mjs` files, 2-space for `.json`/`.yml`/`.yaml`
- Conventional commits: `feat(unic-archon-dlc): description`
- Cross-platform: use `node:path`, `node:fs`, `node:os` instead of shell commands
- Never hand-edit `.claude-plugin/marketplace.json` version — use `pnpm bump`

## Step 4 — Verify

Run the exact commands in the spec's **Verification** section. Fix any failures before proceeding.

Check every item in **Acceptance criteria**. If any item fails, fix it.

Then run repo hygiene checks:

```sh
pnpm -w check   # Biome + Prettier (workspace root)
```

## Step 5 — Mark done and commit

1. Add this line immediately after the spec's `# NN. Title` heading:

```
**Status: done — YYYY-MM-DD**
```

2. Stage and commit all changes:

```sh
git add -A
git commit -m "feat(unic-archon-dlc): <short description> (v<version>)"
```

3. **Do not push.** Commits only.

## Step 6 — Stop for this iteration

Output a brief summary of what was implemented and committed. Then stop — Ralph will feed this prompt again for the next spec.

---

## Important constraints

- Implement **one spec per iteration**. Do not implement multiple specs in a single run.
- Do not create files outside of what the spec describes.
- Do not modify spec files except to add `**Status: done**`, `## Deviations`, or `## Questions` sections.
