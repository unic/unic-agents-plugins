# unic-spec-review · Architecture Decision Records

Plugin-scoped ADRs. Monorepo-wide decisions live in `../../../../../docs/adr/`.

- [0001](0001-vendor-shared-code-for-self-containment.md): Vendor shared Atlassian code for self-containment
- [0002](0002-dedup-by-similarity-not-marker.md): De-duplicate comments by content similarity, not a hidden marker
- [0003](0003-six-hats-lens-over-dimensions.md): Six Thinking Hats layered as a lens over technical dimensions
- [0004](0004-inline-anchored-comments-footer-fallback.md): Inline-anchored Confluence comments with a footer fallback

> Status: all four ADRs are implemented as of 0.1.8. ADR-0001 (vendor self-containment) and ADR-0003 (six-hats lens + all eleven review agents) implemented as of S4. ADR-0004 (inline-anchored comments with footer fallback) implemented as of S5 (`inline-anchor-resolver.mjs`, `attribution-footer.mjs`, `confluence-writer.mjs`). ADR-0002 (similarity de-dup) implemented as of S8 (`dedup-matcher.mjs`).
