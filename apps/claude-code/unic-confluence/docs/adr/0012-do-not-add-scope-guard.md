# 0012. Explicit "Do not add" scope guard in CLAUDE.md prevents feature creep

**Status:** Accepted (2025-04)

## Context

The unic-confluence plugin has a narrow, well-defined scope: publish local Markdown to Confluence pages using markers. Several adjacent features were proposed and explicitly rejected during design: image upload, page creation, multi-instance support, MCP integration, watch mode, and recursive publish.

## Decision

A `## Do not add` section in the plugin's `CLAUDE.md` pre-rejects these features with brief reasons. Any contributor or automated agent (Ralph, Claude) encountering one of these features must reject the request and refer to this section rather than implementing it.

## Consequences

- Future contributors have a clear signal that these features are not oversight omissions.
- The ADR system supplements the CLAUDE.md guard: if a feature is re-proposed with new justification, the ADR can be amended rather than the scope guard silently overridden.
- The scope guard must be reviewed when the plugin reaches 1.0 — some restrictions may be relaxed.
