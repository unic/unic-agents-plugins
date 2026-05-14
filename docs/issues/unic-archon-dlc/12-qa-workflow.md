# QA workflow — e2e, coverage gate, UAT, merge

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

A `qa` workflow that runs the e2e suite first, fails fast on insufficient coverage, presents an informed UAT checklist, and merges the PR via the tracker's CLI after sign-off.

In scope:

- `/unic-dlc-qa <slug>` command and `.archon/workflows/qa.yaml`.
- **E2e suite runs first.** Uses the `e2e_command` configured during install (slice 02). If unset, the workflow halts with a clear message asking the user to run install with `--reconfigure` and set the command.
- **`coverage-gate` bash node** enforces the coverage thresholds configured in `.archon/unic-dlc.config.json`. Fails fast — the human UAT gate never opens unless automated coverage already passes.
- **`uat-gate` interactive node:** presents e2e results alongside the UAT checklist extracted from the PRD's acceptance criteria. Approval continues to merge; rejection returns control to whoever owns the failing checklist item.
- **Merge step via tracker adapter:** after `uat-gate` approves, the workflow merges the PR using the configured tracker's CLI (no manual terminal commands required). Branch deletion follows the configured branching strategy (Gitflow vs GitHub Flow).
- All workflow YAML uses canonical label names; the adapter translates at write time.

Out of scope: post-merge cleanup (slice 13).

## Acceptance criteria

- [ ] `/unic-dlc-qa <slug>` runs the configured `e2e_command` before any human gate opens.
- [ ] If `e2e_command` is unset, the workflow halts with a clear, actionable message and a non-zero exit.
- [ ] `coverage-gate` blocks `uat-gate` when coverage is below threshold.
- [ ] `uat-gate` shows the PRD's acceptance criteria as a checklist alongside the e2e summary.
- [ ] After `uat-gate` approves, the PR is merged via the tracker adapter; branch handling matches the configured branching strategy.
- [ ] Command file uses the `unic-dlc-` prefix.

## Blocked by

- `docs/issues/unic-archon-dlc/03-triage-workflow-and-tracker-adapter.md`
- `docs/issues/unic-archon-dlc/10-build-verification-goals-check-and-report.md`
