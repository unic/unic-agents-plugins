# 0025. `CliError` is intentionally duplicated across packages

**Status:** Accepted (2026-05)

## Context

`CliError` — a minimal custom error class with a numeric `exitCode` field — exists in two places:

- `packages/release-tools/scripts/lib/errors.mjs`
- `apps/claude-code/unic-confluence/scripts/lib/errors.mjs`

The implementations are identical. The pattern lets scripts throw instead of calling `process.exit`
directly, keeping all error paths testable with `assert.throws(fn, CliError)`.

An architecture review (2026-05) considered unifying the two instances into a shared
`@unic/utils` workspace package. The idea was rejected.

## Decision

Keep the two copies. Do not create `@unic/utils` or any shared package to house `CliError`.

If a third plugin's **runtime** scripts need `CliError`, that is the trigger to create `@unic/utils`
and consolidate all three instances at that point.

## Reasons

**`release-tools` is a dev tool, not a utility library.** `unic-confluence` cannot depend on it at
runtime — `release-tools` is about bumping versions and cutting tags, not about being a shared
utility. Importing `CliError` from it would blur that boundary.

**`unic-confluence` ships as a standalone npm package.** Consumers install it outside the monorepo.
A dependency on a monorepo-internal workspace package (`@unic/utils`) would either need to be
published to npm or break installations outside the workspace. Both options are worse than a local
copy.

**The class is 7 lines.** A new workspace package (with its own `package.json`, version, changelog,
and release lifecycle) is disproportionate overhead for this payload. The duplication cost is lower
than the coordination cost.

**No third instance is coming.** The `pr-review` re-review extraction (see
`docs/issues/pr-review-rereview/PRD.md`) introduces four Node.js modules with JSON stdin/stdout
interfaces. Errors in those modules are expressed as structured JSON, not as `CliError`. The
two-instance count is stable.

## Consequences

- Future plugins that add runtime Node.js scripts and need testable error paths should copy
  `CliError` locally — 19 lines including copyright header and JSDoc.
- If a third runtime copy appears, open a spec to create `@unic/utils`, consolidate all three, and
  update this ADR to Superseded.
- Architecture reviews should not flag the two-instance duplication as a defect.
