# 0002. Three-strategy injection with explicit priority: markers → anchor macros → append

**Status:** Accepted (2025-04)

## Context

Authors need different levels of precision when placing Markdown content into a Confluence page. A single strategy cannot satisfy all cases.

## Decision

The injection engine tries three strategies in priority order:

1. **Plain markers** (`[AUTO_INSERT_START: label]` / `[AUTO_INSERT_END: label]`): highest precision; replaces exactly the bounded section.
2. **Anchor macros**: places content relative to a named Confluence anchor macro.
3. **Append**: appends to the end of the page as a last resort.

The first matching strategy wins.

## Consequences

- Authors choose precision vs. convenience by adding the appropriate markers.
- The engine is deterministic: the same Markdown + same page always produces the same result.
- Adding a fourth strategy is a minor version bump.
