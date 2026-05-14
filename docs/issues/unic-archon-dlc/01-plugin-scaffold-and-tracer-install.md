# Plugin scaffold and tracer install hook

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

Scaffold the `unic-archon-dlc` plugin at `apps/claude-code/unic-archon-dlc/` with a working install hook that runs end-to-end from `claude /plugin install` and proves the wiring. This is the tracer slice: minimal but complete path through manifest → install hook → on-disk artifacts.

In scope:

- Plugin directory under `apps/claude-code/unic-archon-dlc/` following the same shape as `auto-format`, `pr-review`, `unic-confluence`.
- Manifests: `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Plugin name is `unic-archon-dlc`. Marketplace entry follows the monorepo convention (no hand edits; subsequent slices use `pnpm --filter ... bump`).
- `.archon/workflows/` and `.archon/commands/` directories shipped inside the plugin (empty placeholders accepted — populated by later slices).
- Install hook as an idempotent Node.js script (`.mjs`, ESM, zero external runtime deps) triggered by the Claude Code plugin install mechanism.
- **Setup explorer** module: reads `git remote`, `CLAUDE.md`, `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/`, existing `.archon/` and returns a structured snapshot of what is already configured. Missing files are reported as absent, not errored.
- **Archon binary check**: install hook verifies `archon` is on `PATH`. If missing, exits with a clear error referencing the README dependency note. Also reads `archon --version` and warns if the version is on the known-incompatible list (start with an empty list shipped as a JSON constant — populated as drift is observed).
- **Mandatory question tier only** in this slice: issue tracker (auto-detected from `git remote`; falls back to a prompt), PR strategy (deduced from tracker), branching strategy (Gitflow default, GitHub Flow alternative).
- Already-configured values are shown back to the user and skippable — re-running the hook never overwrites without consent.
- **Outputs:**
  - `.archon/unic-dlc.config.json` (machine-readable) populated with the mandatory tier only.
  - `docs/agents/issue-tracker.md` (human-readable) describing the chosen tracker, its CLI, and the create/update conventions.
- Config loader/validator module: `loadConfig(path)` returns a typed config object or a structured error. Mandatory fields validated; unknown keys ignored.
- Tests (`node:test`, `.mjs`) for config loader (valid parse, missing mandatory fields, unknown keys) and setup explorer (mock project directory snapshot, absent-vs-errored handling).

Out of scope for this slice: label tiers (state/type/priority), e2e command prompt, multi-context detection, remaining `docs/agents/*` files, `CLAUDE.md` block, any workflow YAML or command file contents.

## Acceptance criteria

- [ ] `apps/claude-code/unic-archon-dlc/` exists with valid `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (`pnpm check` and `pnpm typecheck` pass at repo root).
- [ ] Running the install hook against a fresh project writes `.archon/unic-dlc.config.json` with at minimum `{ tracker, pr_strategy, branching }` populated.
- [ ] Running the install hook against a fresh project writes `docs/agents/issue-tracker.md` describing the chosen tracker.
- [ ] Re-running the install hook is idempotent: no overwrites, already-configured values shown and skipped.
- [ ] Missing `archon` binary produces a clear, actionable error and a non-zero exit.
- [ ] Setup explorer returns a structured snapshot for a mock project directory; missing files are reported as absent rather than throwing.
- [ ] `node:test` suite covers config loader (3 cases) and setup explorer (1 case) and passes on macOS, Windows, and Linux paths (use `node:path`).
- [ ] No external runtime deps added to the plugin (`auto-format`-style bar).

## Blocked by

None — can start immediately.
