# 0008. Pure functions extracted into lib/ and covered by node:test

**Status:** Accepted (2025-04)

## Context

Markdown → Confluence Storage Format conversion and marker injection are deterministic, input→output functions. Keeping them in the main script file makes them hard to test in isolation.

## Decision

All conversion and injection logic lives in `lib/` as pure functions (no I/O, no side effects). The main script imports from `lib/` and handles only I/O. Tests in `test/` use `node:test` to exercise `lib/` functions directly.

## Consequences

- The most complex logic (conversion, injection) is fully covered by unit tests.
- I/O paths (file reads, HTTP calls) remain thin and are not unit-tested.
- `lib/` functions must never import from `node:fs`, `node:http`, etc.
