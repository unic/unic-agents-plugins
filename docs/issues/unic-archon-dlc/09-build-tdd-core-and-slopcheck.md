# Build workflow — TDD core and slopcheck

**Status:** ready-for-agent
**Category:** feature

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

The TDD execution core of `build`: the generated `build-<slug>.yaml` is executed by Archon, enforcing `code-red` before `code-green` per issue, with both phases parallelisable across independent issues. A `slopcheck` gate sits in front of any package install to guard against AI-hallucinated dependencies.

In scope:

- **`/unic-dlc-build <slug>` command** that executes the runtime-generated `.archon/workflows/build-<slug>.yaml` produced in slice 08.
- **Per-issue TDD discipline enforced by the DAG:**
  - `code-red` writes failing acceptance tests for the issue.
  - `code-green` writes the minimum implementation to pass those tests.
  - `depends_on` edges in the generated YAML force red → green within an issue.
- **Cross-issue parallelism:** both `code-red` and `code-green` may run in parallel across issues whose `blocked_by` is empty (or whose blockers are already complete). The `yaml-gen` output from slice 08 must already encode this; this slice verifies the runtime honours it.
- **`slopcheck` bash node** placed before any `package install` step:
  - Detects newly introduced package names by diffing manifest files (`package.json`, `pyproject.toml`, `Cargo.toml`, etc. depending on the project — start with the JS/TS ecosystem and document how to extend).
  - For each new package, checks registry existence (npm registry HEAD request for JS; equivalent for the other ecosystems already in scope).
  - Packages that fail the registry check are flagged `[ASSUMED]`.
  - For each `[ASSUMED]` package, creates a `checkpoint:human-verify` task inline so the user explicitly approves before installation continues.
  - If the optional `slopcheck` Python tool (GSD's slopsquatting gate) is on `PATH`, defer to it for the registry check; otherwise use the fallback registry HEAD checks.
  - If neither path is available, default to marking every new package `[ASSUMED]` — stricter, not silently permissive.

Out of scope: verification, goals-check, report, `/unic-dlc-review` (slices 10 and 11).

## Acceptance criteria

- [ ] Executing `/unic-dlc-build <slug>` runs the runtime-generated YAML and produces commits in the order: failing test → passing implementation, per issue.
- [ ] Independent issues are observed to run `code-red` (and `code-green`) in parallel for at least one representative `issues.json` test case.
- [ ] `slopcheck` runs before any package install and creates a `checkpoint:human-verify` task for every `[ASSUMED]` package.
- [ ] Approving the checkpoint allows the install to proceed; rejecting it aborts the install for that package and surfaces a clear message.
- [ ] When neither the Python `slopcheck` tool nor the fallback registry check is available, every new package is treated as `[ASSUMED]`.
- [ ] Command file uses the `unic-dlc-` prefix.

## Blocked by

- `docs/issues/unic-archon-dlc/08-plan-checker-and-yaml-gen.md`
