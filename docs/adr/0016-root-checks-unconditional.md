# 0016. Root checks (Biome + Prettier) always run, regardless of changed files

**Status:** Accepted (2025-04)

## Context

Formatting is a repo-wide hygiene concern. A paths-filter on root checks would allow unformatted files to land if the change set appeared documentation-only.

## Decision

The `root-checks` CI job (Biome lint+format, Prettier on Markdown) runs on every push and every PR, unconditionally. It runs once on `ubuntu-latest` / Node 24 only (formatting is OS-independent).

## Consequences

- Every push pays the cost of a root check (~10–20 s).
- Contributors cannot bypass the formatter by touching only `docs/` files.
