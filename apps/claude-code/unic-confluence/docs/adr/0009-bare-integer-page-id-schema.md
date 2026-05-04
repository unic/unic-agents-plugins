# 0009. confluence-pages.json values are bare integer page IDs

**Status:** Accepted (2025-04)

## Context

`confluence-pages.json` maps local file paths to Confluence page identifiers. An object value (e.g. `{ "id": 123, "space": "ENG" }`) would allow richer metadata but would complicate every read path and invite multi-space scope creep.

## Decision

Values in `confluence-pages.json` are bare integers (Confluence page IDs). No object schema, no space key, no title field. Human-readable aliases (slugified titles) are written alongside the ID as a comment-like key (see ADR-0011).

## Consequences

- Every read path is `config[path]` — no destructuring, no optional field access.
- The schema cannot be widened to an object without a major version bump.
- Multi-space support (different Confluence instances for different pages) is explicitly out of scope.
