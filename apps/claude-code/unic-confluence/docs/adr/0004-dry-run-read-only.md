# 0004. --dry-run is purely read-only: never sends a PUT to Confluence

**Status:** Accepted (2025-04)

## Context

`--dry-run` is used in CI smoke tests and pre-commit checks to validate that a Markdown file would publish correctly without actually modifying Confluence.

## Decision

When `--dry-run` is passed, the script performs all parsing, conversion, and marker injection steps but never calls the Confluence API's PUT endpoint. It logs what it would have done and exits 0.

## Consequences

- `--dry-run` is safe to run in any CI context, including production pipelines.
- The dry run validates the full conversion pipeline but not the Confluence API connection.
- A successful dry run does not guarantee a successful publish (API auth, page permissions may differ).
