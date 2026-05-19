# Build workflow — self-contained /unic-dlc-review command

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

A self-contained `/unic-dlc-review` command that performs a multi-aspect PR review as an AFK Archon node. It is independent of any external review plugin so users can run the full DLC without installing `pr-review-toolkit`.

In scope:

- **`/unic-dlc-review` command + workflow node** invoked after the human PR gate from slice 10 (the human gate approves the PR; the review runs automatically on the diff).
- **Four review aspects, each emitting a structured finding list:**
  1. **Code quality** — readability, naming, function length, project-convention adherence (reads `CLAUDE.md`/`AGENTS.md`).
  2. **Test coverage adequacy** — exercises through public interfaces, asserts on outputs not internals, no mocks of internal collaborators.
  3. **Silent failure patterns** — swallowed exceptions, empty `catch` blocks, fallbacks that hide bugs.
  4. **Type design quality** — encapsulation, invariants expressed in types, illegal-state-unrepresentable patterns.
- **Inspiration references** documented in the command file:
  - This monorepo's `apps/claude-code/pr-review/` (patterns, not runtime dependency).
  - Matt Pocock's `review` skill (https://github.com/mattpocock/skills/blob/main/skills/in-progress/review/SKILL.md).
  - Note in the command file that this is a base review intended to evolve; later slices may deepen each aspect.
- **Output:** a structured review comment posted via the tracker adapter against the PR opened by slice 10. Findings are grouped by aspect with file:line references.
- **No runtime dependency** on `pr-review-toolkit` or any other plugin — verified by running the review in a project where `pr-review-toolkit` is not installed.

Out of scope: integrating the review with the `qa` workflow's gates (slice 12 reads but does not depend on the review output).

## Acceptance criteria

- [ ] `/unic-dlc-review` runs to completion on a project that does not have `pr-review-toolkit` installed.
- [ ] The review posts a single structured comment grouped by the four aspects, each with at least one finding or an explicit "no findings" line.
- [ ] Findings include file:line references where applicable.
- [ ] Command file uses the `unic-dlc-` prefix and includes the inspiration references in its prologue.
- [ ] Re-running the review on the same PR updates the prior comment rather than appending a duplicate.

## Blocked by

- `docs/issues/unic-archon-dlc/03-triage-workflow-and-tracker-adapter.md`
- `docs/issues/unic-archon-dlc/10-build-verification-goals-check-and-report.md`
