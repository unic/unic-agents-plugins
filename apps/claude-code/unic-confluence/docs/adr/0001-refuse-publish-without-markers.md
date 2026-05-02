# 0001. Refuse to publish a page that has no markers; require --replace-all to overwrite

**Status:** Accepted (2025-04)

## Context

Publishing to Confluence without placement markers would silently overwrite hand-written page content. This is a destructive operation with no undo in the standard Confluence UI history for non-admins.

## Decision

The publish script refuses to process a Markdown file that contains no placement markers (e.g. `[AUTO_INSERT_START: label]` / `[AUTO_INSERT_END: label]`). To overwrite an entire page unconditionally, the caller must pass `--replace-all` explicitly.

## Consequences

- Authors must add markers to any Markdown file they intend to publish.
- The `--replace-all` flag is a deliberate escape hatch; it should not be used in automated pipelines.
- The guard prevents accidental destruction of Confluence page content.
