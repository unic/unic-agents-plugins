# 0007. CliError class instead of console.error + process.exit

**Status:** Accepted (2025-04)

## Context

Scattering `console.error(msg); process.exit(1)` throughout the script makes unit testing impossible (process.exit terminates the test runner) and makes error handling inconsistent.

## Decision

All user-facing fatal errors are thrown as `CliError` instances (a custom `Error` subclass with an optional `exitCode` field). The top-level entry point catches `CliError`, prints its message to stderr, and calls `process.exit` exactly once.

## Consequences

- Pure functions in `lib/` can throw `CliError` without calling `process.exit`.
- Tests can catch `CliError` and assert on its message and exit code without spawning a subprocess.
- Non-`CliError` exceptions bubble up to the top-level handler as unexpected errors (exit code 1, stack trace printed).
