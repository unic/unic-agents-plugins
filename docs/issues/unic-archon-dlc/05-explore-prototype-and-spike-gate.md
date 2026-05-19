# Explore workflow — prototype, spike verdicts, and spike-branch gate

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

Second half of the `explore` workflow: a prototype node that runs structured experiments, an optional human gate for preserving valuable spike code, and a spike ticket in the configured tracker.

In scope:

- **`prototype` node** appended to `.archon/workflows/explore.yaml`. Reads `findings.md` and produces one or more experiments, each emitting a structured verdict — exactly one of:
  - `VALIDATED` — approach works as expected, evidence captured.
  - `INVALIDATED` — approach failed, reason captured.
  - `PARTIAL` — partially works, gaps documented.
  - Verdicts and per-experiment notes are written into a `## Spike verdicts` section of `findings.md` (single source of truth — no separate spike file).
- **Optional interactive gate** after `prototype`: asks the user whether the spike produced code worth preserving on a branch. If yes, the workflow creates a `spike/<slug>` branch with the prototype code committed; if no, the worktree is left clean.
- **Spike ticket creation** via the tracker adapter (slice 03): a ticket of type `spike`, labelled with the configured priority default, linking to `docs/workflow/<slug>/findings.md`. The ticket records VALIDATED/INVALIDATED/PARTIAL summary in its body so the tracker view is informative.

Out of scope: feeding spike code into `plan` automatically — `plan` reads `findings.md` only, not the branch.

## Acceptance criteria

- [ ] `prototype` node runs after `synthesize` and writes a `## Spike verdicts` section to `findings.md` with at least one experiment carrying exactly one verdict from {VALIDATED, INVALIDATED, PARTIAL}.
- [ ] Spike-branch gate is interactive: answering "yes" creates a `spike/<slug>` branch with a commit; answering "no" leaves no branch behind.
- [ ] A spike ticket is created in the configured tracker via the tracker adapter, with type label `spike`, body linking to `findings.md`, and a one-line verdict summary.
- [ ] Re-running `/unic-dlc-explore <slug>` on an existing slug does not duplicate the spike ticket; the existing ticket is updated.

## Blocked by

- `docs/issues/unic-archon-dlc/03-triage-workflow-and-tracker-adapter.md`
- `docs/issues/unic-archon-dlc/04-explore-parallel-research-and-synthesize.md`
