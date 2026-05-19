---
description: Run the unic-archon-dlc QA workflow — e2e tests, coverage gate, UAT checklist, and merge
---

# /unic-dlc-qa

Runs the `qa` workflow: executes end-to-end tests, enforces the coverage threshold, walks through
a UAT checklist derived from the PRD's acceptance criteria, and merges the PR once the human approves.

## When to use

- After `/unic-dlc-build <slug>` is complete and the build PR has been reviewed and approved.
- When you want a structured QA gate before merging a feature branch.
- Any time you need to confirm that acceptance criteria are met before shipping.

## What it produces

- **e2e results** — pass/fail output from the command configured in `e2e_command`.
- **Coverage report** — pass/fail against the `coverage_threshold` set in `.archon/unic-dlc.config.json`.
- **UAT checklist** — numbered acceptance criteria from `docs/workflow/<slug>/PRD.md`, presented alongside build coverage evidence.
- **Merged PR** — once UAT is approved, the PR is merged via the configured tracker CLI and the feature branch is cleaned up (Gitflow only).

## Usage

```sh
archon run .archon/workflows/qa.yaml --input slug=<slug>
```

Or invoke from Claude Code:

```
/unic-dlc-qa <slug>
```

Replace `<slug>` with the same identifier used in `/unic-dlc-plan` and `/unic-dlc-build`.

## Prerequisites

- `/unic-dlc-build <slug>` must have been run and the build PR approved.
- `.archon/unic-dlc.config.json` must be present (created by the install hook).
- `e2e_command` must be set in the config. If not, run `archon install --reconfigure` to set it.
- The current branch must have an open PR targeting `develop` (for the merge step).

## Workflow structure

```
e2e  ──▶  coverage-gate  ──▶  uat-gate (interactive)  ──▶  merge
```

- `e2e` — reads `e2e_command` from config; fails fast with a helpful message if it is not set.
- `coverage-gate` — runs `pnpm test --coverage`; parses the output to compare against `coverage_threshold`. Skipped if no threshold is configured.
- `uat-gate` — presents the numbered UAT checklist; waits for APPROVE or REJECT from the human.
- `merge` — merges the PR via the tracker CLI (gh / az / manual instructions for jira and local-markdown); deletes the feature branch on Gitflow.

## Configuration reference

All settings are read from `.archon/unic-dlc.config.json`:

| Field                | Type   | Default     | Description                                                              |
| -------------------- | ------ | ----------- | ------------------------------------------------------------------------ |
| `e2e_command`        | string | —           | Shell command to run e2e tests (e.g. `"pnpm test:e2e"`)                  |
| `coverage_threshold` | number | —           | Minimum coverage % required (e.g. `80`). Omit to skip the gate.          |
| `tracker`            | string | `"github"`  | Issue tracker: `github`, `ado`, `jira`, `local-markdown`                 |
| `branching`          | string | `"gitflow"` | Branch strategy: `gitflow` (delete feature branch) or `github-flow`      |
| `pr_strategy`        | string | `"squash"`  | GitHub merge style: `squash` or `merge` (used for `github` tracker only) |

## UAT interaction

The `uat-gate` node pauses and asks for your decision:

- Type **`APPROVE`** to proceed to merge.
- Type **`REJECT AC-N`** (e.g. `REJECT AC-3`) to flag a failing criterion. The workflow halts and you are returned to address the issue before re-running.

## Runs

```
archon run .archon/workflows/qa.yaml --input slug=<slug>
```
