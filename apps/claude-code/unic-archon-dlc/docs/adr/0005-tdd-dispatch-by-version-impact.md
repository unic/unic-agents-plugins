# 0005. Ralph uses `/tdd` for behavioral specs, direct implementation for structural ones, dispatched by `**Version impact:**`

**Status:** Accepted (2026-05)

Renumbered from monorepo-root ADR-0026 (2026-05).

## Context

The Ralph loop previously told the agent to "follow the Implementation steps exactly" for every spec. This produced horizontal slicing (building layer by layer as prescribed) rather than vertical slicing (a thin end-to-end slice that proves value immediately). It also left no explicit feedback loop before committing — the agent could implement and commit without ever running tests.

Adding `/tdd` unconditionally would be awkward for structural specs (config files, release tooling, docs) where there is no meaningful unit of behavior to test first. A test asserting that `plugin.json` contains a field adds noise with no signal.

## Decision

`PROMPT.md` dispatches on the spec's `**Version impact:**` field:

- **`none`** — implement directly; follow the Implementation steps as a recipe. No `/tdd`.
- **`patch` / `minor` / `major`** — invoke `/tdd`; treat the Implementation steps as guidance (key files, rough order), not a recipe. The spec's Acceptance criteria are the target; the red-green-refactor cycle drives the path.

`**Version impact:**` was chosen as the dispatch signal because it is already present in every spec, it reliably separates behavioral changes (which touch runtime code) from structural ones (which touch config, docs, or tooling), and it requires no new metadata.

## Considered options

- **Effort-gated dispatch** — switch to `/tdd` after N failed attempts. Rejected: this rewards thrashing rather than preventing it, and gives the agent no clear signal upfront.
- **Universal `/tdd`** — apply to all specs including `none`. Rejected: a test asserting a config field exists adds noise and would fight the prescriptive implementation steps that structural specs genuinely need.
- **New metadata field in spec frontmatter** — e.g. `**Implementation style: tdd|direct**`. Rejected: `**Version impact:**` already encodes the same distinction; a new field would duplicate information and drift.

## Consequences

- Specs with `**Version impact: none**` remain recipe-style; their Implementation steps should stay prescriptive.
- Specs with a semver impact should be written acceptance-criteria-first going forward; detailed step-by-step instructions are demoted to guidance.
- The always-on `pnpm check` block in Step 4 serves as the post-`/tdd` hygiene gate, catching formatting regressions the TDD loop does not cover.
