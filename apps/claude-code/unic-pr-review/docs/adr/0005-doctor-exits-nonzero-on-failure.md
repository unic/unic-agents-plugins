# 0005. Doctor exits non-zero when any critical preflight fails

**Status:** Accepted (2026-05)

## Context

The doctor command must be scriptable — CI pipelines should be able to run it and rely on exit codes to gate deployments.

## Decision

`doctor.mjs` exits 1 if any critical preflight check fails. All checks run before exit so the user sees every failure in a single run. All failures are reported to stderr. Jira not configured is not a failure (exit 0).

## Consequences

- Composable: `node scripts/doctor.mjs && node scripts/review.mjs` works as expected.
- Every predicate is responsible for its own stderr message before returning false.
- A partial failure (e.g., az CLI found but login expired) still exits 1 after running all remaining checks.
