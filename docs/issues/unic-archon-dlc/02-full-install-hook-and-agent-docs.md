# Full install hook with all config tiers and agent docs

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

Expand the install hook from the tracer slice to cover every configuration tier and write the full `docs/agents/` set. The hook remains idempotent and additive: re-running it fills in only what is missing.

In scope:

- **Skippable tier:** e2e test command. If the user defers, the config records `e2e_command: null` and the hook can fill it in on a later run.
- **Defaulted tier (no prompt unless `--reconfigure`):** model profile (`balanced`), TDD mode (`on`), Nyquist validation (`on`), slopsquatting gate (`on`).
- **Label configuration tier (canonical → tracker string mapping):**
  - **State labels:** `needs-triage` → `needs-info` → `needs-specs` → `ready-for-agent` / `ready-for-human` → `resolved` → `closed` (or `rejected`). Canonical role names match `docs/agents/triage-labels.md` from this repo.
  - **Type labels:** `feature`, `bug`, `spike`, `tech-debt`, `docs`.
  - **Priority labels:** `p0`, `p1`, `p2`, `p3`.
  - Each canonical name is mapped to the actual string used in the project's tracker.
- **Multi-context detection:** if `CONTEXT-MAP.md` exists at repo root, the hook records `repo_layout: "multi-context"` and discovers per-context `CONTEXT.md` paths; otherwise `"single-context"` with the root `CONTEXT.md` path.
- **`docs/agents/` outputs** (write or update — never clobber unrelated content):
  - `issue-tracker.md` — already written in slice 1; expand with backend-specific create/update conventions.
  - `labels.md` — three-tier taxonomy with canonical-to-string mappings for the chosen tracker.
  - `branching.md` — chosen strategy, default branch names, PR target conventions.
  - `domain.md` — single-context vs multi-context layout, CONTEXT.md and ADR locations.
  - `workflow.md` — maps each of the six workflow phases to its artifact outputs and `docs/workflow/` paths.
- **`CLAUDE.md` update:** append (or update in place) an `## Agent skills` block listing each `docs/agents/*.md` file with a one-line hook. If the block already exists, refresh its contents idempotently.
- Reasonable defaults applied automatically when the tracker is local markdown (canonical strings == tracker strings).

Out of scope: workflow YAML or command file contents (later slices).

## Acceptance criteria

- [ ] Fresh install writes all six `docs/agents/*.md` files plus the `## Agent skills` block in `CLAUDE.md`.
- [ ] `.archon/unic-dlc.config.json` includes all label tiers, e2e command (or `null`), defaulted fields, and `repo_layout`.
- [ ] Multi-context repo (with `CONTEXT-MAP.md`) is detected and recorded; single-context repo records the root `CONTEXT.md` path.
- [ ] Re-running the hook after the tracer install adds only missing fields; existing fields are preserved unless `--reconfigure` is passed.
- [ ] If `CLAUDE.md` already has an `## Agent skills` block, it is refreshed without duplicating sections or destroying neighbouring content.
- [ ] Each `docs/agents/*.md` matches the canonical-to-tracker mapping in `.archon/unic-dlc.config.json` (no drift between machine and human readable).
- [ ] Tests cover the canonical-to-tracker mapping for at least the local-markdown and GitHub backends.

## Blocked by

- `docs/issues/unic-archon-dlc/01-plugin-scaffold-and-tracer-install.md`
