# Plan workflow — plan-checker loop, yaml-gen, and second PR gate

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

Closes out the `plan` workflow with a validating loop that hardens the issue plan, a runtime YAML generator that turns the dependency tree into a build DAG, and the second human PR gate.

In scope:

- **`plan-checker` loop node:**
  - Max 3 iterations before escalation to a human gate.
  - **Stall detection:** if the issue count does not decrease between consecutive iterations, escalate immediately to the human gate rather than burning the remaining retries.
  - Validates four dimensions:
    - **Consistency** — no orphaned `blocked_by` references, all PRD acceptance criteria are covered by at least one issue.
    - **Completeness** — every mandatory field is present on every issue.
    - **Decision coverage** — every trackable decision in `CONTEXT.md` (and any decisions captured during `specs`) appears in at least one issue.
    - **Nyquist compliance** — every issue maps to a concrete test command (no lingering `test_command_planned: true` unless explicitly accepted at the gate).
- **`yaml-gen` bash node:** reads `issues.json`, builds the dependency DAG, detects parallel groups (issues with no shared `blocked_by`), and writes `.archon/workflows/build-<slug>.yaml`. Both `code-red` and `code-green` for independent issues are emitted as parallel-capable nodes. Linear chains produce serial nodes; circular dependencies are detected, reported, and abort the generation. Output YAML must be valid Archon syntax.
- **Dependency tree builder + YAML generator module:** pure data transformation, separately unit-tested. Test cases: linear chain → serial; independents → parallel; circular → reported; output round-trips through Archon's YAML parser.
- **Second human PR gate (`interactive: true`):** opens a PR containing `issues.json`, the generated `build-<slug>.yaml`, and the `plan-checker` report. Workflow pauses until approved. Rejected approvals return control to `plan-checker` for another validation pass (not a full re-decomposition).

Out of scope: executing the generated build YAML (slice 09).

## Acceptance criteria

- [ ] `plan-checker` runs at most 3 iterations and escalates on stall (issue count stays equal between consecutive iterations).
- [ ] `plan-checker` reports failures across all four validation dimensions in a single structured report.
- [ ] `yaml-gen` produces a syntactically valid Archon YAML; circular dependencies abort with a clear error.
- [ ] Independent issues appear as parallel nodes; chained issues appear as serial nodes; both `code-red` and `code-green` carry parallel grouping when applicable.
- [ ] Dependency tree builder unit tests cover linear, parallel-fan, diamond, and circular cases.
- [ ] Second human PR gate stages `issues.json` + `build-<slug>.yaml` + `plan-checker` report in a PR and blocks until approved.

## Blocked by

- `docs/issues/unic-archon-dlc/07-plan-to-issues-and-nyquist.md`
