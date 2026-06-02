# Implementation Report

**Issue**: #148
**Generated**: 2026-06-03 12:00
**Workflow ID**: 4629d2912a7f2c0d2d8d881cd8f504dd

---

## Tasks Completed

| #   | Task                                                    | File                                                          | Status |
| --- | ------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| 1   | Author ADR-0010 (provider folder bundle)                | `docs/adr/0010-provider-folder-bundle.md`                     | ✅     |
| 2   | Amend ADR-0001 (provider-owned discovery)               | `docs/adr/0001-multi-source-intent-...md`                     | ✅     |
| 3   | Promote 0010 in ADR README, remove Planned              | `docs/adr/README.md`                                          | ✅     |
| 4   | PRD §105/107 past-tense update                          | `docs/issues/unic-pr-review/PRD.md`                           | ✅     |
| 5   | `detectProvider(url)` registry                          | `providers/index.mjs`                                         | ✅     |
| 6–9 | Fixtures (with/without/multiple WI + CLI inventory)     | `providers/azure_devops/fixtures/*.json`                      | ✅     |
| 10  | Provider module (parsePrUrl, discoverWorkItems, CLI)    | `providers/azure_devops/provider.mjs`                         | ✅     |
| 11  | Bundle manifest                                         | `providers/azure_devops/manifest.json`                        | ✅     |
| 12  | Bundle README                                           | `providers/azure_devops/README.md`                            | ✅     |
| 13  | Provider unit tests (12 cases)                          | `providers/azure_devops/tests/provider.test.mjs`              | ✅     |
| 14  | Widen test glob to include provider tests               | `package.json`                                                | ✅     |
| 15  | ADO Fetcher agent (Hermes, purple)                      | `agents/ado-fetcher.md`                                       | ✅     |
| 16  | Extend Intent Checker for `workItems`                   | `agents/intent-checker.md`                                    | ✅     |
| 17  | az invoke inventory smoke test                          | `tests/ado-cli-smoke.test.mjs`                                | ✅     |
| 18  | Replace review-pr.md Step 1 with ADO flow               | `commands/review-pr.md`                                       | ✅     |
| —   | CHANGELOG + plugin AGENTS.md (per artifact final note)  | `CHANGELOG.md`, `AGENTS.md`                                   | ✅     |

---

## Files Changed

| File                                                       | Action | Notes                                            |
| ---------------------------------------------------------- | ------ | ------------------------------------------------ |
| `docs/adr/0010-provider-folder-bundle.md`                  | CREATE | MADR-lite, Accepted (2026-06)                    |
| `docs/adr/0001-multi-source-intent-...md`                  | UPDATE | Amendment (2026-06) block                        |
| `docs/adr/README.md`                                       | UPDATE | 0010 in main list; Planned section removed       |
| `docs/issues/unic-pr-review/PRD.md`                        | UPDATE | §105/107 past tense, "(planned)" removed          |
| `providers/index.mjs`                                      | CREATE | `detectProvider` + CLI                           |
| `providers/azure_devops/provider.mjs`                      | CREATE | full provider + CLI                              |
| `providers/azure_devops/manifest.json`                     | CREATE |                                                  |
| `providers/azure_devops/README.md`                         | CREATE |                                                  |
| `providers/azure_devops/fixtures/*.json` (4)               | CREATE | with / without / multiple WI + CLI inventory     |
| `providers/azure_devops/tests/provider.test.mjs`           | CREATE | 12 cases across 3 exports                        |
| `agents/ado-fetcher.md`                                    | CREATE | Hermes, color purple, `Bash(az *), Bash(node *)` |
| `agents/intent-checker.md`                                 | UPDATE | additive: Step 0 + `workItems` input             |
| `commands/review-pr.md`                                    | UPDATE | Step 1 ADO flow (1.1–1.10); Steps 2–9 preserved  |
| `tests/ado-cli-smoke.test.mjs`                             | CREATE | inventory smoke test                             |
| `package.json`                                             | UPDATE | test glob includes provider tests               |
| `CHANGELOG.md`                                             | UPDATE | Unreleased › Added entries for this slice        |
| `AGENTS.md`                                                | UPDATE | ADR-0010 accepted; removed "do not add" guard    |

---

## Deviations from Investigation

The implementation matched the investigation with two minor, validation-driven adjustments:

### Deviation 1: smoke-test regex loop refactor

**Expected**: investigation's snippet used `while ((m = pattern.exec(...)) !== null)`.
**Actual**: rewrote as `[...md.matchAll(pattern)].map(...)`.
**Reason**: Biome's `noAssignInExpressions` rule (enforced by `pnpm ci:check`) rejects assignment inside the `while` condition. The `matchAll` form is equivalent and lint-clean.

### Deviation 2: extra provider test case substituted

**Expected**: a 5th `discoverWorkItems` case asserting numeric-id coercion.
**Actual**: replaced with a case asserting string ids + `ado-work-item` type across the multiple-WI fixture.
**Reason**: passing a numeric `id` literal violates the JSDoc `{ id: string }` param type under `tsc --checkJs`. The substitute keeps coverage ≥10 cases without a type error.

### Note: CHANGELOG + AGENTS.md

The investigation's "Notes" section flagged the plugin `AGENTS.md` (CLAUDE.md symlink) one-line edit as a final step; also added an `[Unreleased] › Added` CHANGELOG entry to satisfy the monorepo release convention. `verify:changelog` passes.

---

## Validation Results

| Check                              | Result                                  |
| ---------------------------------- | --------------------------------------- |
| `pnpm --filter unic-pr-review typecheck` | ✅ Pass (exit 0)                    |
| `pnpm --filter unic-pr-review test`      | ✅ Pass (337 tests, 0 fail)         |
| `pnpm ci:check`                          | ✅ Pass (exit 0; 2 pre-existing infos) |
| `pnpm --filter unic-pr-review verify:changelog` | ✅ Pass                       |
| CLI smoke: detect / parse-url / discover-work-items | ✅ Pass (exit codes 0/1/0/0) |
| ADR-0011 invariant: `changed-file-analyser.mjs` untouched | ✅ No diff             |
