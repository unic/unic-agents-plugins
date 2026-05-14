# Explore workflow — parallel research and synthesize

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

First half of the `explore` workflow: four parallel research agents converging on a `synthesize` node that produces a coherent brief, written to `docs/workflow/<slug>/findings.md`.

In scope:

- `.archon/workflows/explore.yaml` (will be extended in slice 05 with the prototype phase).
- `/unic-dlc-explore` command file.
- **Four parallel research nodes** running simultaneously, each scoped to a single concern:
  - `research-stack` — current and emerging stack relevant to the feature
  - `research-features` — comparable existing features in the codebase and prior art
  - `research-architecture` — how the change fits the existing architecture and ADRs
  - `research-pitfalls` — known traps, deprecations, security/privacy considerations
- **`synthesize` node** combining the four research outputs with the user's stated intent into a coherent brief. Pulls in CONTEXT.md and (if multi-context) CONTEXT-MAP.md so the brief uses the project glossary.
- **`docs/workflow/<slug>/findings.md`** is committed to the repo. The slug is taken from the user-supplied feature name; the hook creates the directory if absent.
- **Optional input from `explore` is honoured by `plan`:** `plan` works without findings, but consumes them when present (the contract is "findings.md may or may not exist" — slice 06's `specs` node handles both cases).

Out of scope (covered in slice 05): prototype node, VALIDATED/INVALIDATED/PARTIAL verdicts, spike-branch gate, spike ticket creation.

## Acceptance criteria

- [ ] `/unic-dlc-explore <slug>` runs all four research nodes in parallel (verifiable from the Archon execution log or YAML structure).
- [ ] `synthesize` produces `docs/workflow/<slug>/findings.md` containing sections for each research dimension plus the integrated brief.
- [ ] `findings.md` references CONTEXT.md vocabulary and at least one existing ADR by ID when one is relevant.
- [ ] Running `explore` without an existing `docs/workflow/<slug>/` directory creates it; running with an existing directory does not destroy prior contents.
- [ ] Command file uses the `unic-dlc-` prefix.

## Blocked by

- `docs/issues/unic-archon-dlc/02-full-install-hook-and-agent-docs.md`
