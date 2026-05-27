# 02. ADO CLI inventory + completeness test + smoke test + preflight

**Status:** ready-for-agent
**Category:** enhancement
**Plugin:** `apps/claude-code/pr-review`
**Type:** AFK

## Parent

`apps/claude-code/pr-review/docs/issues/pr-review-ado-fetcher-step4-fix/PRD.md`

## What to build

Add a single source of truth for every `az` command the plugin uses, plus two automated checks that prevent silent drift between source code and that inventory. The motivation is timeless: Microsoft renames or removes `az` subcommands without notice (the original Step 4 bug from Slice 01 is exactly this failure class, just hand-coded against an invalid command from the start).

Implementation cuts through every layer:

- **`tests/fixtures/ado-cli-inventory.mjs`** (new) — exports `adoCliInventory`, an array of `{ kind: 'invoke' | 'repos' | 'boards', area?, resource?, command: string[], helpKeywordsRequired: string[] }` entries. Initial entries cover everything the plugin uses post-Slice-01: `az repos pr show`, `az repos pr checkout`, `az boards work-item show`, and `az devops invoke --area git --resource {pullRequestThreads | pullRequestIterations | pullRequestIterationChanges | pullRequestWorkItems | pullRequestThreadComments}`.

- **`tests/fixtures/ado-cli-allowlist.mjs`** (new) — exports `ADO_CLI_ALLOWLIST`, regex patterns for `az` invocations intentionally NOT in the inventory: `az --version`, `az extension list`, error-message-only hints like `az devops login` and `az extension add`, and the preflight `az devops invoke --help`. Each entry carries an inline comment explaining its exemption.

- **`scripts/ado/cli-completeness.mjs`** (new — follows the `scripts/ado/` deep-helper pattern PRD A established) — exports `findUninventoriedCommands({ sources, inventory, allowlist }) → string[]`. Pure function; takes source-file contents (not paths) and returns the list of unregistered `az` command shapes. Must handle multi-line bash blocks, backslash continuations, and `--area`/`--resource` flags split across lines.

- **`tests/ado-cli-completeness.test.mjs`** (new) — fixture-style unit tests for `findUninventoriedCommands`: empty source, single inline command, multi-line bash with backslash continuation, `--area`/`--resource` split across lines, allowlist filtering, mixed allowlisted + inventoried + uninventoried. Mirrors the `tests/parse-diff-hunks.test.mjs` style.

- **`tests/ado-cli-smoke.test.mjs`** (new) — two test cases:

  1. **Inventory completeness** — reads `agents/`, `commands/`, `scripts/` source files via `fs.readFileSync`; calls `findUninventoriedCommands` with the real inventory + allowlist; asserts the returned array is empty. Pure-JS; runs everywhere.
  2. **CLI smoke** — iterates `adoCliInventory`; runs each entry's `--help` via `child_process.spawnSync` with a 5s timeout; asserts exit 0 and that every `helpKeywordsRequired` substring appears in stdout. On `ENOENT` (i.e. `az` not on PATH): `t.skip('az CLI not installed')`.

- **Orchestrator Step 3 preflight (`commands/review-pr.md`)** — append after the existing `az --version` / `az extension list` checks: `if ! az devops invoke --help >/dev/null 2>&1; then echo "ERROR: az devops invoke unavailable. Re-install: az extension remove --name azure-devops && az extension add --name azure-devops" >&2; exit 1; fi`.

- **CI workflow (`.github/workflows/ci.yml`)** — add a single conditional step (`if: matrix.os == 'ubuntu-latest' && matrix.node == 24`) that installs `azure-cli` via `apt` and adds the `azure-devops` extension. Other matrix cells skip the CLI smoke test cleanly via the `t.skip` path; the completeness test runs everywhere.

- **`apps/claude-code/pr-review/AGENTS.md`** — append a single pointer paragraph to the "External dependencies" section: _"All `az` commands the plugin uses are enumerated in `tests/fixtures/ado-cli-inventory.mjs`. The smoke test (`tests/ado-cli-smoke.test.mjs`) asserts every `az ` invocation in `agents/`/`commands/`/`scripts/` has a matching inventory entry — modulo the allowlist in `tests/fixtures/ado-cli-allowlist.mjs`. Register a new ADO call in the inventory before invoking it."_ No mirrored command table.

- **CHANGELOG** — `[Unreleased]` `### Changed` entry: _Preflight now verifies `az devops invoke` is callable; CI smoke test asserts every ADO subcommand the plugin uses exists._

End-to-end demoable: `pnpm --filter pr-review test` passes locally with `az` installed (smoke test runs) and without `az` (smoke test skips, completeness test still runs). Deliberately adding an unregistered `az` call to any agent → completeness test fails. Adding a known-bad inventory entry (e.g. `az repos pr thread list`) → CLI smoke test fails with the `az` rename / removal as the surfaced reason.

## Acceptance criteria

- [ ] `tests/fixtures/ado-cli-inventory.mjs` exists and lists every `az` command the plugin uses post-Slice-01 (including `pullRequestThreads` introduced there).
- [ ] `tests/fixtures/ado-cli-allowlist.mjs` exists; each entry has an inline comment explaining the exemption.
- [ ] `scripts/ado/cli-completeness.mjs` exports `findUninventoriedCommands` as a pure function and handles multi-line bash, backslash continuations, and split `--area`/`--resource` flags.
- [ ] `tests/ado-cli-completeness.test.mjs` covers: empty source, single inline command, multi-line block, split flags, allowlist filtering, mixed scenarios.
- [ ] `tests/ado-cli-smoke.test.mjs` has two cases: completeness (runs everywhere) and CLI smoke (`t.skip` when `az` absent).
- [ ] When `az` is on PATH, the CLI smoke test runs `--help` against every inventory entry and asserts exit 0 + every `helpKeywordsRequired` substring appears in stdout.
- [ ] When `az` is absent, the CLI smoke test skips cleanly; the completeness test still runs.
- [ ] `commands/review-pr.md` Step 3 asserts `az devops invoke --help` exits 0; on failure, exits with the re-install instructions.
- [ ] `commands/review-pr.md` is ≤ 200 lines.
- [ ] `.github/workflows/ci.yml` has a conditional install step (`matrix.os == 'ubuntu-latest' && matrix.node == 24`) that installs `azure-cli` + the `azure-devops` extension; no install on other matrix cells.
- [ ] CI passes on Linux, macOS, Windows × Node 22, 24.
- [ ] `apps/claude-code/pr-review/AGENTS.md` contains the pointer paragraph; no command table.
- [ ] `CHANGELOG.md` under `[Unreleased]` has a `### Changed` entry describing the preflight expansion and the smoke test.
- [ ] `pnpm format`, `pnpm check`, `pnpm --filter pr-review test`, `pnpm --filter pr-review typecheck`, `pnpm --filter pr-review verify:changelog` all pass.

## Blocked by

`apps/claude-code/pr-review/docs/issues/pr-review-ado-fetcher-step4-fix/01-fold-thread-fetch-into-fetcher.md` — the inventory must include the new `pullRequestThreads` invocation that Slice 01 introduces, and the completeness check would fail until the stale `az repos pr thread list` references that Slice 01 removes are gone.
