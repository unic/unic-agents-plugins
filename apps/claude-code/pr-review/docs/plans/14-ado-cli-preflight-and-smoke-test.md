# 14. ADO CLI preflight hardening + smoke test

- Priority: P1
- Effort: S
- Version impact: patch (test addition + preflight expansion; no user-visible behaviour change)
- Depends on: —
- Touches: `commands/review-pr.md` (Step 3), new `tests/ado-cli-smoke.test.mjs`, new `tests/fixtures/ado-cli-inventory.mjs`, new `tests/fixtures/ado-cli-allowlist.mjs`, `.github/workflows/ci.yml` (install `azure-cli` on one matrix cell), `CLAUDE.md`, `docs/plans/README.md`, `CHANGELOG.md`

## Context

The 2026-05-14 dry-run failed at multiple `az` calls: `az repos pr thread list` (does not exist), `az repos pr show --project` (unsupported flag), `az repos pr list-files` (does not exist). Spec 12 fixes the orchestrator's broken Step 4, but the underlying class of failure — Microsoft renaming or removing `az` subcommands without us noticing — remains uncovered.

ADR 0008 keeps `pr-review` as a self-contained plugin (no skill-level dependencies). The cost of self-containment is that every `az` command the plugin uses is hand-authored in agent prompts. Today there is no test that asserts these commands resolve to something the installed `az` extension actually knows.

A CI smoke test that runs `--help` against every `--area` / `--resource` pair the plugin uses fails fast on Microsoft's rename / removal, before a production PR review trips on it.

## Current behaviour

- Step 3 preflight runs `az --version` and `az extension list | grep azure-devops`.
- Nothing asserts that specific subcommands or resources are available.
- A typo (`thread list` vs `pr thread show`) or a Microsoft rename surfaces only at production-time when the orchestrator tries to use the broken command.

## Target behaviour

- Step 3 preflight additionally runs `az devops invoke --help` and asserts exit code 0. If it fails (e.g. extension installed but corrupted): stop with `ERROR: az devops invoke unavailable. Re-install the azure-devops extension: az extension remove --name azure-devops && az extension add --name azure-devops`.
- A new test file `tests/ado-cli-smoke.test.mjs` enumerates every `az` command the plugin uses and runs `--help` (or `az devops invoke --area X --resource Y --help`) for each. Test fails if any call exits non-zero or its help text does not include the expected `--route-parameters` hint.
- The test is gated on `az` being installed locally / in CI. If not installed, it skips (not fails).
- `CLAUDE.md` gets a "Canonical ADO commands" section enumerating the same set of commands, so the inventory is humans-readable and human-greppable. The test file imports from a tiny shared inventory file (`tests/fixtures/ado-cli-inventory.mjs`) so the test and the doc cannot drift.

## Affected files

| File | Change |
|---|---|
| `commands/review-pr.md` | Step 3: add `az devops invoke --help` assertion. |
| `tests/fixtures/ado-cli-inventory.mjs` | New file. Exports `adoCliInventory` — an array of `{ kind: 'invoke'|'repos'|'boards', area?, resource?, command, helpKeywordsRequired: string[] }` entries. |
| `tests/ado-cli-smoke.test.mjs` | New file. Two test cases: (1) **Inventory completeness** — grep every `az ` invocation in `agents/`, `commands/`, `scripts/`; assert each unique command shape (modulo the allowlist below) has a matching inventory entry. Pure-JS; runs everywhere, no `az` skip. (2) **CLI smoke** — iterates `adoCliInventory`; runs the corresponding `--help` command via `node:child_process`; asserts exit 0 and that each `helpKeywordsRequired` substring appears in stdout. Skips with `t.skip` when `az` is unavailable. |
| `tests/fixtures/ado-cli-allowlist.mjs` | New file. Exports `ADO_CLI_ALLOWLIST` — regex patterns for `az` invocations that are intentionally NOT in the inventory: `az --version`, `az extension list`, error-message-only hints (`az devops login`, `az extension add`), and the preflight `az devops invoke --help` itself. The completeness check uses this allowlist to filter out registered exceptions. |
| `CLAUDE.md` | Add a single pointer paragraph (no command table) in the "External dependencies" or "Command conventions" area: *"All `az` commands the plugin uses are enumerated in `tests/fixtures/ado-cli-inventory.mjs`. The smoke test asserts every `az ` invocation in `agents/`/`commands/`/`scripts/` has a matching inventory entry (modulo the allowlist in `tests/fixtures/ado-cli-allowlist.mjs`). Register a new ADO call in the inventory before invoking it."* No table — the inventory file is the single source of truth, and a mirrored table would silently drift.|
| `docs/plans/README.md` | Add row 14. |
| `CHANGELOG.md` | `### Changed` entry under `[Unreleased]`: *Preflight now verifies `az devops invoke` is callable; CI smoke test asserts every ADO subcommand the plugin uses exists.* |

## Implementation steps

### 1. Create `tests/fixtures/ado-cli-inventory.mjs`

Export an array. Initial entries (matches what the plugin uses today after spec 12):

```js
export const adoCliInventory = [
  { kind: 'repos', command: ['az', 'repos', 'pr', 'show', '--help'], helpKeywordsRequired: ['--id', '--org'] },
  { kind: 'repos', command: ['az', 'repos', 'pr', 'checkout', '--help'], helpKeywordsRequired: ['--id', '--org'] },
  { kind: 'invoke', area: 'git', resource: 'pullRequestThreads', command: ['az', 'devops', 'invoke', '--area', 'git', '--resource', 'pullRequestThreads', '--help'], helpKeywordsRequired: ['--route-parameters'] },
  { kind: 'invoke', area: 'git', resource: 'pullRequestIterations', command: ['az', 'devops', 'invoke', '--area', 'git', '--resource', 'pullRequestIterations', '--help'], helpKeywordsRequired: ['--route-parameters'] },
  { kind: 'invoke', area: 'git', resource: 'pullRequestIterationChanges', command: ['az', 'devops', 'invoke', '--area', 'git', '--resource', 'pullRequestIterationChanges', '--help'], helpKeywordsRequired: ['--route-parameters'] },
  { kind: 'invoke', area: 'git', resource: 'pullRequestWorkItems', command: ['az', 'devops', 'invoke', '--area', 'git', '--resource', 'pullRequestWorkItems', '--help'], helpKeywordsRequired: ['--route-parameters'] },
  { kind: 'invoke', area: 'git', resource: 'pullRequestThreadComments', command: ['az', 'devops', 'invoke', '--area', 'git', '--resource', 'pullRequestThreadComments', '--help'], helpKeywordsRequired: ['--route-parameters'] },
  { kind: 'boards', command: ['az', 'boards', 'work-item', 'show', '--help'], helpKeywordsRequired: ['--id', '--org'] },
]
```

### 2. Create `tests/ado-cli-smoke.test.mjs`

`node:test` style, ESM, `// @ts-check` header. For each inventory entry:

- Run the command via `child_process.spawnSync` with a 5-second timeout.
- If `spawnSync` reports `ENOENT` (i.e. `az` not installed): call `t.skip('az CLI not installed')` and stop.
- Otherwise assert exit code 0 and that every `helpKeywordsRequired` substring appears in stdout.

Mirror the prior-art style of `tests/parse-diff-hunks.test.mjs`.

### 3. Update Step 3 in `commands/review-pr.md`

Append to Step 3:

```bash
if ! az devops invoke --help >/dev/null 2>&1; then
  echo "ERROR: az devops invoke unavailable. Re-install the azure-devops extension: az extension remove --name azure-devops && az extension add --name azure-devops" >&2
  exit 1
fi
```

### 4. Update `CLAUDE.md`

Append a single pointer paragraph (no command table) to the "External dependencies" section:

```markdown
All `az` commands the plugin uses are enumerated in `tests/fixtures/ado-cli-inventory.mjs`. The smoke test (`tests/ado-cli-smoke.test.mjs`) asserts every `az ` invocation in `agents/`/`commands/`/`scripts/` has a matching inventory entry — modulo the allowlist in `tests/fixtures/ado-cli-allowlist.mjs`. Register a new ADO call in the inventory before invoking it.
```

A mirrored command table here was considered and rejected — it would be a third source of truth that drifts silently from the inventory and the source code.

### 5. Update READMEs and CHANGELOG

- `docs/plans/README.md`: add row 14.
- `CHANGELOG.md`: `### Changed` entry as described.

## Verification

- Run `pnpm --filter pr-review test` locally with `az` installed: smoke test passes (completeness test always runs, CLI smoke test runs when `az` is on PATH).
- Run in CI: the inventory-completeness test runs on every matrix cell. The CLI smoke test only runs on the `ubuntu-latest × Node 24` cell, where `azure-cli` + the `azure-devops` extension are installed via a dedicated workflow step. Other cells `t.skip` the CLI smoke test cleanly.
- Remove a known-good entry from the inventory and rerun: no change (inventory is reduced — test still passes; nothing forces inventory completeness).
- Add a known-bad entry (`{ kind: 'repos', command: ['az', 'repos', 'pr', 'thread', 'list', '--help'], ... }`): test fails with non-zero exit and informative output.
- Uninstall `az` locally and rerun: test skips, does not fail.

## Acceptance criteria

- [ ] `tests/fixtures/ado-cli-inventory.mjs` exists and lists every `az` command the plugin uses post-spec-12.
- [ ] `tests/ado-cli-smoke.test.mjs` runs `--help` for every inventory entry and asserts exit 0 + keyword presence.
- [ ] `tests/ado-cli-smoke.test.mjs` also asserts inventory completeness: every `az` invocation in `agents/`, `commands/`, `scripts/` either has an inventory entry or matches an allowlist regex. This test does not require `az` and runs everywhere.
- [ ] `tests/fixtures/ado-cli-allowlist.mjs` documents the allowlist regexes inline (each entry has a one-line comment explaining why it is exempt).
- [ ] Smoke test skips (not fails) when `az` is absent. Completeness test still runs.
- [ ] Step 3 in `commands/review-pr.md` asserts `az devops invoke --help` exits 0.
- [ ] `CLAUDE.md` has a "Canonical ADO commands" section pointing at the inventory.
- [ ] CI passes on Linux, macOS, Windows × Node 22, 24. The CLI smoke test executes only on `ubuntu-latest × Node 24` (where `azure-cli` is installed); other cells skip it. The inventory-completeness test runs on every cell.
- [ ] `.github/workflows/ci.yml` has a single conditional install step (`if: matrix.os == 'ubuntu-latest' && matrix.node == 24`) that installs `azure-cli` via `apt` and adds the `azure-devops` extension. No install on the other five matrix cells.

## Out of scope

- Replacing `az` with direct REST calls. Considered and rejected (token acquisition + corporate TLS-inspecting proxies are exactly what `az` handles).
- Invoking the global `azure-devops-cli` skill from the plugin. ADR 0008 keeps `pr-review` self-contained; a global skill is the wrong abstraction layer.
- Validating ADO REST API responses against schemas. Future work if response drift becomes a real failure mode.
