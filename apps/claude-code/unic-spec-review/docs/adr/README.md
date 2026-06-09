# unic-spec-review · Architecture Decision Records

Plugin-scoped ADRs. Monorepo-wide decisions live in `../../../../../docs/adr/`.

- [0001](0001-vendor-shared-code-for-self-containment.md): Vendor shared Atlassian code for self-containment
- [0002](0002-dedup-by-similarity-not-marker.md): De-duplicate comments by content similarity, not a hidden marker
- [0003](0003-six-hats-lens-over-dimensions.md): Six Thinking Hats layered as a lens over technical dimensions
- [0004](0004-inline-anchored-comments-footer-fallback.md): Inline-anchored Confluence comments with a footer fallback
- [0005](0005-gate-dedup-when-comparison-incomplete.md): Gate de-dup posts when the comparison basis is incomplete

> Status: these ADRs record decisions locked during the design grilling for the [PRD](../issues/unic-spec-review/PRD.md). ADR-0001 (vendor self-containment) and ADR-0003 (six-hats lens + all eleven review agents) are implemented as of S4. ADR-0004 (inline-anchored comments with footer fallback) is implemented as of S5 (`inline-anchor-resolver.mjs`, `attribution-footer.mjs`, `confluence-writer.mjs`). ADR-0002 (similarity de-dup) is implemented as of S8 (`dedup-matcher.mjs`). ADR-0005 (gate incomplete comparisons) refines ADR-0002 and is pending — scoped in #238.
