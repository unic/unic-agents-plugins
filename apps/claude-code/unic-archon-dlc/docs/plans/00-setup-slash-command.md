# 00. Setup slash command

- Priority: P1
- Effort: M
- Version impact: minor (replaces the manual install path with a first-class slash command)
- Depends on: —
- Touches: `commands/setup.md` (new), `lib/install-runner.mjs` (new), `lib/archon-check.mjs` (new), `hooks/install.mjs` (deleted), `.claude-plugin/plugin.json`, `README.md`, `CHANGELOG.md`, `docs/adr/0001-setup-as-slash-command.md`, `docs/adr/README.md` (new), `docs/plans/README.md` (new), `CONTEXT.md` (already updated)

## Context

The plugin advertises a slash-command-first install flow (`README.md:135` shows `/unic-dlc-install`) but no slash commands exist at the plugin root yet. The current entry point is `hooks/install.mjs`, a readline script declared under `"hooks": { "install": ... }` in `plugin.json` — but Claude Code does not auto-execute install hooks, so users must run `node ${CLAUDE_PLUGIN_ROOT}/hooks/install.mjs` from a terminal. That path is undocumented in the README and not the experience users expect after installing a Claude Code plugin.

This spec ships the first real slash command for unic-archon-dlc and the precedent for the other six workflow commands when they migrate from `.archon/commands/` (Archon workflow templates) to actual Claude Code slash commands. The architectural shape — slash command delegates to a pure lib module, no terminal CLI wrapper — is locked by [ADR-0001](../adr/0001-setup-as-slash-command.md).

## Current behaviour

- `hooks/install.mjs` exists as an interactive readline script with four behaviours: fresh-install (ask all), partial-fill (ask missing only), already-configured (print and exit), and `--reconfigure` (re-prompt all).
- The script runs `checkArchon()` first (preflight + known-incompatible-versions warning) and exits with code 1 on missing binary.
- It calls `exploreProject()` to auto-detect git remote, then `loadConfig()` for any existing config, then prompts with `node:readline/promises`.
- After collection it writes `.archon/unic-dlc.config.json`, calls `writeAgentDocs()` to generate `docs/agents/*.md`, and calls `updateAgentSkillsBlock()` to merge a marker-delimited `## Agent skills` block into `CLAUDE.md`.
- `plugin.json` declares `"hooks": { "install": "hooks/install.mjs" }`. Claude Code does not execute this hook on plugin install.
- No `commands/` directory exists at the plugin root; no slash command is registered for the plugin.
- The README's quick-start advertises `/unic-dlc-install` — this command does not exist.

## Target behaviour

- A `commands/setup.md` slash command exists and is invoked as `/unic-archon-dlc:setup`.
- The command conducts the configuration conversation (tracker / branching / e2e command); it does not write files directly.
- Filesystem writes are delegated to `lib/install-runner.mjs`, exporting `runInstall(projectDir, partialAnswers)`. The function merges `{ ...defaults, ...existing, ...partialAnswers }` (matching `hooks/install.mjs:146`), enforces the mandatory-fields invariant after merge (throws a typed error if absent), and writes config + agent docs + CLAUDE.md block in the same order and with the same per-step error semantics as the existing hook.
- Archon preflight is performed by `lib/archon-check.mjs`, exporting a pure `checkArchon()` returning `{ ok: true, version } | { ok: false, code: 'enoent' | 'incompatible' | 'other', message }`. No `process.exit`. The slash command runs this first and bails with the friendly message on `ok: false`.
- Idempotency follows the hybrid model from the design grilling: fresh→ask-all; partial→ask-only-missing; full + no args→print summary and exit; `setup reconfigure`→re-prompt-all; `setup <free-form intent>`→targeted tweak via conversational interpretation.
- `hooks/install.mjs` is deleted; the `"hooks"` field is removed from `plugin.json`.
- `README.md` quick-start references `/unic-archon-dlc:setup`, not `/unic-dlc-install`.
- `CHANGELOG.md` has an `Added` / `Removed` entry under `[Unreleased]`.

## Affected files

| File | Change |
|---|---|
| `commands/setup.md` | New. Thin orchestrator markdown: argument parse, archon preflight, config discovery, conversational prompting, `runInstall` invocation, friendly result rendering. |
| `lib/install-runner.mjs` | New. Extract the post-prompt body of `hooks/install.mjs:128–187` into `runInstall(projectDir, partialAnswers)`. Pure with respect to user input; performs I/O on disk only. Includes `repo_layout` detection (from `detectRepoLayout`) and the default labels lookup. |
| `lib/archon-check.mjs` | New. Extract `hooks/install.mjs:44–67` into a result-returning function. Move `INCOMPATIBLE_ARCHON_VERSIONS` into the module. |
| `test/install-runner.test.mjs` | New. Covers fresh / partial / full / reconfigure paths; mandatory-field enforcement; merge precedence. |
| `test/archon-check.test.mjs` | New. Covers `enoent`, version OK, version-incompatible, generic error. |
| `hooks/install.mjs` | Delete. |
| `.claude-plugin/plugin.json` | Remove the `"hooks"` field. |
| `README.md` | Replace `/unic-dlc-install` (and its surrounding paragraph at lines 131–140) with `/unic-archon-dlc:setup`. Drop mentions of "install hook"; describe the slash command. |
| `CHANGELOG.md` | `Added: /unic-archon-dlc:setup slash command.` `Removed: hooks/install.mjs and "hooks" field from plugin.json.` |
| `docs/adr/README.md` | New. Index file listing ADR-0001. |
| `docs/plans/README.md` | New. Index file listing this spec. |
| `CONTEXT.md` | Already updated with Setup, Claude Code slash command, and Archon workflow command template entries. |

## Implementation steps

1. **Extract `lib/archon-check.mjs`.** Copy the body of `checkArchon()`, replace `process.exit(1)` with a returned result object, move `INCOMPATIBLE_ARCHON_VERSIONS` into the module. Add `test/archon-check.test.mjs` covering the four result branches via a stubbable `execFileSync`.
2. **Extract `lib/install-runner.mjs`.** Move the merge logic (`hooks/install.mjs:135–187`) into `runInstall(projectDir, partialAnswers)`. The function does *not* prompt and does *not* call `checkArchon` — both are the slash command's responsibility. It reads existing config via `loadConfig`, performs the merge, validates mandatory fields, writes config, calls `writeAgentDocs`, calls `updateAgentSkillsBlock`. Returns `{ ok: true, configPath, wroteDocs, wroteClaudeMd } | { ok: false, stage, message }`. Add `test/install-runner.test.mjs`.
3. **Write `commands/setup.md`.** The markdown should: parse `$ARGUMENTS` for `reconfigure` or free-form intent; run `checkArchon` and bail with the friendly message on failure; call `exploreProject` and `loadConfig` to discover state; branch on (existing-config × arguments) per the hybrid idempotency table; collect any needed answers via conversational prompts; call `runInstall(cwd, answers)`; print the success summary or the staged-error message. Reference ADR-0001 in a one-line note at the top.
4. **Delete `hooks/install.mjs`.** Remove the file. There is no migration shim — the readline path was never documented in the README.
5. **Remove `"hooks"` from `.claude-plugin/plugin.json`.**
6. **Update `README.md`.** Replace the quick-start `/unic-dlc-install` block with a `/unic-archon-dlc:setup` block. Remove references to "install hook" elsewhere in the file.
7. **Add `CHANGELOG.md` entries** under `[Unreleased]`.
8. **Create the two index files** (`docs/adr/README.md`, `docs/plans/README.md`) so the directories have discoverable contents.

## Verification

- `pnpm --filter unic-archon-dlc test` passes (covers both new lib modules).
- `pnpm typecheck` passes (no JSDoc regressions).
- `pnpm ci:check` passes (Biome + Prettier).
- Manual smoke test in a clean target project:
  - `/unic-archon-dlc:setup` on a fresh project → asks three questions → `.archon/unic-dlc.config.json`, `docs/agents/*.md`, and `CLAUDE.md` `## Agent skills` block all present.
  - `/unic-archon-dlc:setup` re-run with full config → prints current values, exits without writing.
  - `/unic-archon-dlc:setup reconfigure` → re-prompts all three questions, overwrites config.
  - `/unic-archon-dlc:setup` with `archon` removed from PATH → friendly "archon not on PATH" message, no partial writes.
  - `/unic-archon-dlc:setup change branching to github-flow` (full config existing) → updates one field, leaves others, writes config.

## Acceptance criteria

- `commands/setup.md` exists and is the only documented entry point for configuring the plugin.
- `hooks/install.mjs` no longer exists.
- `plugin.json` has no `hooks` field.
- `lib/install-runner.mjs` and `lib/archon-check.mjs` exist with tests, both pass.
- The merge precedence in `runInstall` is `defaults < existing < partialAnswers`, matching the deleted hook byte-for-byte for that block.
- `runInstall` throws a typed error (not `process.exit`) when mandatory fields are missing after merge.
- `checkArchon` returns a result object (not `process.exit`) for every branch.
- README quick-start references `/unic-archon-dlc:setup`.
- CHANGELOG has `Added` and `Removed` entries.
- ADR-0001 is referenced from `commands/setup.md` and `docs/adr/README.md`.

## Out of scope

- Migrating `.archon/commands/*` (Archon workflow templates) into Claude Code slash commands at `commands/`. Separate spec.
- Wiring archon preflight into workflow commands. ADR-0001 explicitly leaves preflight in setup only.
- `.gitignore` changes for `.archon/`. Config is team config and presumed committed; transient state lives under `$ARTIFACTS_DIR`.
- A non-interactive CLI wrapper around `runInstall()` for CI/scripted use. If a future caller needs it, a 5-line `bin/setup-cli.mjs` is trivial; do not pre-build for it.
- Changing the slash command name later (e.g. `:configure` or `:init`). Locked in ADR-0001 / Q4 of the grilling session.
