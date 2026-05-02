# 0005. spawnSync calls include a timeout and killSignal on every formatter invocation

**Status:** Accepted (2025-04)

## Context

A hung formatter (e.g. Prettier on a circular require, ESLint on a very large file) would freeze Claude Code's edit loop indefinitely. A timeout guard is necessary.

## Decision

Every `spawnSync` call in the hook script includes `timeout` (configurable, defaulting to 10 000 ms) and `killSignal: 'SIGTERM'`. If the timeout expires, the process is killed and the hook logs a warning to stderr and exits 0.

## Consequences

- Formatters that take longer than the timeout are killed; the file is left unformatted.
- The timeout is configurable via per-project config (see ADR-0004).
- SIGTERM may not stop all processes on Windows; `killSignal` is best-effort there.
