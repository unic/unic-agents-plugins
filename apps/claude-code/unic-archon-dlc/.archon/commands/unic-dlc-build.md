# /unic-dlc-build

Execute the TDD build workflow for a planning session, enforcing red → green per issue.

## Usage

```
/unic-dlc-build <slug>
```

Where `<slug>` is the session identifier used when you ran `/unic-dlc-plan`. The generated
`.archon/workflows/build-<slug>.yaml` must already exist (produced by the `yaml-gen` node in plan).

## What this command does

1. **Slopcheck gate** — before any implementation begins, scans `package.json` (and other
   manifest files) for packages introduced since the last commit. Each new package is checked
   against the npm registry. Packages that fail the check are flagged `[ASSUMED]` and require
   explicit human approval before the build can continue.

   Registry check strategy (in order of preference):
   - Python `slopcheck` tool (GSD's slopsquatting gate) if available on `PATH`
   - npm registry HEAD request fallback
   - If neither is available: all new packages are treated as `[ASSUMED]` (strict default)

   To bypass slopcheck for known-safe cases: `SLOPCHECK_BYPASS=1 /unic-dlc-build <slug>`

2. **Generated build workflow** — executes `.archon/workflows/build-<slug>.yaml` which was
   produced by the `yaml-gen` node in `/unic-dlc-plan`. The generated workflow:
   - Issues a `code-red` node per issue: writes FAILING acceptance tests
   - Issues a `code-green` node per issue: writes minimum implementation to pass those tests
   - Enforces `code-red` before `code-green` within each issue via `depends_on` edges
   - Runs independent issues' `code-red` (and `code-green`) phases in parallel

## Prerequisites

- `/unic-dlc-plan <slug>` must have been run and the plan PR approved
- `.archon/workflows/build-<slug>.yaml` must exist
- `.archon/unic-dlc.config.json` must be present (created by the install hook)

## TDD contract

Every issue in the build goes through:

```
RED:   code-red-<id>   → write failing acceptance tests
GREEN: code-green-<id> → write minimum implementation to pass those tests
```

No `code-green` node may run before its corresponding `code-red` node completes.
Independent issues run their `code-red` and `code-green` phases in parallel,
giving the fastest possible end-to-end build time.

## Runs

```
archon run .archon/workflows/build.yaml --input slug=<slug>
```
